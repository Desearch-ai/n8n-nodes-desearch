import {
	NodeApiError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeParameters,
} from 'n8n-workflow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	createExecuteContext as createPeopleExecuteContext,
	describeRequest,
	monitorsNode,
	response,
	type HttpHandler,
} from './helpers';

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

const MONITOR_ID = '6f1d0c9e-0d55-4b8e-9a3c-3c4d9b8e2a10';
const RUN_ID = '0c6a1e2b-5d3f-4a7c-9b8e-1f2d3c4b5a69';
const MONITOR_PATH = `/desearch/monitors/${MONITOR_ID}`;
const RUN_PATH = `${MONITOR_PATH}/runs/${RUN_ID}`;

function createExecuteContext(
	items: INodeParameters | INodeParameters[],
	options: { http?: HttpHandler; continueOnFail?: boolean; cancelSignal?: AbortSignal } = {},
) {
	return createPeopleExecuteContext(items, { ...options, nodeType: monitorsNode });
}

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

/** The body of the request sent with `method` (the first one). */
function sentBody(
	httpRequestWithAuthentication: ReturnType<
		typeof createExecuteContext
	>['httpRequestWithAuthentication'],
	method: string,
) {
	const call = httpRequestWithAuthentication.mock.calls.find(
		([, options]) => options.method === method,
	);
	return call?.[1].body;
}

async function execute(context: IExecuteFunctions) {
	return await monitorsNode.execute.call(context);
}

const MONITOR = {
	monitor_id: MONITOR_ID,
	query: 'Bittensor subnet launches',
	sources: ['web', 'x'],
	options: { x: { count: 20, lang: 'en', min_likes: 5 }, web: { count: 10 } },
	webhook: {
		url: 'https://example.com/hooks/desearch',
		events: ['monitor.items.found', 'monitor.run.completed'],
		consecutive_failures: 0,
	},
};

describe('Monitor > Create', () => {
	it('posts the query, sources, schedule, options and webhook and returns the monitor', async () => {
		const { context, httpRequestWithAuthentication, requests } = createExecuteContext(
			{
				operation: 'create',
				query: '  Bittensor subnet launches and updates ',
				sources: ['web', 'x', 'reddit', 'x'],
				interval: '6h',
				createOptions: {
					name: ' Bittensor news ',
					criteria: 'Announces a new subnet, release or partnership\n\n Names the subnet number ',
					minScore: 70,
					summary: true,
					webCount: 20,
					xCount: 50,
					xLang: ' en ',
					xMinLikes: 10,
					webhookUrl: ' https://example.com/hooks/desearch ',
					webhookEvents: ['monitor.items.found', 'monitor.run.failed'],
					metadata: { label: [{ key: 'team', value: 'growth' }] },
					runNow: false,
				},
			},
			{
				http: api({
					'POST /desearch/monitors': () =>
						response({ monitor_id: MONITOR_ID, webhook_secret: 'whsec_abc' }, 201),
				}),
			},
		);

		const [output] = await execute(context);

		expect(output).toEqual([
			{ json: { monitor_id: MONITOR_ID, webhook_secret: 'whsec_abc' }, pairedItem: { item: 0 } },
		]);
		expect(requests()).toEqual(['POST /desearch/monitors']);
		expect(sentBody(httpRequestWithAuthentication, 'POST')).toEqual({
			query: 'Bittensor subnet launches and updates',
			sources: ['web', 'x', 'reddit'],
			interval: '6h',
			name: 'Bittensor news',
			criteria: ['Announces a new subnet, release or partnership', 'Names the subnet number'],
			options: { web: { count: 20 }, x: { count: 50, lang: 'en', min_likes: 10 } },
			min_score: 70,
			summary: true,
			webhook: {
				url: 'https://example.com/hooks/desearch',
				events: ['monitor.items.found', 'monitor.run.failed'],
			},
			metadata: { team: 'growth' },
			run_now: false,
		});
	});

	it('sends only the query, the default sources and the daily interval by default', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{ operation: 'create', query: 'OpenAI launches' },
			{ http: () => response({ monitor_id: MONITOR_ID }, 201) },
		);

		await execute(context);

		expect(sentBody(httpRequestWithAuthentication, 'POST')).toEqual({
			query: 'OpenAI launches',
			sources: ['web', 'x'],
			interval: '1d',
		});
	});

	it('sends a webhook without events so the API applies its default events', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{
				operation: 'create',
				query: 'OpenAI launches',
				createOptions: { webhookUrl: 'https://example.com/h' },
			},
			{ http: () => response({ monitor_id: MONITOR_ID }, 201) },
		);

		await execute(context);

		expect((sentBody(httpRequestWithAuthentication, 'POST') as IDataObject).webhook).toEqual({
			url: 'https://example.com/h',
		});
	});

	it('refuses more than 5 criteria without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			operation: 'create',
			query: 'OpenAI launches',
			createOptions: { criteria: 'a\nb\nc\nd\ne\nf' },
		});

		await expect(execute(context)).rejects.toThrow('Too many criteria (6)');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('refuses an empty source list without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			operation: 'create',
			query: 'OpenAI launches',
			sources: [],
		});

		await expect(execute(context)).rejects.toThrow('Sources is empty');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Monitor > Estimate Cost', () => {
	it('posts the sources, interval and cost options', async () => {
		const { context, httpRequestWithAuthentication, requests } = createExecuteContext(
			{
				operation: 'estimate',
				sources: ['x', 'youtube'],
				interval: '1h',
				estimateOptions: { summary: true, xCount: 100 },
			},
			{
				http: () =>
					response({
						max_run_cost_usd: 0.0098,
						runs_per_month: 720,
						max_monthly_cost_usd: 7.06,
						breakdown: { x: 0.004 },
					}),
			},
		);

		const [output] = await execute(context);

		expect(output[0].json.runs_per_month).toBe(720);
		expect(requests()).toEqual(['POST /desearch/monitors/estimate']);
		expect(sentBody(httpRequestWithAuthentication, 'POST')).toEqual({
			sources: ['x', 'youtube'],
			interval: '1h',
			options: { x: { count: 100 } },
			summary: true,
		});
	});
});

describe('Monitor > Get Many', () => {
	it('lists monitors with a status filter across pages, one item per monitor', async () => {
		const pages: Record<string, IDataObject> = {
			start: { monitors: [{ monitor_id: 'm1' }, { monitor_id: 'm2' }], next_cursor: 'n1' },
			n1: { monitors: [{ monitor_id: 'm3' }], next_cursor: null },
		};
		const { context, requests } = createExecuteContext(
			{
				operation: 'getAll',
				returnAll: true,
				monitorFilters: { status: ['active', 'paused'] },
			},
			{ http: (options) => response(pages[String(options.qs?.cursor ?? 'start')]) },
		);

		const [output] = await execute(context);

		expect(output.map((item) => item.json.monitor_id)).toEqual(['m1', 'm2', 'm3']);
		expect(requests()).toEqual([
			'GET /desearch/monitors?status=active%2Cpaused&limit=100',
			'GET /desearch/monitors?status=active%2Cpaused&limit=100&cursor=n1',
		]);
	});

	it('stops at Limit', async () => {
		const { context, requests } = createExecuteContext(
			{ operation: 'getAll', limit: 2 },
			{
				http: () =>
					response({
						monitors: [{ monitor_id: 'm1' }, { monitor_id: 'm2' }],
						next_cursor: 'n1',
					}),
			},
		);

		const [output] = await execute(context);

		expect(output).toHaveLength(2);
		expect(requests()).toEqual(['GET /desearch/monitors?limit=2']);
	});
});

describe('Monitor > Get, Delete, Trigger Run, Test Webhook, Rotate Webhook Secret', () => {
	it.each([
		['get', `GET ${MONITOR_PATH}`],
		['delete', `DELETE ${MONITOR_PATH}`],
		['trigger', `POST ${MONITOR_PATH}/trigger`],
		['testWebhook', `POST ${MONITOR_PATH}/webhook/test`],
		['rotateWebhookSecret', `POST ${MONITOR_PATH}/webhook/rotate-secret`],
	])('%s calls %s and returns the response', async (operation, request) => {
		const { context, requests } = createExecuteContext(
			{ operation, monitorId: ` ${MONITOR_ID} ` },
			{ http: () => response({ ok: operation }) },
		);

		const [output] = await execute(context);

		expect(output).toEqual([{ json: { ok: operation }, pairedItem: { item: 0 } }]);
		expect(requests()).toEqual([request]);
	});

	it('URL-encodes the monitor ID', async () => {
		const { context, requests } = createExecuteContext(
			{ operation: 'get', monitorId: 'a/b c' },
			{ http: () => response({}) },
		);

		await execute(context);

		expect(requests()).toEqual(['GET /desearch/monitors/a%2Fb%20c']);
	});

	it('fails on an empty monitor ID without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			operation: 'trigger',
			monitorId: '  ',
		});

		await expect(execute(context)).rejects.toThrow('Monitor ID is empty');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Monitor > Update', () => {
	it('patches only the fields that are set, without reading the monitor first', async () => {
		const { context, httpRequestWithAuthentication, requests } = createExecuteContext(
			{
				operation: 'update',
				monitorId: MONITOR_ID,
				updateFields: {
					name: 'Renamed',
					status: 'paused',
					interval: '12h',
					sources: ['reddit'],
					minScore: 80,
					summary: false,
					metadata: { label: [{ key: 'team', value: 'sales' }] },
				},
			},
			{ http: () => response({ monitor_id: MONITOR_ID, status: 'paused' }) },
		);

		const [output] = await execute(context);

		expect(output[0].json.status).toBe('paused');
		expect(requests()).toEqual([`PATCH ${MONITOR_PATH}`]);
		expect(sentBody(httpRequestWithAuthentication, 'PATCH')).toEqual({
			name: 'Renamed',
			sources: ['reddit'],
			interval: '12h',
			status: 'paused',
			min_score: 80,
			summary: false,
			metadata: { team: 'sales' },
		});
	});

	it('clears criteria and metadata when they are set but empty', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{
				operation: 'update',
				monitorId: MONITOR_ID,
				updateFields: { criteria: '', metadata: {} },
			},
			{ http: () => response({}) },
		);

		await execute(context);

		expect(sentBody(httpRequestWithAuthentication, 'PATCH')).toEqual({
			criteria: [],
			metadata: {},
		});
	});

	it('keeps the per-source options it does not change, since the API replaces them all', async () => {
		const { context, httpRequestWithAuthentication, requests } = createExecuteContext(
			{ operation: 'update', monitorId: MONITOR_ID, updateFields: { xCount: 50 } },
			{
				http: api({
					[`GET ${MONITOR_PATH}`]: () => response(MONITOR),
					[`PATCH ${MONITOR_PATH}`]: () => response(MONITOR),
				}),
			},
		);

		await execute(context);

		expect(requests()).toEqual([`GET ${MONITOR_PATH}`, `PATCH ${MONITOR_PATH}`]);
		expect(sentBody(httpRequestWithAuthentication, 'PATCH')).toEqual({
			options: { x: { count: 50, lang: 'en', min_likes: 5 }, web: { count: 10 } },
		});
	});

	it('keeps the webhook events when only the URL changes', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{
				operation: 'update',
				monitorId: MONITOR_ID,
				updateFields: { webhookUrl: 'https://example.com/new' },
			},
			{
				http: api({
					[`GET ${MONITOR_PATH}`]: () => response(MONITOR),
					[`PATCH ${MONITOR_PATH}`]: () => response({ webhook_secret: 'whsec_new' }),
				}),
			},
		);

		const [output] = await execute(context);

		expect(output[0].json.webhook_secret).toBe('whsec_new');
		expect(sentBody(httpRequestWithAuthentication, 'PATCH')).toEqual({
			webhook: {
				url: 'https://example.com/new',
				events: ['monitor.items.found', 'monitor.run.completed'],
			},
		});
	});

	it('keeps the webhook URL when only the events change', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{
				operation: 'update',
				monitorId: MONITOR_ID,
				updateFields: { webhookEvents: ['monitor.run.failed'] },
			},
			{
				http: api({
					[`GET ${MONITOR_PATH}`]: () => response(MONITOR),
					[`PATCH ${MONITOR_PATH}`]: () => response({}),
				}),
			},
		);

		await execute(context);

		expect(sentBody(httpRequestWithAuthentication, 'PATCH')).toEqual({
			webhook: { url: 'https://example.com/hooks/desearch', events: ['monitor.run.failed'] },
		});
	});

	it('fails when only events are set on a monitor without a webhook', async () => {
		const { context, requests } = createExecuteContext(
			{
				operation: 'update',
				monitorId: MONITOR_ID,
				updateFields: { webhookEvents: ['monitor.run.failed'] },
			},
			{ http: () => response({ ...MONITOR, webhook: null }) },
		);

		await expect(execute(context)).rejects.toThrow('The monitor has no webhook');
		expect(requests()).toEqual([`GET ${MONITOR_PATH}`]);
	});

	it('removes the webhook with webhook: null', async () => {
		const { context, httpRequestWithAuthentication, requests } = createExecuteContext(
			{
				operation: 'update',
				monitorId: MONITOR_ID,
				updateFields: { removeWebhook: true, webhookUrl: 'https://ignored.example.com' },
			},
			{ http: () => response({ webhook: null }) },
		);

		await execute(context);

		expect(requests()).toEqual([`PATCH ${MONITOR_PATH}`]);
		expect(sentBody(httpRequestWithAuthentication, 'PATCH')).toEqual({ webhook: null });
	});

	it('fails when no field is set, without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			operation: 'update',
			monitorId: MONITOR_ID,
		});

		await expect(execute(context)).rejects.toThrow('Nothing to update');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Run', () => {
	it('Get Many lists the runs of a monitor across pages', async () => {
		const pages: Record<string, IDataObject> = {
			start: { runs: [{ run_id: 'r1' }], next_cursor: 'n1' },
			n1: { runs: [{ run_id: 'r2' }], next_cursor: null },
		};
		const { context, requests } = createExecuteContext(
			{ resource: 'run', operation: 'getAll', monitorId: MONITOR_ID, returnAll: true },
			{ http: (options) => response(pages[String(options.qs?.cursor ?? 'start')]) },
		);

		const [output] = await execute(context);

		expect(output.map((item) => item.json.run_id)).toEqual(['r1', 'r2']);
		expect(requests()).toEqual([
			`GET ${MONITOR_PATH}/runs?limit=100`,
			`GET ${MONITOR_PATH}/runs?limit=100&cursor=n1`,
		]);
	});

	it('Get returns the run once, without waiting by default', async () => {
		const { context, requests } = createExecuteContext(
			{ resource: 'run', operation: 'get', monitorId: MONITOR_ID, runId: RUN_ID },
			{ http: () => response({ run_id: RUN_ID, status: 'running', items: [] }) },
		);

		const [output] = await execute(context);

		expect(output).toEqual([
			{ json: { run_id: RUN_ID, status: 'running', items: [] }, pairedItem: { item: 0 } },
		]);
		expect(requests()).toEqual([`GET ${RUN_PATH}`]);
		expect(clock.sleeps).toEqual([]);
	});

	it('Get waits until the run completes and can output one item per kept item', async () => {
		const statuses = ['queued', 'running', 'completed'];
		let call = 0;
		const { context, requests } = createExecuteContext(
			{
				resource: 'run',
				operation: 'get',
				monitorId: MONITOR_ID,
				runId: RUN_ID,
				waitForCompletion: true,
				pollInterval: 5,
				output: 'items',
			},
			{
				http: () => {
					const status = statuses[Math.min(call++, statuses.length - 1)];
					return response({
						run_id: RUN_ID,
						status,
						items: status === 'completed' ? [{ item_id: '2' }, { item_id: '1' }] : [],
					});
				},
			},
		);

		const [output] = await execute(context);

		expect(output.map((item) => item.json.item_id)).toEqual(['2', '1']);
		expect(requests()).toHaveLength(3);
		expect(clock.sleeps).toEqual([5000, 5000]);
	});

	it('Get fails with the reason when the run failed', async () => {
		const { context } = createExecuteContext(
			{
				resource: 'run',
				operation: 'get',
				monitorId: MONITOR_ID,
				runId: RUN_ID,
				waitForCompletion: true,
			},
			{
				http: () =>
					response({ run_id: RUN_ID, status: 'failed', fail_reason: 'all_sources_failed' }),
			},
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect((error as Error).message).toBe('The monitor run failed');
		expect((error as { description?: string }).description).toContain('all_sources_failed');
	});

	it('Get fails with the status when the run does not end in time', async () => {
		const { context } = createExecuteContext(
			{
				resource: 'run',
				operation: 'get',
				monitorId: MONITOR_ID,
				runId: RUN_ID,
				waitForCompletion: true,
				timeout: 20,
				pollInterval: 10,
			},
			{ http: () => response({ run_id: RUN_ID, status: 'running' }) },
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect((error as Error).message).toBe('The monitor run did not finish within 20 seconds');
		expect((error as { description?: string }).description).toContain('is running');
	});

	it('Get stops when the execution is cancelled', async () => {
		const controller = new AbortController();
		controller.abort();
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{
				resource: 'run',
				operation: 'get',
				monitorId: MONITOR_ID,
				runId: RUN_ID,
				waitForCompletion: true,
			},
			{ cancelSignal: controller.signal },
		);

		await expect(execute(context)).rejects.toThrow(/cancelled/);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('Get fails on an empty run ID without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			resource: 'run',
			operation: 'get',
			monitorId: MONITOR_ID,
			runId: '',
		});

		await expect(execute(context)).rejects.toThrow('Run ID is empty');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Item > Get Many', () => {
	it('lists the items of one source, newest first, in pages of up to 200', async () => {
		const { context, requests } = createExecuteContext(
			{
				resource: 'item',
				operation: 'getAll',
				monitorId: MONITOR_ID,
				limit: 250,
				itemFilters: { source: 'youtube' },
			},
			{
				http: (options) => {
					const first = options.qs?.cursor === undefined;
					const count = Number(options.qs?.limit);
					return response({
						items: Array.from({ length: count }, (_, i) => ({
							item_id: String(first ? i : 200 + i),
						})),
						next_cursor: first ? '1642' : null,
					});
				},
			},
		);

		const [output] = await execute(context);

		expect(output).toHaveLength(250);
		expect(requests()).toEqual([
			`GET ${MONITOR_PATH}/items?source=youtube&limit=200`,
			`GET ${MONITOR_PATH}/items?source=youtube&limit=50&cursor=1642`,
		]);
	});

	it('sends no source by default', async () => {
		const { context, requests } = createExecuteContext(
			{ resource: 'item', operation: 'getAll', monitorId: MONITOR_ID },
			{ http: () => response({ items: [], next_cursor: null }) },
		);

		await execute(context);

		expect(requests()).toEqual([`GET ${MONITOR_PATH}/items?limit=50`]);
	});
});

describe('errors', () => {
	it('fails with the API reason as the description', async () => {
		const { context } = createExecuteContext(
			{ operation: 'trigger', monitorId: MONITOR_ID },
			{ http: () => response({ detail: 'This monitor is already running.' }, 409) },
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('409');
		expect((error as NodeApiError).description).toBe('This monitor is already running.');
	});

	it('with Continue On Fail, outputs the error for the failed item and goes on', async () => {
		const { context } = createExecuteContext(
			[
				{ operation: 'create', query: 'OpenAI launches' },
				{ operation: 'get', monitorId: MONITOR_ID },
			],
			{
				continueOnFail: true,
				http: (options) =>
					options.method === 'POST'
						? response(
								{
									detail:
										"Your balance can't cover one run of this monitor. Add credits and try again.",
								},
								402,
							)
						: response({ monitor_id: MONITOR_ID }),
			},
		);

		const [output] = await execute(context);

		expect(output).toEqual([
			{
				json: {
					error: 'Payment required - perhaps check your payment details?',
					description:
						"Your balance can't cover one run of this monitor. Add credits and try again.",
				},
				pairedItem: { item: 0 },
			},
			{ json: { monitor_id: MONITOR_ID }, pairedItem: { item: 1 } },
		]);
	});
});
