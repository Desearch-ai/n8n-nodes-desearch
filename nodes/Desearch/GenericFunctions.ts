import {
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IN8nHttpFullResponse,
	type INode,
} from 'n8n-workflow';

import {
	desearchApiRequest,
	isSet,
	responseHeader,
	splitList,
	type DesearchRequest,
} from '../shared/transport';

/**
 * Headers of every JSON request. 0.2.0 sent them on every request (its
 * `requestDefaults`), so AI Search, Web Search and X Search requests stay the same.
 */
const JSON_HEADERS: IDataObject = {
	Accept: 'application/json',
	'Content-Type': 'application/json',
};

/** Response header with the cursor of the next page of a TikTok, Facebook or Instagram list. */
export const NEXT_CURSOR_HEADER = 'x-desearch-next-cursor';

/** The object without the keys whose value is undefined, null or ''. */
export function compact(object: IDataObject): IDataObject {
	return Object.fromEntries(Object.entries(object).filter(([, value]) => isSet(value)));
}

/**
 * Output items of a JSON response, the way the 0.2.0 declarative node made them:
 * one item per entry of an array, otherwise one item.
 */
export function toItems(body: unknown): IDataObject[] {
	if (Array.isArray(body)) {
		return body.map((entry) =>
			entry !== null && typeof entry === 'object' && !Array.isArray(entry)
				? (entry as IDataObject)
				: { value: entry as IDataObject[keyof IDataObject] },
		);
	}
	if (body === undefined || body === null || body === '') {
		return [];
	}
	if (typeof body === 'object') {
		return [body as IDataObject];
	}
	return [{ value: body as IDataObject[keyof IDataObject] }];
}

/**
 * One output item for a page of a TikTok, Facebook or Instagram list: the entries in
 * `results` and the cursor of the next page in `nextCursor` (null on the last page).
 */
export function listPage(response: IN8nHttpFullResponse): IDataObject {
	const { body } = response;
	let results: IDataObject[] = [];
	if (Array.isArray(body)) {
		results = body as IDataObject[];
	} else if (body !== null && typeof body === 'object' && Object.keys(body).length > 0) {
		results = [body as IDataObject];
	}
	return { results, nextCursor: responseHeader(response, NEXT_CURSOR_HEADER) ?? null };
}

/**
 * A date for the API: `YYYY-MM-DDTHH:MM:SSZ` (or `YYYY-MM-DD` when `dateOnly`), in UTC.
 * A date or time without a time zone, as n8n's date picker gives, is read as UTC.
 */
export function apiDate(
	node: INode,
	itemIndex: number,
	value: unknown,
	label: string,
	dateOnly = false,
): string | undefined {
	if (!isSet(value)) {
		return undefined;
	}
	let text = String(value).trim();
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) {
		text = `${text}Z`;
	}
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		throw new NodeOperationError(node, `${label} is not a valid date: "${String(value)}"`, {
			itemIndex,
			description: 'Use a date such as 2025-05-01 or 2025-05-01T12:00:00Z.',
		});
	}
	const iso = date.toISOString();
	return dateOnly ? iso.slice(0, 10) : `${iso.slice(0, 19)}Z`;
}

type ParameterValue = IDataObject[keyof IDataObject];

type Parameter = (name: string, fallback?: ParameterValue) => ParameterValue;

interface Context {
	self: IExecuteFunctions;
	itemIndex: number;
	parameter: Parameter;
	/** A required text parameter, trimmed, without a leading `strip` character. Fails when empty. */
	text: (name: string, label: string, strip?: string) => string;
	request: (
		method: IHttpRequestMethods,
		path: string,
		options?: DesearchRequest,
	) => Promise<IN8nHttpFullResponse>;
}

function createContext(self: IExecuteFunctions, itemIndex: number): Context {
	const parameter: Parameter = (name, fallback) =>
		(fallback === undefined
			? self.getNodeParameter(name, itemIndex)
			: self.getNodeParameter(name, itemIndex, fallback)) as ParameterValue;
	return {
		self,
		itemIndex,
		parameter,
		text: (name, label, strip) => {
			let value = String(parameter(name, '') ?? '').trim();
			if (strip !== undefined && value.startsWith(strip)) {
				value = value.slice(strip.length).trim();
			}
			if (value === '') {
				throw new NodeOperationError(self.getNode(), `${label} is empty`, { itemIndex });
			}
			return value;
		},
		request: async (method, path, options = {}) =>
			await desearchApiRequest.call(self, itemIndex, method, path, {
				...options,
				headers: { ...(options.encoding === undefined ? JSON_HEADERS : {}), ...options.headers },
			}),
	};
}

async function runSearch(context: Context, operation: string): Promise<IDataObject[]> {
	const { parameter, request, self, itemIndex } = context;
	const node = self.getNode();
	switch (operation) {
		// AI Search, Web Search and X Search send exactly what the 0.2.0 routing sent.
		case 'aiSearch':
			return toItems(
				(
					await request('POST', '/desearch/ai/search', {
						body: {
							prompt: parameter('prompt') as string,
							tools: parameter('tools') as string[],
							date_filter: (parameter('dateFilter', '') as string) || undefined,
							result_type: parameter('resultType') as string,
							streaming: false,
						},
					})
				).body,
			);
		case 'webSearch':
			return toItems(
				(
					await request('GET', '/web', {
						qs: { query: parameter('query') as string, start: parameter('start') as number },
					})
				).body,
			);
		case 'xSearch':
			return toItems(
				(
					await request('GET', '/twitter', {
						qs: {
							query: parameter('query') as string,
							count: parameter('count') as number,
							sort: parameter('sort') as string,
						},
					})
				).body,
			);
		case 'aiWebLinksSearch': {
			const options = parameter('options', {}) as IDataObject;
			return toItems(
				(
					await request('POST', '/desearch/ai/search/links/web', {
						body: compact({
							prompt: context.text('prompt', 'Prompt'),
							tools: ['web'],
							count: parameter('count', 10) as number,
							start_date: apiDate(node, itemIndex, options.startDate, 'Start Date'),
							end_date: apiDate(node, itemIndex, options.endDate, 'End Date'),
							highlights: options.highlights as boolean | undefined,
							page_text: options.pageText as boolean | undefined,
						}),
					})
				).body,
			);
		}
		case 'aiXLinksSearch':
			return toItems(
				(
					await request('POST', '/desearch/ai/search/links/twitter', {
						body: {
							prompt: context.text('prompt', 'Prompt'),
							count: parameter('count', 10) as number,
						},
					})
				).body,
			);
		case 'searchApi': {
			const options = parameter('options', {}) as IDataObject;
			return toItems(
				(
					await request('POST', '/search', {
						body: compact({
							query: context.text('query', 'Query'),
							mode: options.mode as string | undefined,
							count: parameter('count', 10) as number,
							start_date: apiDate(node, itemIndex, options.startDate, 'Start Date', true),
							end_date: apiDate(node, itemIndex, options.endDate, 'End Date', true),
							highlights: options.highlights as boolean | undefined,
							page_text: options.pageText as boolean | undefined,
						}),
					})
				).body,
			);
		}
	}
	return unsupported(context, 'search', operation);
}

async function runWebPage(context: Context, operation: string): Promise<IDataObject[]> {
	if (operation !== 'extract') {
		return unsupported(context, 'webPage', operation);
	}
	const url = context.text('url', 'URL');
	const format = context.parameter('format', 'text') as string;
	const options = context.parameter('options', {}) as IDataObject;
	const qs: IDataObject = { url, format };
	if (options.renderJavaScript === true) {
		qs.js = 'true';
		if (isSet(options.waitMs) && Number(options.waitMs) > 0) {
			qs.wait = Number(options.waitMs);
		}
	}
	const { body } = await context.request('GET', '/web/extract', {
		qs,
		headers: { Accept: format === 'html' ? 'text/html' : 'text/plain' },
		encoding: 'text',
	});
	return [{ url, format, content: typeof body === 'string' ? body : JSON.stringify(body ?? '') }];
}

async function runX(context: Context, operation: string): Promise<IDataObject[]> {
	const { parameter, request, text } = context;
	const cursor = () => String(parameter('cursor', '') ?? '').trim() || undefined;
	const query = () => String(parameter('query', '') ?? '').trim() || undefined;
	const get = async (path: string, qs: IDataObject, options: DesearchRequest = {}) =>
		toItems((await request('GET', path, { ...options, qs })).body);

	switch (operation) {
		case 'getPost':
			return await get('/twitter/post', { id: text('postId', 'Post ID') });
		case 'getPostsByUrls': {
			const urls = splitList(parameter('urls', ''));
			if (urls.length === 0) {
				throw new NodeOperationError(context.self.getNode(), 'Post URLs is empty', {
					itemIndex: context.itemIndex,
				});
			}
			// FastAPI reads a list from a repeated query parameter: urls=a&urls=b.
			return await get('/twitter/urls', { urls }, { arrayFormat: 'repeat' });
		}
		case 'searchUserPosts':
			return await get('/twitter/post/user', {
				user: text('username', 'Username', '@'),
				query: query(),
				count: parameter('count', 10),
			});
		case 'getRetweeters':
			return await get('/twitter/post/retweeters', {
				id: text('postId', 'Post ID'),
				cursor: cursor(),
			});
		case 'getUserPosts':
			return await get('/twitter/user/posts', {
				username: text('username', 'Username', '@'),
				cursor: cursor(),
			});
		case 'getUserReplies':
			return await get('/twitter/replies', {
				user: text('username', 'Username', '@'),
				count: parameter('count', 10),
				query: query(),
			});
		case 'getPostReplies':
			return await get('/twitter/replies/post', {
				post_id: text('postId', 'Post ID'),
				count: parameter('count', 10),
				query: query(),
			});
		case 'getTrends':
			return await get('/twitter/trends', {
				woeid: parameter('woeid', 1),
				count: parameter('count', 30),
			});
	}
	return unsupported(context, 'x', operation);
}

/** Path parameter of a social route: node parameter name, label, and a prefix to drop. */
interface PathParameter {
	name: string;
	label: string;
	strip?: string;
}

const POST_ID: PathParameter = { name: 'postId', label: 'Post ID' };
const USERNAME: PathParameter = { name: 'username', label: 'Username', strip: '@' };
const HASHTAG: PathParameter = { name: 'hashtag', label: 'Hashtag', strip: '#' };

interface SocialRoute {
	/** Path; `{}` is replaced by the URL-encoded path parameter. */
	path: string;
	pathParameter?: PathParameter;
	/** Search: POST with `query`, `count` (and `cursor`, `sort`) in the body. */
	search?: boolean;
	/** List: one item with `results` and `nextCursor`, `count` in the query. */
	list?: boolean;
	/** Sends `cursor` for the next page. */
	cursor?: boolean;
}

/** TikTok, Facebook and Instagram operations -> routes. */
export const SOCIAL_ROUTES: Record<string, Record<string, SocialRoute>> = {
	tiktok: {
		search: { path: '/desearch/tiktok/search', search: true, list: true, cursor: true },
		getPost: { path: '/desearch/tiktok/post/{}', pathParameter: POST_ID },
		getProfile: { path: '/desearch/tiktok/profile/{}', pathParameter: USERNAME },
		getProfilePosts: {
			path: '/desearch/tiktok/profile/{}/posts',
			pathParameter: USERNAME,
			list: true,
			cursor: true,
		},
		getComments: {
			path: '/desearch/tiktok/comments/{}',
			pathParameter: POST_ID,
			list: true,
			cursor: true,
		},
		getHashtagPosts: {
			path: '/desearch/tiktok/hashtag/{}',
			pathParameter: HASHTAG,
			list: true,
			cursor: true,
		},
		getTrending: { path: '/desearch/tiktok/trending', list: true },
	},
	facebook: {
		search: { path: '/desearch/facebook/search', search: true, list: true, cursor: true },
		getPost: { path: '/desearch/facebook/post/{}', pathParameter: POST_ID },
		getProfile: {
			path: '/desearch/facebook/profile/{}',
			pathParameter: { name: 'profileId', label: 'Profile or Page', strip: '@' },
		},
		getProfilePosts: {
			path: '/desearch/facebook/profile/{}/posts',
			pathParameter: { name: 'profileId', label: 'Profile or Page', strip: '@' },
			list: true,
			cursor: true,
		},
		getComments: {
			path: '/desearch/facebook/comments/{}',
			pathParameter: POST_ID,
			list: true,
			cursor: true,
		},
		getHashtagPosts: {
			path: '/desearch/facebook/hashtag/{}',
			pathParameter: HASHTAG,
			list: true,
			cursor: true,
		},
	},
	instagram: {
		// Instagram search returns one page; the API rejects a cursor.
		search: { path: '/desearch/instagram/search', search: true, list: true },
		getPost: {
			path: '/desearch/instagram/media/{}',
			pathParameter: { name: 'postId', label: 'Post' },
		},
		getProfile: { path: '/desearch/instagram/profile/{}', pathParameter: USERNAME },
		getProfilePosts: {
			path: '/desearch/instagram/profile/{}/posts',
			pathParameter: USERNAME,
			list: true,
			cursor: true,
		},
		getComments: {
			path: '/desearch/instagram/comments/{}',
			pathParameter: { name: 'shortcode', label: 'Shortcode' },
			list: true,
			cursor: true,
		},
		getHashtagPosts: {
			path: '/desearch/instagram/hashtag/{}',
			pathParameter: HASHTAG,
			list: true,
			cursor: true,
		},
	},
};

async function runSocial(
	context: Context,
	resource: string,
	operation: string,
): Promise<IDataObject[]> {
	const route = SOCIAL_ROUTES[resource]?.[operation];
	if (route === undefined) {
		return unsupported(context, resource, operation);
	}
	const { parameter, request, text } = context;
	const cursor = route.cursor ? String(parameter('cursor', '') ?? '').trim() : '';

	let path = route.path;
	if (route.pathParameter !== undefined) {
		const { name, label, strip } = route.pathParameter;
		// Encoded so IDs with `/`, `?` or `#` (an Instagram URL, for example) stay one path segment.
		path = path.replace('{}', encodeURIComponent(text(name, label, strip)));
	}

	let response: IN8nHttpFullResponse;
	if (route.search) {
		const options = parameter('options', {}) as IDataObject;
		response = await request('POST', path, {
			body: compact({
				query: text('query', 'Query'),
				count: parameter('count', 10) as number,
				cursor,
				sort: resource === 'tiktok' ? String(options.sort ?? '').trim() : undefined,
			}),
		});
	} else if (route.list) {
		const qs: IDataObject = {};
		if (operation === 'getTrending') {
			qs.region = (String(parameter('region', 'US') ?? '').trim() || 'US').toUpperCase();
		}
		qs.count = parameter('count', 20);
		qs.cursor = cursor;
		response = await request('GET', path, { qs });
	} else {
		response = await request('GET', path);
	}

	return route.list ? [listPage(response)] : toItems(response.body);
}

function unsupported(context: Context, resource: string, operation: string): never {
	throw new NodeOperationError(
		context.self.getNode(),
		`The operation "${operation}" is not supported for "${resource}"`,
		{ itemIndex: context.itemIndex },
	);
}

/** Runs one operation for one input item and returns the JSON of its output items. */
export async function runDesearchOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const context = createContext(this, itemIndex);
	switch (resource) {
		case 'search':
			return await runSearch(context, operation);
		case 'webPage':
			return await runWebPage(context, operation);
		case 'x':
			return await runX(context, operation);
		case 'tiktok':
		case 'facebook':
		case 'instagram':
			return await runSocial(context, resource, operation);
	}
	return unsupported(context, resource, operation);
}
