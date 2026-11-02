// End-to-end smoke test of every operation added in 0.3.0, against the live Desearch API.
//
// It runs the built nodes' execute() (dist/, so build first) with the same minimal
// IExecuteFunctions the unit tests use (test/context.ts); only HTTP is real here.
// Each call uses the smallest count the API allows and prints one line:
// `PASS name`, `FAIL name: error` or `SKIP name: reason`. Where a TikTok, Facebook or
// Instagram list returns a next cursor, the next page is fetched once. The script exits
// with 1 when any call fails.
//
// Billed: every call is a normal, billed API call (a few cents in total). People Search
// exports are free. A People Search (a paid job) is started only with --with-people.
//
// Usage (Node.js 22.18 or later, which runs TypeScript directly):
//   npm run build
//   DESEARCH_API_KEY=... node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e-full-coverage.mts [--with-people]
// or: DESEARCH_API_KEY=... npm run e2e [-- --with-people]
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type {
	IDataObject,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
	INodeParameters,
	INodeType,
} from 'n8n-workflow';

import { createNodeExecuteContext } from '../test/context.ts';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url);

const apiKey = process.env.DESEARCH_API_KEY?.trim();
if (!apiKey) {
	process.stderr.write('Set DESEARCH_API_KEY to a Desearch API key.\n');
	process.exit(2);
}
const withPeople = process.argv.includes('--with-people');

const distNode = (path: string) => fileURLToPath(new URL(`dist/nodes/${path}`, root));
if (!existsSync(distNode('Desearch/Desearch.node.js'))) {
	process.stderr.write('dist/ is missing: run `npm run build` first.\n');
	process.exit(2);
}

// The CommonJS builds, as n8n loads them.
const { NodeHelpers } = require('n8n-workflow') as typeof import('n8n-workflow');
const { Desearch } = require(distNode('Desearch/Desearch.node.js')) as {
	Desearch: new () => INodeType;
};
const { DesearchPeopleSearch } = require(
	distNode('DesearchPeopleSearch/DesearchPeopleSearch.node.js'),
) as { DesearchPeopleSearch: new () => INodeType };

const searchNode = new Desearch();
const peopleNode = new DesearchPeopleSearch();

const nodeData = (nodeType: INodeType): INode => ({
	id: `e2e-${nodeType.description.name}`,
	name: nodeType.description.displayName,
	type: `n8n-nodes-desearch.${nodeType.description.name}`,
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
});

/** Query string as n8n's HTTP helper (axios + qs) builds it. */
function appendQuery(
	search: URLSearchParams,
	key: string,
	value: unknown,
	arrayFormat: IHttpRequestOptions['arrayFormat'],
) {
	if (value === undefined || value === null) return;
	if (!Array.isArray(value)) {
		search.append(key, String(value));
		return;
	}
	if (arrayFormat === 'comma') {
		search.append(key, value.join(','));
		return;
	}
	value.forEach((entry, index) => {
		const name =
			arrayFormat === 'repeat' ? key : arrayFormat === 'indices' ? `${key}[${index}]` : `${key}[]`;
		search.append(name, String(entry));
	});
}

/** helpers.httpRequestWithAuthentication for the Desearch API credential, over fetch. */
async function httpRequestWithAuthentication(
	credentialType: string,
	options: IHttpRequestOptions,
): Promise<unknown> {
	if (credentialType !== 'desearchApi') {
		throw new Error(`Unexpected credential type ${credentialType}`);
	}
	const url = new URL(options.url, options.baseURL);
	for (const [key, value] of Object.entries(options.qs ?? {})) {
		appendQuery(url.searchParams, key, value, options.arrayFormat);
	}
	const headers = new Headers();
	for (const [key, value] of Object.entries(options.headers ?? {})) {
		headers.set(key, String(value));
	}
	// The credential sends the key as is in the Authorization header.
	headers.set('Authorization', apiKey as string);

	const method = options.method ?? 'GET';
	const init: RequestInit = { method, headers, signal: AbortSignal.timeout(180_000) };
	if (options.body !== undefined && method !== 'GET') {
		init.body = JSON.stringify(options.body);
		if (!headers.has('content-type')) headers.set('Content-Type', 'application/json');
	}

	const reply = await fetch(url, init);
	const replyHeaders: IDataObject = {};
	reply.headers.forEach((value, key) => {
		replyHeaders[key] = value;
	});
	let body: unknown;
	if (options.encoding === 'arraybuffer') {
		body = Buffer.from(await reply.arrayBuffer());
	} else {
		const text = await reply.text();
		if (options.encoding === 'text') {
			body = text;
		} else {
			try {
				body = text === '' ? undefined : JSON.parse(text);
			} catch {
				body = text;
			}
		}
	}
	if (!options.ignoreHttpStatusErrors && reply.status >= 400) {
		throw new Error(`HTTP ${reply.status}: ${String(body).slice(0, 300)}`);
	}
	return options.returnFullResponse
		? { body, headers: replyHeaders, statusCode: reply.status, statusMessage: reply.statusText }
		: body;
}

const counts = { pass: 0, fail: 0, skip: 0 };
const line = (text: string) => process.stdout.write(`${text}\n`);

function describeError(error: unknown): string {
	const { message, description } = (error ?? {}) as { message?: string; description?: string };
	const text = message ?? String(error);
	return description && description !== text ? `${text} (${description})` : text;
}

function skip(name: string, reason: string) {
	counts.skip++;
	line(`SKIP ${name}: ${reason}`);
}

function fail(name: string, reason: string) {
	counts.fail++;
	line(`FAIL ${name}: ${reason}`);
}

type Check = (items: INodeExecutionData[]) => string | undefined;

/** Runs one node operation through execute() and prints PASS or FAIL. */
async function call(
	nodeType: INodeType,
	name: string,
	parameters: INodeParameters,
	check: Check = nonEmpty,
): Promise<INodeExecutionData[] | undefined> {
	try {
		const { description } = nodeType;
		const resolved =
			NodeHelpers.getNodeParameters(
				description.properties,
				parameters,
				true,
				false,
				null,
				description,
			) ?? {};
		const context = createNodeExecuteContext({
			node: nodeData(nodeType),
			parameters: [resolved],
			httpRequestWithAuthentication,
		});
		const [items] = (await nodeType.execute!.call(context)) as INodeExecutionData[][];
		const problem = check(items);
		if (problem) {
			fail(name, problem);
			return undefined;
		}
		counts.pass++;
		line(`PASS ${name}`);
		return items;
	} catch (error) {
		fail(name, describeError(error));
		return undefined;
	}
}

const nonEmpty: Check = (items) => (items.length > 0 ? undefined : 'no output items');

/** A TikTok, Facebook or Instagram list: one item with results and nextCursor. */
const listPage: Check = (items) => {
	if (items.length !== 1) return `expected 1 item, got ${items.length}`;
	const { results, nextCursor } = items[0].json;
	if (!Array.isArray(results)) return 'results is not a list';
	if (nextCursor !== null && typeof nextCursor !== 'string') return 'nextCursor is not a string';
	return undefined;
};

const binaryFile =
	(mimeType: string): Check =>
	(items) => {
		const file = items[0]?.binary?.data;
		if (!file) return 'no binary data';
		return file.mimeType === mimeType ? undefined : `mimeType is ${file.mimeType}`;
	};

/** A social list, then its next page once when it returned a cursor. */
async function listWithNextPage(name: string, parameters: INodeParameters) {
	const page = await call(searchNode, name, parameters, listPage);
	const nextCursor = page?.[0].json.nextCursor;
	if (typeof nextCursor === 'string') {
		await call(searchNode, `${name} (next page)`, { ...parameters, cursor: nextCursor }, listPage);
	}
	return page;
}

/** First non-empty value of `key` in the results of list pages. */
function firstFromResults(
	pages: Array<INodeExecutionData[] | undefined>,
	key: string,
): string | undefined {
	for (const page of pages) {
		for (const result of (page?.[0].json.results as IDataObject[] | undefined) ?? []) {
			const value = result[key];
			if (typeof value === 'string' && value !== '') return value;
			if (typeof value === 'number') return String(value);
		}
	}
	return undefined;
}

async function search() {
	await call(searchNode, 'search.aiWebLinksSearch', {
		operation: 'aiWebLinksSearch',
		prompt: 'Bittensor subnet news',
		count: 10,
	});
	await call(searchNode, 'search.aiXLinksSearch', {
		operation: 'aiXLinksSearch',
		prompt: 'Bittensor',
		count: 10,
	});
	await call(searchNode, 'search.searchApi', {
		operation: 'searchApi',
		query: 'What is Bittensor?',
		count: 10,
	});
	await call(
		searchNode,
		'webPage.extract',
		{ resource: 'webPage', url: 'https://desearch.ai', format: 'text' },
		(items) =>
			typeof items[0]?.json.content === 'string' && items[0].json.content !== ''
				? undefined
				: 'no content',
	);
}

async function x() {
	const x = (parameters: INodeParameters) => ({ resource: 'x', ...parameters });
	const timeline = await call(
		searchNode,
		'x.getUserPosts',
		x({
			operation: 'getUserPosts',
			username: 'elonmusk',
		}),
	);
	const tweets = (timeline?.[0].json.tweets as IDataObject[] | undefined) ?? [];
	// Fall back to a long-lived public post when the timeline gave none.
	const postId = typeof tweets[0]?.id === 'string' ? tweets[0].id : '20';
	const postUrl =
		typeof tweets[0]?.url === 'string' ? tweets[0].url : 'https://x.com/jack/status/20';

	await call(searchNode, 'x.getPost', x({ operation: 'getPost', postId }));
	await call(searchNode, 'x.getPostsByUrls', x({ operation: 'getPostsByUrls', urls: postUrl }));
	await call(
		searchNode,
		'x.searchUserPosts',
		x({
			operation: 'searchUserPosts',
			username: 'elonmusk',
			count: 1,
		}),
	);
	await call(
		searchNode,
		'x.getUserReplies',
		x({
			operation: 'getUserReplies',
			username: 'elonmusk',
			count: 1,
		}),
	);
	await call(searchNode, 'x.getPostReplies', x({ operation: 'getPostReplies', postId, count: 1 }));
	await call(searchNode, 'x.getRetweeters', x({ operation: 'getRetweeters', postId }));
	await call(searchNode, 'x.getTrends', x({ operation: 'getTrends', woeid: 1, count: 30 }));
}

async function tiktok() {
	const t = (parameters: INodeParameters) => ({ resource: 'tiktok', ...parameters });
	const found = await listWithNextPage(
		'tiktok.search',
		t({ operation: 'search', query: 'ai', count: 2 }),
	);
	await call(searchNode, 'tiktok.getProfile', t({ operation: 'getProfile', username: 'tiktok' }));
	const posts = await listWithNextPage(
		'tiktok.getProfilePosts',
		t({ operation: 'getProfilePosts', username: 'tiktok', count: 2 }),
	);
	const hashtag = await listWithNextPage(
		'tiktok.getHashtagPosts',
		t({ operation: 'getHashtagPosts', hashtag: 'ai', count: 2 }),
	);
	await call(
		searchNode,
		'tiktok.getTrending',
		t({ operation: 'getTrending', region: 'US', count: 2 }),
		listPage,
	);
	const videoId = firstFromResults([posts, found, hashtag], 'id');
	if (videoId === undefined) {
		fail('tiktok.getPost', 'no video ID from the lists above');
		fail('tiktok.getComments', 'no video ID from the lists above');
		return;
	}
	await call(searchNode, 'tiktok.getPost', t({ operation: 'getPost', postId: videoId }));
	await listWithNextPage(
		'tiktok.getComments',
		t({ operation: 'getComments', postId: videoId, count: 2 }),
	);
}

async function facebook() {
	const f = (parameters: INodeParameters) => ({ resource: 'facebook', ...parameters });
	await listWithNextPage('facebook.search', f({ operation: 'search', query: 'ai', count: 2 }));
	await call(
		searchNode,
		'facebook.getProfile',
		f({ operation: 'getProfile', profileId: 'facebook' }),
	);
	const posts = await listWithNextPage(
		'facebook.getProfilePosts',
		f({ operation: 'getProfilePosts', profileId: 'facebook', count: 2 }),
	);
	await listWithNextPage(
		'facebook.getHashtagPosts',
		f({ operation: 'getHashtagPosts', hashtag: 'ai', count: 2 }),
	);
	const postId = firstFromResults([posts], 'id');
	if (postId === undefined) {
		fail('facebook.getPost', 'no post ID from Get Profile Posts');
		fail('facebook.getComments', 'no post ID from Get Profile Posts');
		return;
	}
	await call(searchNode, 'facebook.getPost', f({ operation: 'getPost', postId }));
	await listWithNextPage('facebook.getComments', f({ operation: 'getComments', postId, count: 2 }));
}

async function instagram() {
	const i = (parameters: INodeParameters) => ({ resource: 'instagram', ...parameters });
	await call(
		searchNode,
		'instagram.search',
		i({ operation: 'search', query: 'instagram', count: 2 }),
		listPage,
	);
	await call(
		searchNode,
		'instagram.getProfile',
		i({ operation: 'getProfile', username: 'instagram' }),
	);
	const posts = await listWithNextPage(
		'instagram.getProfilePosts',
		i({ operation: 'getProfilePosts', username: 'instagram', count: 2 }),
	);
	const hashtag = await listWithNextPage(
		'instagram.getHashtagPosts',
		i({ operation: 'getHashtagPosts', hashtag: 'ai', count: 2 }),
	);
	const shortcode = firstFromResults([posts, hashtag], 'shortcode');
	if (shortcode === undefined) {
		fail('instagram.getPost', 'no shortcode from the lists above');
		fail('instagram.getComments', 'no shortcode from the lists above');
		return;
	}
	await call(searchNode, 'instagram.getPost', i({ operation: 'getPost', postId: shortcode }));
	await listWithNextPage(
		'instagram.getComments',
		i({ operation: 'getComments', shortcode, count: 2 }),
	);
}

async function people() {
	// Free: no People Search is started.
	await call(
		peopleNode,
		'people.profile.export',
		{ resource: 'profile', operation: 'export', platform: 'x', format: 'csv' },
		binaryFile('text/csv'),
	);

	let taskId: string | undefined;
	if (withPeople) {
		line('NOTE --with-people: starting a People Search for 5 people on X (billed)');
		const started = await call(peopleNode, 'people.search.start', {
			resource: 'search',
			operation: 'start',
			platform: 'x',
			query: 'Indie hackers building in public who share their MRR',
			count: 5,
		});
		taskId = started?.[0].json.task_id as string | undefined;
	} else {
		// Export an existing search instead (listing searches is free).
		const tasks = await call(
			peopleNode,
			'people.search.getAll (find an existing search)',
			{ resource: 'search', operation: 'getAll', returnAll: false, limit: 1 },
			() => undefined,
		);
		taskId = tasks?.[0]?.json.task_id as string | undefined;
	}
	if (taskId === undefined) {
		skip(
			'people.search.exportResults',
			withPeople
				? 'the search did not start'
				: 'no People Search yet; pass --with-people to start one',
		);
		return;
	}
	await call(
		peopleNode,
		'people.search.exportResults',
		{
			resource: 'search',
			operation: 'exportResults',
			taskId,
			waitForCompletion: withPeople,
			timeout: 600,
			format: 'jsonl',
		},
		binaryFile('application/x-ndjson'),
	);
}

await search();
await x();
await tiktok();
await facebook();
await instagram();
await people();

line(`${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped`);
process.exit(counts.fail > 0 ? 1 : 0);
