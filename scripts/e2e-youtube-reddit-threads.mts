// End-to-end smoke test of the YouTube, Reddit and Threads operations, against a live Desearch API.
//
// It runs the built Desearch node's execute() (dist/, so build first) with the same minimal
// IExecuteFunctions the unit tests use (test/context.ts); only HTTP is real here. It runs every
// operation once, the next page of every list that returns a cursor, and checks that a tampered
// cursor fails with a 422. One line per call: `PASS name`, `FAIL name: error` or `SKIP name: reason`.
// A call that fails with HTTP 5xx (a known transient provider error) is retried once. The script
// exits with 1 when any call fails.
//
// Billed: $0.00207 per request, about $0.05 a run.
//
// The key is read from the environment variable --key-env names (default DESEARCH_API_KEY), or from
// ~/.config/desearch/e2e.env when the environment does not set it. It is never printed. The node
// always calls https://api.desearch.ai; --base-url sends those requests to another deployment.
//
// Usage (Node.js 22.18 or later, which runs TypeScript directly):
//   npm run build
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e-youtube-reddit-threads.mts \
//     [--base-url https://api-dev.desearch.ai] [--key-env DESEARCH_DEV_API_KEY]
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
const NODE_API_URL = 'https://api.desearch.ai';

function option(name: string, fallback: string): string {
	const index = process.argv.indexOf(name);
	return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const baseUrl = option('--base-url', NODE_API_URL).replace(/\/+$/, '');
const keyEnv = option('--key-env', 'DESEARCH_API_KEY');

function loadEnvFile() {
	const path = join(homedir(), '.config', 'desearch', 'e2e.env');
	if (!existsSync(path)) return;
	for (const raw of readFileSync(path, 'utf8').split('\n')) {
		const entry = raw.trim();
		if (!entry || entry.startsWith('#') || !entry.includes('=')) continue;
		const [key, ...rest] = entry.split('=');
		const value = rest.join('=');
		if (value && !process.env[key]) process.env[key] = value;
	}
}

loadEnvFile();
const apiKey = process.env[keyEnv]?.trim();
if (!apiKey) {
	process.stderr.write(`Set ${keyEnv} (or add it to ~/.config/desearch/e2e.env).\n`);
	process.exit(2);
}

const distNode = (path: string) => fileURLToPath(new URL(`dist/nodes/${path}`, root));
if (!existsSync(distNode('Desearch/Desearch.node.js'))) {
	process.stderr.write('dist/ is missing: run `npm run build` first.\n');
	process.exit(2);
}

// The CommonJS build, as n8n loads it.
const { NodeHelpers } = require('n8n-workflow') as typeof import('n8n-workflow');
const { Desearch } = require(distNode('Desearch/Desearch.node.js')) as {
	Desearch: new () => INodeType;
};
const searchNode = new Desearch();

const nodeData: INode = {
	id: 'e2e-desearch',
	name: 'Desearch',
	type: 'n8n-nodes-desearch.desearch',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const totals = { pass: 0, fail: 0, skip: 0, requests: 0, costUsd: 0, retries: 0 };
const line = (text: string) =>
	process.stdout.write(`${text.split(apiKey as string).join('***')}\n`);

async function send(url: URL, init: RequestInit): Promise<Response> {
	const reply = await fetch(url, init);
	if (reply.status < 500) return reply;
	totals.retries++;
	line(`  retrying after HTTP ${reply.status}`);
	return await fetch(url, init);
}

/** helpers.httpRequestWithAuthentication for the Desearch API credential, over fetch. */
async function httpRequestWithAuthentication(
	credentialType: string,
	options: IHttpRequestOptions,
): Promise<unknown> {
	if (credentialType !== 'desearchApi') {
		throw new Error(`Unexpected credential type ${credentialType}`);
	}
	if (!options.url.startsWith(NODE_API_URL)) {
		throw new Error(`Unexpected URL ${options.url}`);
	}
	const url = new URL(`${baseUrl}${options.url.slice(NODE_API_URL.length)}`);
	for (const [key, value] of Object.entries(options.qs ?? {})) {
		if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
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
	}

	const reply = await send(url, init);
	totals.requests++;
	totals.costUsd += Number(reply.headers.get('x-desearch-cost-usd') ?? 0) || 0;
	const replyHeaders: IDataObject = {};
	reply.headers.forEach((value, key) => {
		replyHeaders[key] = value;
	});
	const text = await reply.text();
	let body: unknown;
	try {
		body = text === '' ? undefined : JSON.parse(text);
	} catch {
		body = text;
	}
	return { body, headers: replyHeaders, statusCode: reply.status, statusMessage: reply.statusText };
}

function describeError(error: unknown): string {
	const { message, description, httpCode } = (error ?? {}) as {
		message?: string;
		description?: string;
		httpCode?: string;
	};
	const text = message ?? String(error);
	const parts = [httpCode ? `HTTP ${httpCode}` : '', text, description !== text ? description : ''];
	return parts.filter(Boolean).join(': ');
}

type Check = (items: INodeExecutionData[]) => string | undefined;

/** Runs one Desearch operation through execute(), with defaults filled in as n8n does. */
async function execute(parameters: INodeParameters): Promise<INodeExecutionData[]> {
	const { description } = searchNode;
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
		node: nodeData,
		parameters: [resolved],
		httpRequestWithAuthentication,
	});
	const [items] = (await searchNode.execute!.call(context)) as INodeExecutionData[][];
	return items;
}

/** Runs one operation and prints PASS or FAIL. */
async function call(
	name: string,
	parameters: INodeParameters,
	check: Check,
	detail: (items: INodeExecutionData[]) => string = () => '',
): Promise<INodeExecutionData[] | undefined> {
	try {
		const items = await execute(parameters);
		const problem = check(items);
		if (problem) {
			totals.fail++;
			line(`FAIL ${name}: ${problem}`);
			return undefined;
		}
		totals.pass++;
		const extra = detail(items);
		line(`PASS ${name}${extra ? ` (${extra})` : ''}`);
		return items;
	} catch (error) {
		totals.fail++;
		line(`FAIL ${name}: ${describeError(error)}`);
		return undefined;
	}
}

/** Runs one operation that must fail with HTTP `httpCode`; prints PASS or FAIL. */
async function expectHttpError(name: string, parameters: INodeParameters, httpCode: string) {
	try {
		await execute(parameters);
	} catch (error) {
		if ((error as { httpCode?: string }).httpCode === httpCode) {
			totals.pass++;
			line(`PASS ${name}`);
		} else {
			totals.fail++;
			line(`FAIL ${name}: ${describeError(error)}`);
		}
		return;
	}
	totals.fail++;
	line(`FAIL ${name}: expected HTTP ${httpCode}, got a success`);
}

/** An object operation: one output item that has `key`. */
const object =
	(key: string): Check =>
	(items) => {
		if (items.length !== 1) return `expected 1 item, got ${items.length}`;
		const value = items[0].json[key];
		return value === undefined || value === null ? `no ${key}` : undefined;
	};

/** A list operation: one item with `results` (non-empty unless allowed) and `nextCursor`. */
const listPage =
	({ allowEmpty = false, pages = true } = {}): Check =>
	(items) => {
		if (items.length !== 1) return `expected 1 item, got ${items.length}`;
		const { results, nextCursor } = items[0].json;
		if (!Array.isArray(results)) return 'results is not a list';
		if (!allowEmpty && results.length === 0) return 'no results';
		if (nextCursor !== null && typeof nextCursor !== 'string') return 'nextCursor is not a string';
		if (!pages && nextCursor !== null) return 'this operation does not page but sent a cursor';
		return undefined;
	};

const describePage = (items: INodeExecutionData[]) =>
	`${(items[0].json.results as unknown[]).length} results, next cursor: ${
		items[0].json.nextCursor ? 'yes' : 'no'
	}`;

/** A list, then its next page with the cursor. With `cursorRequired`, page 1 must send one. */
async function listWithNextPage(
	name: string,
	parameters: INodeParameters,
	{ cursorRequired = true } = {},
): Promise<IDataObject[]> {
	const page = await call(name, parameters, listPage(), describePage);
	if (!page) return [];
	const nextCursor = page[0].json.nextCursor;
	if (typeof nextCursor === 'string') {
		await call(
			`${name} (next page)`,
			{ ...parameters, cursor: nextCursor },
			listPage({ allowEmpty: true }),
			describePage,
		);
	} else if (cursorRequired) {
		totals.fail++;
		line(`FAIL ${name} (next page): the first page sent no x-desearch-next-cursor`);
	} else {
		totals.skip++;
		line(`SKIP ${name} (next page): the first page was the last`);
	}
	return page[0].json.results as IDataObject[];
}

async function youtube() {
	const yt = (parameters: INodeParameters) => ({ resource: 'youtube', ...parameters });
	await listWithNextPage(
		'youtube.search',
		yt({ operation: 'search', query: 'bittensor', options: { type: 'videos' } }),
	);
	await call(
		'youtube.getVideo',
		yt({ operation: 'getVideo', videoId: 'dQw4w9WgXcQ' }),
		object('title'),
		(items) => String(items[0].json.title),
	);
	await call(
		'youtube.getVideo (by URL)',
		yt({ operation: 'getVideo', videoId: 'https://youtu.be/dQw4w9WgXcQ' }),
		object('id'),
	);
	await call(
		'youtube.getTranscript',
		yt({ operation: 'getTranscript', videoId: 'dQw4w9WgXcQ', options: { language: 'en' } }),
		(items) =>
			object('text')(items) ??
			((items[0].json.segments as unknown[] | undefined)?.length ? undefined : 'no segments'),
		(items) => `${(items[0].json.segments as unknown[]).length} segments`,
	);
	await listWithNextPage(
		'youtube.getComments',
		yt({ operation: 'getComments', videoId: 'dQw4w9WgXcQ', options: { order: 'top' } }),
	);
	await call(
		'youtube.getChannel',
		yt({ operation: 'getChannel', channel: '@MrBeast' }),
		object('id'),
		(items) => `${items[0].json.subscribers} subscribers`,
	);
	await listWithNextPage(
		'youtube.getChannelVideos',
		yt({ operation: 'getChannelVideos', channel: '@MrBeast', options: { sort: 'latest' } }),
	);
}

async function reddit() {
	const r = (parameters: INodeParameters) => ({ resource: 'reddit', ...parameters });
	await listWithNextPage(
		'reddit.search',
		r({ operation: 'search', query: 'bittensor', options: { sort: 'new' } }),
	);
	await call(
		'reddit.getSubreddit',
		r({ operation: 'getSubreddit', subreddit: 'r/AskReddit' }),
		object('name'),
		(items) => `${items[0].json.weeklyActiveUsers} weekly active users`,
	);
	const posts = await listWithNextPage(
		'reddit.getSubredditPosts',
		r({
			operation: 'getSubredditPosts',
			subreddit: 'AskReddit',
			options: { sort: 'top', timeframe: 'week' },
		}),
	);
	// A busy post, so its comments have a next page. Falls back to a known post.
	const top = posts.find((post) => typeof post.id === 'string' && typeof post.url === 'string');
	const postUrl = (top?.url as string) ?? 'https://www.reddit.com/r/webscraping/comments/1q6pxwn/';
	await call(
		'reddit.getPost (by URL)',
		r({ operation: 'getPost', postId: postUrl }),
		object('id'),
		(items) => `${items[0].json.id}, ${items[0].json.commentCount} comments`,
	);
	await listWithNextPage(
		'reddit.getComments',
		r({ operation: 'getComments', postId: (top?.id as string) ?? '1q6pxwn' }),
		{ cursorRequired: top !== undefined },
	);
	await expectHttpError(
		'reddit.search (tampered cursor is a 422)',
		r({ operation: 'search', query: 'bittensor', cursor: 'tampered' }),
		'422',
	);
}

async function threads() {
	const t = (parameters: INodeParameters) => ({ resource: 'threads', ...parameters });
	await call(
		'threads.search',
		t({ operation: 'search', query: 'bittensor' }),
		listPage({ pages: false }),
		describePage,
	);
	await call(
		'threads.searchUsers',
		t({ operation: 'searchUsers', query: 'zuck' }),
		listPage({ pages: false }),
		describePage,
	);
	await call(
		'threads.getProfile',
		t({ operation: 'getProfile', username: '@zuck' }),
		object('username'),
		(items) => `${items[0].json.followers} followers`,
	);
	await call(
		'threads.getProfilePosts',
		t({ operation: 'getProfilePosts', username: 'zuck' }),
		listPage({ pages: false }),
		describePage,
	);
	await call(
		'threads.getPost (by URL)',
		t({ operation: 'getPost', postId: 'https://www.threads.com/@zuck/post/DK-BydcJHkF' }),
		(items) =>
			object('code')(items) ??
			(Array.isArray(items[0].json.comments) ? undefined : 'no comments list'),
		(items) => `${(items[0].json.comments as unknown[]).length} replies`,
	);
}

line(`Base URL: ${baseUrl}`);
await youtube();
await reddit();
await threads();

line(
	`${totals.requests} requests, $${totals.costUsd.toFixed(5)} billed (X-Desearch-Cost-Usd total), ${totals.retries} retried`,
);
line(`${totals.pass} passed, ${totals.fail} failed, ${totals.skip} skipped`);
process.exit(totals.fail > 0 ? 1 : 0);
