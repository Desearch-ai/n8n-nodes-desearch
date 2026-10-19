import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createExecuteContext, describeRequest, peopleNode, response } from './helpers';

// A fake clock: sleep() advances it instead of waiting.
const clock = vi.hoisted(() => ({ now: 0, sleeps: [] as number[] }));

vi.mock('n8n-workflow', async (importOriginal) => {
	const actual = await importOriginal<typeof import('n8n-workflow')>();
	return {
		...actual,
		sleep: vi.fn(async (ms: number) => {
			clock.sleeps.push(ms);
			clock.now += ms;
		}),
	};
});

beforeEach(() => {
	clock.now = 1_000_000;
	clock.sleeps = [];
	vi.spyOn(Date, 'now').mockImplementation(() => clock.now);
});

afterEach(() => {
	vi.restoreAllMocks();
});

const TASK_ID = '5b33f3ee-168b-4780-9c8e-63a626781872';
const TASK_PATH = `/desearch/people/tasks/${TASK_ID}`;

/** Routes requests by "METHOD path" (query string ignored) to handlers. */
function api(
	routes: Record<string, (options: IHttpRequestOptions) => ReturnType<typeof response>>,
) {
	return (options: IHttpRequestOptions) => {
		const key = describeRequest(options).split('?')[0];
		const route = routes[key];
		if (!route) throw new Error(`No fake route for ${key}`);
		return route(options);
	};
}

const people = (from: number, to: number) =>
	Array.from({ length: to - from }, (_, i) => ({ id: `p${from + i}`, handle: `h${from + i}` }));

/** Serves `total` results in pages of `limit`, with cursors "c<offset>". */
function resultsPages(total: number) {
	return (options: IHttpRequestOptions) => {
		const qs = options.qs ?? {};
		const offset = qs.cursor ? Number(String(qs.cursor).slice(1)) : 0;
		const end = Math.min(total, offset + Number(qs.limit));
		return response({
			task_id: TASK_ID,
			status: 'completed',
			results: people(offset, end),
			next_cursor: `c${end}`,
			has_more: end < total,
		});
	};
}

function taskStatuses(...statuses: string[]) {
	let call = 0;
	return () => {
		const status = statuses[Math.min(call, statuses.length - 1)];
		call++;
		return response({ task_id: TASK_ID, status, count: 25, result_count: call * 3 });
	};
}

async function execute(context: IExecuteFunctions) {
	return await peopleNode.execute.call(context);
}

describe('Search > Start', () => {
	it('posts the body to the platform route and returns the task', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{
				platform: 'tiktok',
				query: 'Skincare creators who review sunscreen',
				count: 5,
				searchFilters: { minFollowers: 10000, requireContact: true, verifiedOnly: true },
				searchOptions: { idempotencyKey: 'run-1' },
			},
			{
				http: api({
					'POST /desearch/people/search/tiktok': () =>
						response({ task_id: TASK_ID, status: 'queued', reserved_cost_usd: 0.25 }, 202),
				}),
			},
		);

		const [output] = await execute(context);

		expect(output).toEqual([
			{
				json: { task_id: TASK_ID, status: 'queued', reserved_cost_usd: 0.25 },
				pairedItem: { item: 0 },
			},
		]);
		const [credentialType, request] = httpRequestWithAuthentication.mock.calls[0];
		expect(credentialType).toBe('desearchApi');
		expect(request).toMatchObject({
			method: 'POST',
			url: 'https://api.desearch.ai/desearch/people/search/tiktok',
			json: true,
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'Idempotency-Key': 'run-1',
			},
			body: {
				query: 'Skincare creators who review sunscreen',
				count: 5,
				filters: { min_followers: 10000, require_contact: true },
			},
		});
	});

	it('starts one search per input item', async () => {
		const queries: unknown[] = [];
		const { context } = createExecuteContext(
			[
				{ query: 'Indie hackers', count: 5 },
				{ platform: 'youtube', query: 'Fitness creators', count: 10 },
			],
			{
				http: (options) => {
					queries.push([options.url, (options.body as IDataObject).query]);
					return response({ task_id: `t${queries.length}` }, 202);
				},
			},
		);

		const [output] = await execute(context);

		expect(output.map((item) => [item.json.task_id, item.pairedItem])).toEqual([
			['t1', { item: 0 }],
			['t2', { item: 1 }],
		]);
		expect(queries).toEqual([
			['https://api.desearch.ai/desearch/people/search/x', 'Indie hackers'],
			['https://api.desearch.ai/desearch/people/search/youtube', 'Fitness creators'],
		]);
	});
});

describe('Search > Get, Pause, Resume, Cancel', () => {
	it.each([
		['get', `GET ${TASK_PATH}`],
		['pause', `POST ${TASK_PATH}/pause`],
		['resume', `POST ${TASK_PATH}/resume`],
		['cancel', `POST ${TASK_PATH}/cancel`],
	])('%s calls %s with the trimmed task ID', async (operation, route) => {
		const { context, requests, httpRequestWithAuthentication } = createExecuteContext(
			{ operation, taskId: ` ${TASK_ID} ` },
			{ http: () => response({ task_id: TASK_ID, status: 'running' }) },
		);

		const [output] = await execute(context);

		expect(requests()).toEqual([route]);
		expect(httpRequestWithAuthentication.mock.calls[0][1].body).toBeUndefined();
		expect(output).toEqual([
			{ json: { task_id: TASK_ID, status: 'running' }, pairedItem: { item: 0 } },
		]);
	});

	it('fails on an empty task ID without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			operation: 'get',
			taskId: '  ',
		});

		await expect(execute(context)).rejects.toThrow('Task ID is empty');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Search > Get Results', () => {
	const getResults = { operation: 'getResults', taskId: TASK_ID };

	it('waits for the search to finish, then returns every page, one item per person', async () => {
		const { context, requests } = createExecuteContext(getResults, {
			http: api({
				[`GET ${TASK_PATH}`]: taskStatuses('queued', 'running', 'completed'),
				[`GET ${TASK_PATH}/results`]: resultsPages(1200),
			}),
		});

		const [output] = await execute(context);

		expect(output).toHaveLength(1200);
		expect(output[0]).toEqual({ json: { id: 'p0', handle: 'h0' }, pairedItem: { item: 0 } });
		expect(output[1199].json.id).toBe('p1199');
		expect(clock.sleeps).toEqual([15000, 15000]);
		expect(requests()).toEqual([
			`GET ${TASK_PATH}`,
			`GET ${TASK_PATH}`,
			`GET ${TASK_PATH}`,
			`GET ${TASK_PATH}/results?limit=500`,
			`GET ${TASK_PATH}/results?limit=500&cursor=c500`,
			`GET ${TASK_PATH}/results?limit=500&cursor=c1000`,
		]);
	});

	it.each(['partial', 'cancelled'])('treats %s as finished', async (status) => {
		const { context } = createExecuteContext(getResults, {
			http: api({
				[`GET ${TASK_PATH}`]: taskStatuses('running', status),
				[`GET ${TASK_PATH}/results`]: resultsPages(2),
			}),
		});

		const [output] = await execute(context);

		expect(output).toHaveLength(2);
		expect(clock.sleeps).toEqual([15000]);
	});

	it('without waiting, returns the people found so far up to Limit', async () => {
		const { context, requests } = createExecuteContext(
			{ ...getResults, waitForCompletion: false, returnAll: false, limit: 700 },
			{ http: api({ [`GET ${TASK_PATH}/results`]: resultsPages(1200) }) },
		);

		const [output] = await execute(context);

		expect(output).toHaveLength(700);
		expect(requests()).toEqual([
			`GET ${TASK_PATH}/results?limit=500`,
			`GET ${TASK_PATH}/results?limit=200&cursor=c500`,
		]);
	});

	it('returns no items when the search found no one', async () => {
		const { context } = createExecuteContext(getResults, {
			http: api({
				[`GET ${TASK_PATH}`]: taskStatuses('completed'),
				[`GET ${TASK_PATH}/results`]: () =>
					response({ status: 'completed', results: [], next_cursor: 'c0', has_more: false }),
			}),
		});

		await expect(execute(context)).resolves.toEqual([[]]);
	});

	it('fails with the task status when the search does not finish in time', async () => {
		const { context, requests } = createExecuteContext(
			{ ...getResults, timeout: 40 },
			{ http: api({ [`GET ${TASK_PATH}`]: taskStatuses('running') }) },
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe(
			'The search did not finish within 40 seconds',
		);
		expect((error as NodeOperationError).description).toContain(TASK_ID);
		expect((error as NodeOperationError).description).toContain('running');
		// 0s, 15s, 30s, then a last check at the 40s deadline.
		expect(clock.sleeps).toEqual([15000, 15000, 10000]);
		expect(requests()).toHaveLength(4);
	});

	it('fails when the search failed, with its errors', async () => {
		const { context } = createExecuteContext(getResults, {
			http: () => response({ status: 'failed', errors: [{ message: 'upstream down' }] }),
		});

		const error = await execute(context).catch((e: unknown) => e);

		expect((error as NodeOperationError).message).toBe('The search failed');
		expect((error as NodeOperationError).description).toBe('upstream down');
	});

	it('fails instead of waiting on a paused search', async () => {
		const { context } = createExecuteContext(getResults, { http: taskStatuses('paused') });

		await expect(execute(context)).rejects.toThrow('The search is paused');
		expect(clock.sleeps).toEqual([]);
	});

	it('fails when the results expired', async () => {
		const { context } = createExecuteContext(getResults, { http: taskStatuses('expired') });

		await expect(execute(context)).rejects.toThrow('The search results expired');
	});

	it('stops when the execution is cancelled', async () => {
		const controller = new AbortController();
		controller.abort();
		const { context, httpRequestWithAuthentication } = createExecuteContext(getResults, {
			cancelSignal: controller.signal,
		});

		await expect(execute(context)).rejects.toThrow(/cancelled/);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Search > Get Many', () => {
	it('follows next_cursor until it is null and keeps the filters on every page', async () => {
		const pages: Record<string, IDataObject> = {
			start: { tasks: [{ task_id: 't1' }, { task_id: 't2' }], next_cursor: 'n1' },
			n1: { tasks: [{ task_id: 't3' }], next_cursor: null },
		};
		const { context, requests } = createExecuteContext(
			{ operation: 'getAll', returnAll: true, taskFilters: { platform: 'x', status: ['running'] } },
			{ http: (options) => response(pages[String(options.qs?.cursor ?? 'start')]) },
		);

		const [output] = await execute(context);

		expect(output.map((item) => item.json.task_id)).toEqual(['t1', 't2', 't3']);
		expect(requests()).toEqual([
			'GET /desearch/people/tasks?platform=x&status=running&limit=100',
			'GET /desearch/people/tasks?platform=x&status=running&limit=100&cursor=n1',
		]);
	});

	it('returns 50 searches by default', async () => {
		const { context, requests } = createExecuteContext(
			{ operation: 'getAll' },
			{ http: () => response({ tasks: [], next_cursor: null }) },
		);

		await execute(context);

		expect(requests()).toEqual(['GET /desearch/people/tasks?limit=50']);
	});
});

describe('Profile > Get Many', () => {
	it('sends the filters and stops at Limit across pages', async () => {
		const { context, requests } = createExecuteContext(
			{
				resource: 'profile',
				platform: 'tiktok',
				sortBy: 'audience',
				limit: 3,
				profileFilters: { has: ['email'], minAudience: 1000, verifiedOnly: true },
			},
			{
				http: (options) =>
					options.qs?.cursor
						? response({ profiles: [{ id: 'c' }, { id: 'd' }], total: 9, next_cursor: 'n2' })
						: response({ profiles: [{ id: 'a' }, { id: 'b' }], total: 9, next_cursor: 'n1' }),
			},
		);

		const [output] = await execute(context);

		expect(output.map((item) => item.json.id)).toEqual(['a', 'b', 'c']);
		expect(requests()).toEqual([
			'GET /desearch/people/profiles?platform=tiktok&sort=audience&has=email&min_audience=1000&verified=true&limit=3',
			'GET /desearch/people/profiles?platform=tiktok&sort=audience&has=email&min_audience=1000&verified=true&limit=1&cursor=n1',
		]);
	});
});

describe('errors', () => {
	it('fails with the API reason as the description', async () => {
		const { context } = createExecuteContext(
			{ operation: 'pause', taskId: TASK_ID },
			{
				http: () =>
					response(
						{ detail: 'Task is completed; it cannot be paused.', task: { status: 'completed' } },
						409,
					),
			},
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('409');
		expect((error as NodeApiError).description).toBe('Task is completed; it cannot be paused.');
	});

	it('wraps network errors in NodeApiError', async () => {
		const { context } = createExecuteContext(
			{ operation: 'get', taskId: TASK_ID },
			{
				http: () => {
					throw new Error('socket hang up');
				},
			},
		);

		await expect(execute(context)).rejects.toThrow(NodeApiError);
	});

	it('with Continue On Fail, outputs the error for the failed item and goes on', async () => {
		const { context } = createExecuteContext(
			[
				{ query: 'Indie hackers', count: 5 },
				{ query: 'Fitness creators', count: 5 },
			],
			{
				continueOnFail: true,
				http: (options) =>
					(options.body as IDataObject).query === 'Indie hackers'
						? response({ detail: 'Not enough credits for the reservation.' }, 402)
						: response({ task_id: TASK_ID }, 202),
			},
		);

		const [output] = await execute(context);

		expect(output).toEqual([
			{
				json: {
					error: 'Payment required - perhaps check your payment details?',
					description: 'Not enough credits for the reservation.',
				},
				pairedItem: { item: 0 },
			},
			{ json: { task_id: TASK_ID }, pairedItem: { item: 1 } },
		]);
	});
});
