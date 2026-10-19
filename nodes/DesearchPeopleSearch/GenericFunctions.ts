import {
	NodeApiError,
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INode,
	type JsonObject,
} from 'n8n-workflow';

export const DESEARCH_API_URL = 'https://api.desearch.ai';

export type PeoplePlatform = 'x' | 'youtube' | 'linkedin' | 'tiktok';

/**
 * Search filters each platform accepts inside the Start body's `filters` object.
 * The API rejects any other key, so filters that do not apply to the chosen
 * platform are left out of the request.
 */
export const PEOPLE_SEARCH_FILTERS: Record<PeoplePlatform, readonly string[]> = {
	x: [
		'min_followers',
		'max_followers',
		'verified_only',
		'countries',
		'keywords',
		'exclude_keywords',
	],
	youtube: [
		'min_subscribers',
		'max_subscribers',
		'countries',
		'require_contact',
		'keywords',
		'exclude_keywords',
	],
	linkedin: ['min_followers', 'max_followers', 'countries', 'keywords', 'exclude_keywords'],
	tiktok: ['min_followers', 'max_followers', 'require_contact', 'keywords', 'exclude_keywords'],
};

/** Node parameter name in the Start "Filters" collection -> API filter name. */
export const SEARCH_FILTER_PARAMETERS: Record<string, string> = {
	countries: 'countries',
	excludeKeywords: 'exclude_keywords',
	keywords: 'keywords',
	maxFollowers: 'max_followers',
	maxSubscribers: 'max_subscribers',
	minFollowers: 'min_followers',
	minSubscribers: 'min_subscribers',
	requireContact: 'require_contact',
	verifiedOnly: 'verified_only',
};

/** API filters that take a list of strings. */
const LIST_FILTERS = new Set(['countries', 'keywords', 'exclude_keywords']);

/** Platforms whose people can be filtered by `verified` when listing profiles. */
const VERIFIED_PLATFORMS = new Set(['x', 'tiktok']);

/** Statuses after which a search does not change again and its results can be read. */
const FINISHED_STATUSES = new Set(['completed', 'partial', 'cancelled']);

/** Largest `limit` each paginated route accepts. */
export const MAX_PAGE_SIZE = {
	results: 500,
	tasks: 100,
	profiles: 200,
} as const;

/** Splits a comma or newline separated string (or an array) into trimmed, non-empty strings. */
export function splitList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const parts: unknown[] = Array.isArray(value) ? value : String(value).split(/[,\n]/);
	return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

function numberOrUndefined(value: unknown): number | undefined {
	if (!isSet(value)) {
		return undefined;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}

export function isPeoplePlatform(value: unknown): value is PeoplePlatform {
	return (
		typeof value === 'string' && Object.prototype.hasOwnProperty.call(PEOPLE_SEARCH_FILTERS, value)
	);
}

/** Path of one search task, e.g. taskPath(id, '/pause'). */
export function taskPath(taskId: string, suffix = ''): string {
	return `/desearch/people/tasks/${encodeURIComponent(taskId)}${suffix}`;
}

/**
 * The reason the API gives for an error. The API puts it in `detail`: a string,
 * or a list of validation errors (`[{ loc, msg }]`).
 */
export function apiErrorDetail(body: unknown): string | undefined {
	if (typeof body === 'string') {
		// Plain-text bodies only: an HTML error page (for example from a proxy) says nothing useful.
		const text = body.trim();
		return text === '' || text.startsWith('<') ? undefined : text.slice(0, 500);
	}
	const detail = (body as IDataObject | undefined)?.detail;
	if (typeof detail === 'string') {
		return detail;
	}
	if (Array.isArray(detail)) {
		const messages = detail.map((entry) => {
			const { loc, msg } = (entry ?? {}) as IDataObject;
			const field = Array.isArray(loc) ? loc.filter((part) => part !== 'body').join('.') : '';
			const text = typeof msg === 'string' ? msg : JSON.stringify(entry);
			return field === '' ? text : `${field}: ${text}`;
		});
		return messages.length > 0 ? messages.join('; ') : undefined;
	}
	return undefined;
}

/** A node error for an HTTP error response, with the API's reason as its description. */
export function apiError(
	node: INode,
	statusCode: number,
	body: unknown,
	itemIndex: number,
): NodeApiError {
	const errorBody = (
		body !== null && typeof body === 'object' ? body : { detail: body }
	) as JsonObject;
	return new NodeApiError(node, errorBody, {
		httpCode: String(statusCode),
		description: apiErrorDetail(body),
		itemIndex,
	});
}

/** Keeps errors n8n already understands; wraps anything else in a NodeOperationError. */
export function asNodeError(
	node: INode,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		return error;
	}
	return new NodeOperationError(node, error as Error, { itemIndex });
}

/**
 * Calls the People Search API with the node's Desearch credential.
 * HTTP errors fail the item with the reason the API gives (for example
 * "Not enough credits" or why a task cannot be paused) instead of a generic message.
 */
export async function peopleApiRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	method: IHttpRequestMethods,
	path: string,
	{ qs, body, headers }: { qs?: IDataObject; body?: IDataObject; headers?: IDataObject } = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${DESEARCH_API_URL}${path}`,
		headers: {
			Accept: 'application/json',
			...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			...headers,
		},
		json: true,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	};
	if (qs !== undefined) {
		options.qs = Object.fromEntries(Object.entries(qs).filter(([, value]) => isSet(value)));
	}
	if (body !== undefined) {
		options.body = body;
	}

	let response: IN8nHttpFullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'desearchApi',
			options,
		)) as IN8nHttpFullResponse;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}
	if (response.statusCode >= 400) {
		throw apiError(this.getNode(), response.statusCode, response.body, itemIndex);
	}
	return (response.body ?? {}) as IDataObject;
}

/** Body and headers of `POST /desearch/people/search/{platform}`. */
export function buildStartSearchRequest(
	node: INode,
	itemIndex: number,
	{
		platform,
		query,
		count,
		searchOptions,
		searchFilters,
	}: {
		platform: unknown;
		query: unknown;
		count: unknown;
		searchOptions: IDataObject;
		searchFilters: IDataObject;
	},
): { path: string; body: IDataObject; headers: IDataObject } {
	if (!isPeoplePlatform(platform)) {
		throw new NodeOperationError(node, `Unknown platform "${String(platform)}"`, {
			itemIndex,
			description: 'Use x, youtube, linkedin or tiktok.',
		});
	}
	const allowedFilters = PEOPLE_SEARCH_FILTERS[platform];

	const body: IDataObject = { query: String(query ?? '').trim(), count: count as number };

	const minScore = numberOrUndefined(searchOptions.minScore);
	if (minScore !== undefined) {
		body.min_score = minScore;
	}
	const exclude = splitList(searchOptions.exclude);
	if (exclude.length > 0) {
		body.exclude = exclude;
	}

	const filters: IDataObject = {};
	for (const [parameter, value] of Object.entries(searchFilters)) {
		const name = SEARCH_FILTER_PARAMETERS[parameter];
		if (!name || !allowedFilters.includes(name) || !isSet(value)) {
			continue;
		}
		if (LIST_FILTERS.has(name)) {
			const list = splitList(value);
			if (list.length > 0) {
				filters[name] = list;
			}
		} else {
			filters[name] = value;
		}
	}
	if (Object.keys(filters).length > 0) {
		body.filters = filters;
	}

	const headers: IDataObject = {};
	const idempotencyKey = String(searchOptions.idempotencyKey ?? '').trim();
	if (idempotencyKey !== '') {
		headers['Idempotency-Key'] = idempotencyKey;
	}

	return { path: `/desearch/people/search/${platform}`, body, headers };
}

/** Query string of `GET /desearch/people/tasks`. */
export function buildListTasksQuery(filters: IDataObject): IDataObject {
	const qs: IDataObject = {};
	if (isSet(filters.platform)) {
		qs.platform = filters.platform;
	}
	const statuses = splitList(filters.status);
	if (statuses.length > 0) {
		qs.status = statuses.join(',');
	}
	return qs;
}

/** Query string of `GET /desearch/people/profiles`. */
export function buildListProfilesQuery(
	platform: string,
	sort: string,
	filters: IDataObject,
): IDataObject {
	const qs: IDataObject = { platform, sort };
	const searchText = String(filters.searchText ?? '').trim();
	if (searchText !== '') {
		qs.q = searchText;
	}
	const has = splitList(filters.has);
	if (has.length > 0) {
		qs.has = has.join(',');
	}
	const numberFilters: Array<[string, string]> = [
		['minAudience', 'min_audience'],
		['maxAudience', 'max_audience'],
		['minScore', 'min_score'],
	];
	for (const [parameter, name] of numberFilters) {
		const value = numberOrUndefined(filters[parameter]);
		if (value !== undefined) {
			qs[name] = value;
		}
	}
	const location = String(filters.location ?? '').trim();
	if (location !== '') {
		qs.location = location;
	}
	if (filters.verifiedOnly === true && VERIFIED_PLATFORMS.has(platform)) {
		qs.verified = true;
	}
	return qs;
}

/**
 * Reads `limit` + `cursor` pages until `limit` entries are collected (Infinity for all)
 * or the route says there are no more. Returns the entries of `listProperty`.
 */
export async function collectPages(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
	qs: IDataObject,
	{
		listProperty,
		maxPageSize,
		limit,
		hasMorePages,
	}: {
		listProperty: string;
		maxPageSize: number;
		limit: number;
		hasMorePages: (page: IDataObject) => boolean;
	},
): Promise<IDataObject[]> {
	const entries: IDataObject[] = [];
	let cursor: string | undefined;

	for (;;) {
		const page = await peopleApiRequest.call(this, itemIndex, 'GET', path, {
			qs: { ...qs, limit: Math.min(maxPageSize, limit - entries.length), cursor },
		});
		const pageEntries = Array.isArray(page[listProperty])
			? (page[listProperty] as IDataObject[])
			: [];
		entries.push(...pageEntries.slice(0, limit - entries.length));

		const nextCursor =
			typeof page.next_cursor === 'string' && page.next_cursor !== ''
				? page.next_cursor
				: undefined;
		if (
			entries.length >= limit ||
			pageEntries.length === 0 ||
			nextCursor === undefined ||
			!hasMorePages(page)
		) {
			return entries;
		}
		cursor = nextCursor;
	}
}

function describeTaskErrors(task: IDataObject): string | undefined {
	const errors = Array.isArray(task.errors) ? task.errors : [];
	const text = errors
		.map((error) => {
			if (typeof error === 'string') {
				return error;
			}
			const object = (error ?? {}) as IDataObject;
			return String(object.message ?? object.detail ?? JSON.stringify(error));
		})
		.filter((message) => message !== '')
		.join('; ');
	return text === '' ? undefined : text;
}

/**
 * Polls `GET /desearch/people/tasks/{task_id}` every `pollSeconds` until the search
 * has finished, and returns the finished task. Fails when the search failed, is
 * paused, expired, or is still running after `timeoutSeconds`.
 */
export async function waitForTask(
	this: IExecuteFunctions,
	itemIndex: number,
	taskId: string,
	timeoutSeconds: number,
	pollSeconds: number,
): Promise<IDataObject> {
	const node = this.getNode();
	const timeout = Math.max(0, Number(timeoutSeconds) || 0);
	const pollMilliseconds = Math.max(1, Number(pollSeconds) || 15) * 1000;
	const deadline = Date.now() + timeout * 1000;
	const cancelSignal = this.getExecutionCancelSignal?.();

	for (;;) {
		if (cancelSignal?.aborted) {
			throw new NodeOperationError(
				node,
				'The execution was cancelled while waiting for the search',
				{ itemIndex },
			);
		}

		const task = await peopleApiRequest.call(this, itemIndex, 'GET', taskPath(taskId));
		const status = String(task.status ?? '');
		if (FINISHED_STATUSES.has(status)) {
			return task;
		}

		const found = `${task.result_count ?? 0} of ${task.count ?? '?'} people`;
		if (status === 'failed') {
			throw new NodeOperationError(node, 'The search failed', {
				itemIndex,
				description:
					describeTaskErrors(task) ??
					`Task ${taskId} failed. A search that delivers no people is not charged.`,
			});
		}
		if (status === 'expired') {
			throw new NodeOperationError(node, 'The search results expired', {
				itemIndex,
				description: `Task ${taskId}: results are kept for 30 days after a search ends.`,
			});
		}
		if (status === 'paused') {
			throw new NodeOperationError(node, 'The search is paused', {
				itemIndex,
				description: `Task ${taskId} found ${found} before it was paused. Resume it, then get its results again.`,
			});
		}

		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			throw new NodeOperationError(node, `The search did not finish within ${timeout} seconds`, {
				itemIndex,
				description: `Task ${taskId} is ${status || 'still running'} with ${found} found so far. It keeps running in the background: get its results again later with this task ID, or raise Timeout.`,
			});
		}

		await sleep(Math.min(pollMilliseconds, remaining));
	}
}
