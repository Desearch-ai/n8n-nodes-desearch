import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeParameters,
} from 'n8n-workflow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	companyNode,
	createExecuteContext as createPeopleExecuteContext,
	describeRequest,
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

const TASK_ID = '0c9f3a52-7d1e-4f0a-9a3b-2b8e6f1d4c77';
const TASK_PATH = `/desearch/companies/tasks/${TASK_ID}`;

function createExecuteContext(
	items: INodeParameters | INodeParameters[],
	options: { http?: HttpHandler; continueOnFail?: boolean; cancelSignal?: AbortSignal } = {},
) {
	return createPeopleExecuteContext(items, { ...options, nodeType: companyNode });
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

const companies = (from: number, to: number) =>
	Array.from({ length: to - from }, (_, i) => ({
		id: `company:c${from + i}.com`,
		domain: `c${from + i}.com`,
	}));

/** Serves `total` results in pages of `limit`, with cursors "c<offset>". */
function resultsPages(total: number) {
	return (options: IHttpRequestOptions) => {
		const qs = options.qs ?? {};
		const offset = qs.cursor ? Number(String(qs.cursor).slice(1)) : 0;
		const end = Math.min(total, offset + Number(qs.limit));
		return response({
			task_id: TASK_ID,
			status: 'completed',
			results: companies(offset, end),
			next_cursor: `c${end}`,
			has_more: end < total,
		});
	};
}

function taskStatuses(...statuses: Array<string | IDataObject>) {
	let call = 0;
	return () => {
		const entry = statuses[Math.min(call, statuses.length - 1)];
		call++;
		const fields = typeof entry === 'string' ? { status: entry } : entry;
		return response({ task_id: TASK_ID, count: 25, result_count: call * 3, ...fields });
	};
}

async function execute(context: IExecuteFunctions) {
	return await companyNode.execute.call(context);
}

describe('Company Search > Start', () => {
	it('posts the description, filters and options and returns the task', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{
				query: '  Series A fintech startups in Berlin ',
				count: 40,
				searchFilters: { countries: 'DE, Austria', require: ['email', 'leader_email'] },
				searchOptions: {
					minScore: 70,
					exclude: 'stripe.com,\nhttps://adyen.com',
					roles: ['ceo', 'cto'],
					inferEmails: false,
					verifyEmails: true,
					metadata: {
						label: [
							{ key: 'campaign', value: 'q4' },
							{ key: ' ', value: 'ignored' },
						],
					},
					idempotencyKey: ' run-1 ',
				},
			},
			{
				http: api({
					'POST /desearch/companies/search': () =>
						response({ task_id: TASK_ID, status: 'queued', reserved_cost_usd: 3.6 }, 202),
				}),
			},
		);

		const [output] = await execute(context);

		expect(output).toEqual([
			{
				json: { task_id: TASK_ID, status: 'queued', reserved_cost_usd: 3.6 },
				pairedItem: { item: 0 },
			},
		]);
		const [credentialType, request] = httpRequestWithAuthentication.mock.calls[0];
		expect(credentialType).toBe('desearchApi');
		expect(request).toMatchObject({
			method: 'POST',
			url: 'https://api.desearch.ai/desearch/companies/search',
			json: true,
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'Idempotency-Key': 'run-1',
			},
		});
		expect(request.body).toEqual({
			query: 'Series A fintech startups in Berlin',
			count: 40,
			min_score: 70,
			exclude: ['stripe.com', 'https://adyen.com'],
			filters: { countries: ['DE', 'Austria'], require: ['email', 'leader_email'] },
			roles: ['ceo', 'cto'],
			infer_emails: false,
			verify_emails: true,
			metadata: { campaign: 'q4' },
		});
	});

	it('sends only query and count by default', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext(
			{ query: 'Dental clinics in Lisbon' },
			{ http: () => response({ task_id: TASK_ID }, 202) },
		);

		await execute(context);

		const [, request] = httpRequestWithAuthentication.mock.calls[0];
		expect(request.body).toEqual({ query: 'Dental clinics in Lisbon', count: 25 });
		expect(request.headers).not.toHaveProperty('Idempotency-Key');
	});
});

describe('Company Enrich > Start', () => {
	it('posts the domains and options to the enrich route', async () => {
		const { context, requests, httpRequestWithAuthentication } = createExecuteContext(
			{
				resource: 'enrich',
				domains: 'acme.com, https://www.beta.io/about\n\ngamma.dev',
				enrichOptions: { roles: ['founder'], verifyEmails: false, idempotencyKey: 'e-1' },
			},
			{ http: () => response({ task_id: TASK_ID, status: 'queued', count: 3 }, 202) },
		);

		const [output] = await execute(context);

		expect(requests()).toEqual(['POST /desearch/companies/enrich']);
		const [, request] = httpRequestWithAuthentication.mock.calls[0];
		expect(request.body).toEqual({
			domains: ['acme.com', 'https://www.beta.io/about', 'gamma.dev'],
			roles: ['founder'],
			verify_emails: false,
		});
		expect(request.headers).toMatchObject({ 'Idempotency-Key': 'e-1' });
		expect(output[0].json).toEqual({ task_id: TASK_ID, status: 'queued', count: 3 });
	});

	it('fails on empty domains without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			resource: 'enrich',
			domains: ' , \n ',
		});

		await expect(execute(context)).rejects.toThrow('Domains is empty');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('fails on more than 200 domains without calling the API', async () => {
		const domains = Array.from({ length: 201 }, (_, i) => `c${i}.com`).join(',');
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			resource: 'enrich',
			domains,
		});

		const error = await execute(context).catch((e: unknown) => e);

		expect((error as NodeOperationError).message).toBe('Too many domains (201)');
		expect((error as NodeOperationError).description).toContain('Nothing was charged');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe.each(['search', 'enrich'])('%s > Get, Pause, Resume, Cancel', (resource) => {
	it.each([
		['get', `GET ${TASK_PATH}`],
		['pause', `POST ${TASK_PATH}/pause`],
		['resume', `POST ${TASK_PATH}/resume`],
		['cancel', `POST ${TASK_PATH}/cancel`],
	])('%s calls %s with the trimmed task ID', async (operation, route) => {
		const { context, requests, httpRequestWithAuthentication } = createExecuteContext(
			{ resource, operation, taskId: ` ${TASK_ID} ` },
			{ http: () => response({ task_id: TASK_ID, status: 'running' }) },
		);

		const [output] = await execute(context);

		expect(requests()).toEqual([route]);
		expect(httpRequestWithAuthentication.mock.calls[0][1].body).toBeUndefined();
		expect(output).toEqual([
			{ json: { task_id: TASK_ID, status: 'running' }, pairedItem: { item: 0 } },
		]);
	});
});

describe('Get, Pause, Resume, Cancel', () => {
	it('fails on an empty task ID without calling the API', async () => {
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			operation: 'get',
			taskId: '  ',
		});

		await expect(execute(context)).rejects.toThrow('Task ID is empty');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Get Results', () => {
	const getResults = { operation: 'getResults', taskId: TASK_ID };

	it('waits while later stages fill companies in, then returns every page without a cursor first', async () => {
		const { context, requests } = createExecuteContext(getResults, {
			http: api({
				[`GET ${TASK_PATH}`]: taskStatuses(
					'queued',
					{ status: 'running', stage: 'enriching' },
					'completed',
				),
				[`GET ${TASK_PATH}/results`]: resultsPages(600),
			}),
		});

		const [output] = await execute(context);

		expect(output).toHaveLength(600);
		expect(output[0]).toEqual({
			json: { id: 'company:c0.com', domain: 'c0.com' },
			pairedItem: { item: 0 },
		});
		expect(clock.sleeps).toEqual([15000, 15000]);
		expect(requests()).toEqual([
			`GET ${TASK_PATH}`,
			`GET ${TASK_PATH}`,
			`GET ${TASK_PATH}`,
			`GET ${TASK_PATH}/results?limit=500`,
			`GET ${TASK_PATH}/results?limit=500&cursor=c500`,
		]);
	});

	it.each(['partial', 'cancelled'])('treats %s as finished', async (status) => {
		const { context } = createExecuteContext(
			{ ...getResults, resource: 'enrich' },
			{
				http: api({
					[`GET ${TASK_PATH}`]: taskStatuses('running', status),
					[`GET ${TASK_PATH}/results`]: resultsPages(2),
				}),
			},
		);

		const [output] = await execute(context);

		expect(output).toHaveLength(2);
		expect(clock.sleeps).toEqual([15000]);
	});

	it('without waiting, returns the companies delivered so far up to Limit', async () => {
		const { context, requests } = createExecuteContext(
			{ ...getResults, waitForCompletion: false, returnAll: false, limit: 120 },
			{ http: api({ [`GET ${TASK_PATH}/results`]: resultsPages(600) }) },
		);

		const [output] = await execute(context);

		expect(output).toHaveLength(120);
		expect(requests()).toEqual([`GET ${TASK_PATH}/results?limit=120`]);
	});

	it('fails with the task status when it does not finish in time', async () => {
		const { context, requests } = createExecuteContext(
			{ ...getResults, timeout: 40 },
			{
				http: api({
					[`GET ${TASK_PATH}`]: taskStatuses({ status: 'running', stage: 'enriching' }),
				}),
			},
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe(
			'The Company Search task did not finish within 40 seconds',
		);
		const description = (error as NodeOperationError).description;
		expect(description).toContain(TASK_ID);
		expect(description).toContain('every company is delivered');
		expect(description).toContain('companies delivered so far');
		expect(clock.sleeps).toEqual([15000, 15000, 10000]);
		expect(requests()).toHaveLength(4);
	});

	it('fails when the task failed, with its errors', async () => {
		const { context } = createExecuteContext(
			{ ...getResults, resource: 'enrich' },
			{ http: () => response({ status: 'failed', errors: [{ message: 'upstream down' }] }) },
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect((error as NodeOperationError).message).toBe('The Company Enrich task failed');
		expect((error as NodeOperationError).description).toBe('upstream down');
	});

	it('fails instead of waiting on a paused task', async () => {
		const { context } = createExecuteContext(getResults, { http: taskStatuses('paused') });

		const error = await execute(context).catch((e: unknown) => e);

		expect((error as NodeOperationError).message).toBe('The Company Search task is paused');
		expect((error as NodeOperationError).description).toContain('3 of 25 companies');
		expect(clock.sleeps).toEqual([]);
	});

	it('fails when the results expired', async () => {
		const { context } = createExecuteContext(getResults, { http: taskStatuses('expired') });

		await expect(execute(context)).rejects.toThrow('The Company Search results expired');
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

describe('Get Many', () => {
	it('lists the tasks of the resource type, with status and metadata filters, across pages', async () => {
		const pages: Record<string, IDataObject> = {
			start: { tasks: [{ task_id: 't1' }, { task_id: 't2' }], next_cursor: 'n1' },
			n1: { tasks: [{ task_id: 't3' }], next_cursor: null },
		};
		const { context, requests } = createExecuteContext(
			{
				resource: 'enrich',
				operation: 'getAll',
				returnAll: true,
				taskFilters: {
					status: ['running', 'paused'],
					metadata: { label: [{ key: 'campaign', value: 'q4' }] },
				},
			},
			{ http: (options) => response(pages[String(options.qs?.cursor ?? 'start')]) },
		);

		const [output] = await execute(context);

		expect(output.map((item) => item.json.task_id)).toEqual(['t1', 't2', 't3']);
		expect(requests()).toEqual([
			'GET /desearch/companies/tasks?type=enrich&status=running%2Cpaused&metadata.campaign=q4&limit=100',
			'GET /desearch/companies/tasks?type=enrich&status=running%2Cpaused&metadata.campaign=q4&limit=100&cursor=n1',
		]);
	});

	it('returns 50 Company Search tasks by default', async () => {
		const { context, requests } = createExecuteContext(
			{ operation: 'getAll' },
			{ http: () => response({ tasks: [], next_cursor: null }) },
		);

		await execute(context);

		expect(requests()).toEqual(['GET /desearch/companies/tasks?type=search&limit=50']);
	});

	it('refuses more than 3 metadata filters without calling the API', async () => {
		const label = ['a', 'b', 'c', 'd'].map((key) => ({ key, value: '1' }));
		const { context, httpRequestWithAuthentication } = createExecuteContext({
			operation: 'getAll',
			taskFilters: { metadata: { label } },
		});

		await expect(execute(context)).rejects.toThrow('Too many metadata filters');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('errors', () => {
	it('fails with the API reason as the description', async () => {
		const { context } = createExecuteContext(
			{ resource: 'enrich', operation: 'resume', taskId: TASK_ID },
			{
				http: () =>
					response(
						{ detail: 'Only a paused task can be resumed.', task: { status: 'completed' } },
						409,
					),
			},
		);

		const error = await execute(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('409');
		expect((error as NodeApiError).description).toBe('Only a paused task can be resumed.');
	});

	it('with Continue On Fail, outputs the error for the failed item and goes on', async () => {
		const { context } = createExecuteContext(
			[{ query: 'Fintech startups in Berlin' }, { resource: 'enrich', domains: 'acme.com' }],
			{
				continueOnFail: true,
				http: (options) =>
					options.url.endsWith('/search')
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
