import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INodeParameters,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { createSearchContext, response, searchNode } from './helpers';

const API = 'https://api.desearch.ai';
const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };
const NEXT = 'x-desearch-next-cursor';

/** The parts of a request a test checks. Keys that are not set are left out. */
function sentRequest(options: IHttpRequestOptions) {
	const { method, url, qs, body, headers, encoding, arrayFormat } = options;
	return Object.fromEntries(
		Object.entries({ method, url, qs, body, headers, encoding, arrayFormat }).filter(
			([, value]) => value !== undefined,
		),
	);
}

interface Case {
	parameters: INodeParameters;
	request: IDataObject;
	reply: IN8nHttpFullResponse;
	output: IDataObject[];
}

async function run({ parameters, reply }: Pick<Case, 'parameters' | 'reply'>) {
	const { context, httpRequestWithAuthentication } = createSearchContext(parameters, {
		http: () => reply,
	});
	const [output] = await searchNode.execute.call(context);
	expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	const [credentialType, options] = httpRequestWithAuthentication.mock.calls[0];
	expect(credentialType).toBe('desearchApi');
	expect(options).toMatchObject({
		json: options.encoding === undefined,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	});
	return { output, request: sentRequest(options) };
}

/** Runs every case: checks the request it sends and the items it outputs. */
function itSends(cases: Record<string, Case>) {
	it.each(Object.entries(cases))('%s', async (_name, testCase) => {
		const { output, request } = await run(testCase);
		expect(request).toEqual(testCase.request);
		expect(output).toEqual(testCase.output.map((json) => ({ json, pairedItem: { item: 0 } })));
	});
}

const tweet = (id: string) => ({ id, text: `post ${id}`, url: `https://x.com/u/status/${id}` });
const video = (id: string) => ({ id, url: `https://www.tiktok.com/@u/video/${id}` });

describe('Search', () => {
	itSends({
		'AI Web Links Search sends the prompt, the web tool and the count': {
			parameters: { operation: 'aiWebLinksSearch', prompt: 'What are the recent sport events?' },
			request: {
				method: 'POST',
				url: `${API}/desearch/ai/search/links/web`,
				headers: JSON_HEADERS,
				body: { prompt: 'What are the recent sport events?', tools: ['web'], count: 10 },
			},
			reply: response({ search_results: [{ link: 'https://a.example', snippet: 's' }] }),
			output: [{ search_results: [{ link: 'https://a.example', snippet: 's' }] }],
		},
		'AI Web Links Search sends the options, dates in UTC': {
			parameters: {
				operation: 'aiWebLinksSearch',
				prompt: 'sport',
				count: 25,
				options: {
					startDate: '2025-05-01T00:00:00',
					endDate: '2025-05-03T12:30:00.000+02:00',
					highlights: false,
					pageText: true,
				},
			},
			request: {
				method: 'POST',
				url: `${API}/desearch/ai/search/links/web`,
				headers: JSON_HEADERS,
				body: {
					prompt: 'sport',
					tools: ['web'],
					count: 25,
					start_date: '2025-05-01T00:00:00Z',
					end_date: '2025-05-03T10:30:00Z',
					highlights: false,
					page_text: true,
				},
			},
			reply: response({ search_results: [] }),
			output: [{ search_results: [] }],
		},
		'AI X Links Search sends the prompt and count': {
			parameters: { operation: 'aiXLinksSearch', prompt: 'Bittensor', count: 30 },
			request: {
				method: 'POST',
				url: `${API}/desearch/ai/search/links/twitter`,
				headers: JSON_HEADERS,
				body: { prompt: 'Bittensor', count: 30 },
			},
			reply: response({ miner_tweets: [tweet('1')] }),
			output: [{ miner_tweets: [tweet('1')] }],
		},
		'Search API sends the query and count 10 by default': {
			parameters: { operation: 'searchApi', query: 'Who won the 2024 Nobel Prize in Physics?' },
			request: {
				method: 'POST',
				url: `${API}/search`,
				headers: JSON_HEADERS,
				body: { query: 'Who won the 2024 Nobel Prize in Physics?', count: 10 },
			},
			reply: response({
				results: [{ url: 'https://nobelprize.org', passage: 'p' }],
				cost_usd: 0.01,
				usage_count: 1,
				service: 'Search API',
				currency: 'USD',
			}),
			output: [
				{
					results: [{ url: 'https://nobelprize.org', passage: 'p' }],
					cost_usd: 0.01,
					usage_count: 1,
					service: 'Search API',
					currency: 'USD',
				},
			],
		},
		'Search API sends the mode and days for the date range': {
			parameters: {
				operation: 'searchApi',
				query: 'nobel',
				count: 20,
				options: {
					mode: 'fast',
					startDate: '2026-01-01',
					endDate: '2026-09-17T23:00:00',
					highlights: false,
					pageText: true,
				},
			},
			request: {
				method: 'POST',
				url: `${API}/search`,
				headers: JSON_HEADERS,
				body: {
					query: 'nobel',
					mode: 'fast',
					count: 20,
					start_date: '2026-01-01',
					end_date: '2026-09-17',
					highlights: false,
					page_text: true,
				},
			},
			reply: response({ results: [] }),
			output: [{ results: [] }],
		},
	});
});

describe('Web Page', () => {
	itSends({
		'Extract asks for text and returns it as content': {
			parameters: { resource: 'webPage', url: ' https://desearch.ai ' },
			request: {
				method: 'GET',
				url: `${API}/web/extract`,
				headers: { Accept: 'text/plain' },
				qs: { url: 'https://desearch.ai', format: 'text' },
				encoding: 'text',
			},
			reply: response('Desearch\nAI search for agents'),
			output: [
				{ url: 'https://desearch.ai', format: 'text', content: 'Desearch\nAI search for agents' },
			],
		},
		'Extract renders JavaScript and waits when asked': {
			parameters: {
				resource: 'webPage',
				url: 'https://app.example',
				format: 'html',
				options: { renderJavaScript: true, waitMs: 2500 },
			},
			request: {
				method: 'GET',
				url: `${API}/web/extract`,
				headers: { Accept: 'text/html' },
				qs: { url: 'https://app.example', format: 'html', js: 'true', wait: 2500 },
				encoding: 'text',
			},
			reply: response('<html><body>App</body></html>'),
			output: [
				{ url: 'https://app.example', format: 'html', content: '<html><body>App</body></html>' },
			],
		},
		'Extract leaves Wait out without Render JavaScript': {
			parameters: { resource: 'webPage', url: 'https://desearch.ai', options: { waitMs: 500 } },
			request: {
				method: 'GET',
				url: `${API}/web/extract`,
				headers: { Accept: 'text/plain' },
				qs: { url: 'https://desearch.ai', format: 'text' },
				encoding: 'text',
			},
			reply: response('text'),
			output: [{ url: 'https://desearch.ai', format: 'text', content: 'text' }],
		},
	});
});

describe('X', () => {
	const x = (parameters: INodeParameters) => ({ resource: 'x', ...parameters });
	const get = (path: string, qs: IDataObject) => ({
		method: 'GET',
		url: `${API}${path}`,
		headers: JSON_HEADERS,
		qs,
	});

	itSends({
		'Get Post sends the post ID': {
			parameters: x({ operation: 'getPost', postId: ' 1932946234920349827 ' }),
			request: get('/twitter/post', { id: '1932946234920349827' }),
			reply: response(tweet('1932946234920349827')),
			output: [tweet('1932946234920349827')],
		},
		'Get Posts by URLs repeats urls and outputs one item per post': {
			parameters: x({
				operation: 'getPostsByUrls',
				urls: 'https://x.com/a/status/1,\nhttps://x.com/b/status/2\n',
			}),
			request: {
				...get('/twitter/urls', { urls: ['https://x.com/a/status/1', 'https://x.com/b/status/2'] }),
				arrayFormat: 'repeat',
			},
			reply: response([tweet('1'), tweet('2')]),
			output: [tweet('1'), tweet('2')],
		},
		'Search User Posts sends user, query and count': {
			parameters: x({
				operation: 'searchUserPosts',
				username: '@elonmusk',
				query: 'tesla',
				count: 5,
			}),
			request: get('/twitter/post/user', { user: 'elonmusk', query: 'tesla', count: 5 }),
			reply: response([tweet('3')]),
			output: [tweet('3')],
		},
		'Get Retweeters sends the cursor and returns the page with next_cursor': {
			parameters: x({ operation: 'getRetweeters', postId: '42', cursor: 'next-page' }),
			request: get('/twitter/post/retweeters', { id: '42', cursor: 'next-page' }),
			reply: response({ users: [{ id: 'u1' }], next_cursor: 'page-3' }),
			output: [{ users: [{ id: 'u1' }], next_cursor: 'page-3' }],
		},
		'Get User Posts leaves the cursor out on the first page': {
			parameters: x({ operation: 'getUserPosts', username: 'elonmusk' }),
			request: get('/twitter/user/posts', { username: 'elonmusk' }),
			reply: response({ user: { id: 'u' }, tweets: [tweet('4')], next_cursor: 'c2' }),
			output: [{ user: { id: 'u' }, tweets: [tweet('4')], next_cursor: 'c2' }],
		},
		'Get User Replies sends user and count 10 by default': {
			parameters: x({ operation: 'getUserReplies', username: 'elonmusk' }),
			request: get('/twitter/replies', { user: 'elonmusk', count: 10 }),
			reply: response([tweet('5'), tweet('6')]),
			output: [tweet('5'), tweet('6')],
		},
		'Get Post Replies sends post_id, count and query': {
			parameters: x({ operation: 'getPostReplies', postId: '42', count: 3, query: 'great' }),
			request: get('/twitter/replies/post', { post_id: '42', count: 3, query: 'great' }),
			reply: response([tweet('7')]),
			output: [tweet('7')],
		},
		'Get Trends sends the WOEID and count 30 by default': {
			parameters: x({ operation: 'getTrends', woeid: 23424977 }),
			request: get('/twitter/trends', { woeid: 23424977, count: 30 }),
			reply: response({ woeid: 23424977, trends: [{ name: '#AI' }] }),
			output: [{ woeid: 23424977, trends: [{ name: '#AI' }] }],
		},
	});
});

describe('TikTok', () => {
	const tiktok = (parameters: INodeParameters) => ({ resource: 'tiktok', ...parameters });
	const get = (path: string, qs?: IDataObject) => ({
		method: 'GET',
		url: `${API}${path}`,
		headers: JSON_HEADERS,
		...(qs ? { qs } : {}),
	});

	itSends({
		'Search posts query and count, and returns the page and its cursor': {
			parameters: tiktok({ query: ' bittensor ' }),
			request: {
				method: 'POST',
				url: `${API}/desearch/tiktok/search`,
				headers: JSON_HEADERS,
				body: { query: 'bittensor', count: 10 },
			},
			reply: response([video('1'), video('2')], 200, { [NEXT]: 'cursor-2' }),
			output: [{ results: [video('1'), video('2')], nextCursor: 'cursor-2' }],
		},
		'Search sends the cursor and sort; no next cursor on the last page': {
			parameters: tiktok({
				query: 'bittensor',
				count: 5,
				cursor: ' cursor-2 ',
				options: { sort: 'most-liked' },
			}),
			request: {
				method: 'POST',
				url: `${API}/desearch/tiktok/search`,
				headers: JSON_HEADERS,
				body: { query: 'bittensor', count: 5, cursor: 'cursor-2', sort: 'most-liked' },
			},
			reply: response([video('3')]),
			output: [{ results: [video('3')], nextCursor: null }],
		},
		'Get Post puts the video ID in the path': {
			parameters: tiktok({ operation: 'getPost', postId: '7499229683859426602' }),
			request: get('/desearch/tiktok/post/7499229683859426602'),
			reply: response(video('7499229683859426602')),
			output: [video('7499229683859426602')],
		},
		'Get Profile drops the @': {
			parameters: tiktok({ operation: 'getProfile', username: '@tiktok' }),
			request: get('/desearch/tiktok/profile/tiktok'),
			reply: response({ id: '1', username: 'tiktok', followers: 10 }),
			output: [{ id: '1', username: 'tiktok', followers: 10 }],
		},
		'Get Profile Posts sends count and cursor': {
			parameters: tiktok({
				operation: 'getProfilePosts',
				username: 'tiktok',
				count: 3,
				cursor: 'p2',
			}),
			request: get('/desearch/tiktok/profile/tiktok/posts', { count: 3, cursor: 'p2' }),
			reply: response([video('8')], 200, { [NEXT]: 'p3' }),
			output: [{ results: [video('8')], nextCursor: 'p3' }],
		},
		'Get Comments sends count 20 by default': {
			parameters: tiktok({ operation: 'getComments', postId: '7499229683859426602' }),
			request: get('/desearch/tiktok/comments/7499229683859426602', { count: 20 }),
			reply: response([{ id: 'c1', text: 'nice' }], 200, { [NEXT]: 'c-next' }),
			output: [{ results: [{ id: 'c1', text: 'nice' }], nextCursor: 'c-next' }],
		},
		'Get Hashtag Posts drops the #': {
			parameters: tiktok({ operation: 'getHashtagPosts', hashtag: '#ai' }),
			request: get('/desearch/tiktok/hashtag/ai', { count: 20 }),
			reply: response([video('9')]),
			output: [{ results: [video('9')], nextCursor: null }],
		},
		'Get Trending sends the region in capitals and the count': {
			parameters: tiktok({ operation: 'getTrending', region: 'gb', count: 5 }),
			request: get('/desearch/tiktok/trending', { region: 'GB', count: 5 }),
			reply: response([video('10')]),
			output: [{ results: [video('10')], nextCursor: null }],
		},
	});
});

describe('Facebook', () => {
	const facebook = (parameters: INodeParameters) => ({ resource: 'facebook', ...parameters });
	const get = (path: string, qs?: IDataObject) => ({
		method: 'GET',
		url: `${API}${path}`,
		headers: JSON_HEADERS,
		...(qs ? { qs } : {}),
	});
	const ad = { id: 'ad1', headline: 'Try it', active: true };

	itSends({
		'Search Ad Library posts query, count and cursor': {
			parameters: facebook({ query: 'ai agents', cursor: 'f2' }),
			request: {
				method: 'POST',
				url: `${API}/desearch/facebook/search`,
				headers: JSON_HEADERS,
				body: { query: 'ai agents', count: 10, cursor: 'f2' },
			},
			reply: response([ad], 200, { [NEXT]: 'f3' }),
			output: [{ results: [ad], nextCursor: 'f3' }],
		},
		'Get Post puts the post ID in the path': {
			parameters: facebook({ operation: 'getPost', postId: '1234567890' }),
			request: get('/desearch/facebook/post/1234567890'),
			reply: response({ id: '1234567890', text: 'hello' }),
			output: [{ id: '1234567890', text: 'hello' }],
		},
		'Get Profile sends the handle': {
			parameters: facebook({ operation: 'getProfile', profileId: 'facebook' }),
			request: get('/desearch/facebook/profile/facebook'),
			reply: response({ id: '20531316728', username: 'facebook' }),
			output: [{ id: '20531316728', username: 'facebook' }],
		},
		'Get Profile Posts sends count and returns the page': {
			parameters: facebook({ operation: 'getProfilePosts', profileId: 'facebook', count: 3 }),
			request: get('/desearch/facebook/profile/facebook/posts', { count: 3 }),
			reply: response([{ id: 'p1' }], 200, { [NEXT]: 'fp2' }),
			output: [{ results: [{ id: 'p1' }], nextCursor: 'fp2' }],
		},
		'Get Comments sends count 20 by default': {
			parameters: facebook({ operation: 'getComments', postId: '1234567890', cursor: 'fc2' }),
			request: get('/desearch/facebook/comments/1234567890', { count: 20, cursor: 'fc2' }),
			reply: response([{ id: 'c1' }]),
			output: [{ results: [{ id: 'c1' }], nextCursor: null }],
		},
		'Get Hashtag Posts drops the #': {
			parameters: facebook({ operation: 'getHashtagPosts', hashtag: '#ai' }),
			request: get('/desearch/facebook/hashtag/ai', { count: 20 }),
			reply: response([ad], 200, { [NEXT]: 'fh2' }),
			output: [{ results: [ad], nextCursor: 'fh2' }],
		},
	});
});

describe('Instagram', () => {
	const instagram = (parameters: INodeParameters) => ({ resource: 'instagram', ...parameters });
	const get = (path: string, qs?: IDataObject) => ({
		method: 'GET',
		url: `${API}${path}`,
		headers: JSON_HEADERS,
		...(qs ? { qs } : {}),
	});
	const media = { id: '1', shortcode: 'DeuOR-CjKE9', caption: 'hi' };

	itSends({
		'Search Profiles posts query and count, never a cursor': {
			parameters: instagram({ query: 'instagram', count: 2, cursor: 'ignored' }),
			request: {
				method: 'POST',
				url: `${API}/desearch/instagram/search`,
				headers: JSON_HEADERS,
				body: { query: 'instagram', count: 2 },
			},
			reply: response([{ id: '25025320', username: 'instagram', type: 'user' }]),
			output: [
				{ results: [{ id: '25025320', username: 'instagram', type: 'user' }], nextCursor: null },
			],
		},
		'Get Post URL-encodes a post URL into one path segment': {
			parameters: instagram({
				operation: 'getPost',
				postId: 'https://www.instagram.com/p/DeuOR-CjKE9/',
			}),
			request: get(
				'/desearch/instagram/media/https%3A%2F%2Fwww.instagram.com%2Fp%2FDeuOR-CjKE9%2F',
			),
			reply: response(media),
			output: [media],
		},
		'Get Profile drops the @': {
			parameters: instagram({ operation: 'getProfile', username: '@instagram' }),
			request: get('/desearch/instagram/profile/instagram'),
			reply: response({ id: '25025320', username: 'instagram' }),
			output: [{ id: '25025320', username: 'instagram' }],
		},
		'Get Profile Posts sends count and cursor': {
			parameters: instagram({
				operation: 'getProfilePosts',
				username: 'instagram',
				count: 2,
				cursor: 'i2',
			}),
			request: get('/desearch/instagram/profile/instagram/posts', { count: 2, cursor: 'i2' }),
			reply: response([media], 200, { [NEXT]: 'i3' }),
			output: [{ results: [media], nextCursor: 'i3' }],
		},
		'Get Comments uses the shortcode': {
			parameters: instagram({ operation: 'getComments', shortcode: 'DeuOR-CjKE9' }),
			request: get('/desearch/instagram/comments/DeuOR-CjKE9', { count: 20 }),
			reply: response([{ id: 'c1', text: 'wow' }], 200, { [NEXT]: 'ic2' }),
			output: [{ results: [{ id: 'c1', text: 'wow' }], nextCursor: 'ic2' }],
		},
		'Get Hashtag Posts drops the #': {
			parameters: instagram({ operation: 'getHashtagPosts', hashtag: '#ai' }),
			request: get('/desearch/instagram/hashtag/ai', { count: 20 }),
			reply: response([media]),
			output: [{ results: [media], nextCursor: null }],
		},
	});
});

describe('social list output', () => {
	it('reads the next cursor header in any case and keeps it unchanged', async () => {
		const { output } = await run({
			parameters: { resource: 'tiktok', operation: 'getHashtagPosts', hashtag: 'ai' },
			reply: response([video('1')], 200, { 'X-Desearch-Next-Cursor': 'eyJ2IjoxfQ.c2ln' }),
		});
		expect(output[0].json.nextCursor).toBe('eyJ2IjoxfQ.c2ln');
	});

	it('returns no results for an empty page', async () => {
		const { output } = await run({
			parameters: { resource: 'instagram', operation: 'getHashtagPosts', hashtag: 'ai' },
			reply: response([]),
		});
		expect(output).toEqual([{ json: { results: [], nextCursor: null }, pairedItem: { item: 0 } }]);
	});
});

describe('errors', () => {
	it.each([
		[{ resource: 'x', operation: 'getUserPosts', username: ' @ ' }, 'Username is empty'],
		[{ resource: 'x', operation: 'getPostsByUrls', urls: ' ,\n' }, 'Post URLs is empty'],
		[{ resource: 'tiktok', operation: 'getHashtagPosts', hashtag: '#' }, 'Hashtag is empty'],
		[{ resource: 'facebook', operation: 'getProfile', profileId: '' }, 'Profile or Page is empty'],
		[{ resource: 'instagram', operation: 'getComments', shortcode: ' ' }, 'Shortcode is empty'],
		[{ resource: 'webPage', url: '' }, 'URL is empty'],
		[
			{ operation: 'searchApi', query: 'q', options: { startDate: 'next tuesday' } },
			'Start Date is not a valid date: "next tuesday"',
		],
	])('fails without calling the API: %j', async (parameters, message) => {
		const { context, httpRequestWithAuthentication } = createSearchContext(parameters);

		const error = await searchNode.execute.call(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe(message);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('fails with the API reason as the description', async () => {
		const { context } = createSearchContext(
			{ resource: 'tiktok', operation: 'getProfilePosts', username: 'tiktok', cursor: 'stale' },
			{ http: () => response({ detail: 'Invalid request parameters' }, 422) },
		);

		const error = await searchNode.execute.call(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('422');
		expect((error as NodeApiError).description).toBe('Invalid request parameters');
	});

	it('reads the reason from a text error body (Extract)', async () => {
		const { context } = createSearchContext(
			{ resource: 'webPage', url: 'https://desearch.ai' },
			{ http: () => response('{"detail":"Could not fetch the URL"}', 502) },
		);

		const error = await searchNode.execute.call(context).catch((e: unknown) => e);

		expect((error as NodeApiError).httpCode).toBe('502');
		expect((error as NodeApiError).description).toBe('Could not fetch the URL');
	});

	it('wraps network errors in NodeApiError', async () => {
		const { context } = createSearchContext(
			{ resource: 'x', operation: 'getTrends' },
			{
				http: () => {
					throw new Error('socket hang up');
				},
			},
		);

		await expect(searchNode.execute.call(context)).rejects.toThrow(NodeApiError);
	});

	it('with Continue On Fail, outputs the error for the failed item and goes on', async () => {
		const { context } = createSearchContext(
			[
				{ resource: 'x', operation: 'getPost', postId: '1' },
				{ resource: 'x', operation: 'getPost', postId: '2' },
			],
			{
				continueOnFail: true,
				http: (options) =>
					options.qs?.id === '1'
						? response({ detail: 'Not enough credits' }, 402)
						: response(tweet('2')),
			},
		);

		const [output] = await searchNode.execute.call(context);

		expect(output).toEqual([
			{
				json: {
					error: 'Payment required - perhaps check your payment details?',
					description: 'Not enough credits',
				},
				pairedItem: { item: 0 },
			},
			{ json: tweet('2'), pairedItem: { item: 1 } },
		]);
	});
});
