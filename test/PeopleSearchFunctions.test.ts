import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
} from 'n8n-workflow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	apiErrorDetail,
	checkPeopleResponse,
	paginateProfiles,
	paginateResults,
	paginateTasks,
	prepareListProfiles,
	prepareListTasks,
	prepareStartSearch,
	splitList,
	waitForPeopleTask,
} from '../nodes/Desearch/PeopleSearchFunctions';
import { baseRequest, createContext, routingRequest } from './mocks';

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

/** An HTTP response as httpRequestWithAuthentication returns it with returnFullResponse. */
const response = (body: unknown, statusCode = 200): IN8nHttpFullResponse => ({
	body: body as IDataObject,
	headers: {},
	statusCode,
});

describe('splitList', () => {
	it('splits commas and new lines, trims and drops empty entries', () => {
		expect(splitList(' US, United Kingdom ,,\nDE ')).toEqual(['US', 'United Kingdom', 'DE']);
	});

	it('accepts arrays and empty values', () => {
		expect(splitList([' a ', '', 'b'])).toEqual(['a', 'b']);
		expect(splitList(undefined)).toEqual([]);
		expect(splitList('')).toEqual([]);
	});
});

describe('Start Search (prepareStartSearch)', () => {
	it('sends query, count, options and the filters of the chosen platform', async () => {
		const { context } = createContext({
			platform: 'x',
			query: '  Indie hackers who share their MRR ',
			count: 40,
			searchOptions: { minScore: 70, exclude: 'alice, bob', idempotencyKey: ' run-42 ' },
			searchFilters: {
				minFollowers: 200,
				maxFollowers: 50000,
				verifiedOnly: true,
				countries: 'US, GB',
				keywords: 'SaaS, MRR',
				excludeKeywords: 'giveaway',
			},
		});

		const request = await prepareStartSearch.call(context, baseRequest({ method: 'POST' }));

		expect(request.body).toEqual({
			query: 'Indie hackers who share their MRR',
			count: 40,
			min_score: 70,
			exclude: ['alice', 'bob'],
			filters: {
				min_followers: 200,
				max_followers: 50000,
				verified_only: true,
				countries: ['US', 'GB'],
				keywords: ['SaaS', 'MRR'],
				exclude_keywords: ['giveaway'],
			},
		});
		expect(request.headers).toMatchObject({
			Accept: 'application/json',
			'Idempotency-Key': 'run-42',
		});
	});

	it('maps YouTube subscriber filters and leaves out filters other platforms use', async () => {
		const { context } = createContext({
			platform: 'youtube',
			query: 'Fitness creators who review supplements',
			count: 25,
			searchFilters: {
				minSubscribers: 10000,
				maxSubscribers: 500000,
				requireContact: true,
				minFollowers: 5,
				verifiedOnly: true,
			},
		});

		const request = await prepareStartSearch.call(context, baseRequest({ method: 'POST' }));

		expect(request.body).toEqual({
			query: 'Fitness creators who review supplements',
			count: 25,
			filters: { min_subscribers: 10000, max_subscribers: 500000, require_contact: true },
		});
	});

	it('only sends filters LinkedIn and TikTok accept', async () => {
		const filters = {
			minFollowers: 100,
			countries: 'United States',
			requireContact: true,
			verifiedOnly: true,
			minSubscribers: 1,
		};

		const linkedin = createContext({
			platform: 'linkedin',
			query: 'Heads of sales',
			count: 5,
			searchFilters: filters,
		});
		const linkedinBody = (await prepareStartSearch.call(linkedin.context, baseRequest()))
			.body as IDataObject;
		expect(linkedinBody.filters).toEqual({ min_followers: 100, countries: ['United States'] });

		const tiktok = createContext({
			platform: 'tiktok',
			query: 'Skincare creators',
			count: 5,
			searchFilters: filters,
		});
		const tiktokBody = (await prepareStartSearch.call(tiktok.context, baseRequest()))
			.body as IDataObject;
		expect(tiktokBody.filters).toEqual({ min_followers: 100, require_contact: true });
	});

	it('sends no filters, exclude or Idempotency-Key when none are set', async () => {
		const { context } = createContext({
			platform: 'x',
			query: 'Bittensor builders',
			count: 25,
			searchOptions: { exclude: ' , ', idempotencyKey: '  ' },
			searchFilters: { keywords: '' },
		});

		const request = await prepareStartSearch.call(context, baseRequest({ method: 'POST' }));

		expect(request.body).toEqual({ query: 'Bittensor builders', count: 25 });
		expect(request.headers).not.toHaveProperty('Idempotency-Key');
	});

	it.each(['myspace', 'constructor'])(
		'rejects the unknown platform "%s" before anything is sent',
		async (platform) => {
			const { context } = createContext({ platform, query: 'anyone', count: 5 });

			await expect(prepareStartSearch.call(context, baseRequest())).rejects.toThrow(
				NodeOperationError,
			);
		},
	);
});

describe('List Tasks (prepareListTasks)', () => {
	it('sends platform and comma-separated statuses', async () => {
		const { context } = createContext({
			taskFilters: { platform: 'tiktok', status: ['running', 'paused'] },
		});

		const request = await prepareListTasks.call(context, baseRequest());

		expect(request.qs).toEqual({ platform: 'tiktok', status: 'running,paused' });
	});

	it('sends no filters by default', async () => {
		const { context } = createContext({});

		const request = await prepareListTasks.call(context, baseRequest());

		expect(request.qs).toEqual({});
	});
});

describe('List Profiles (prepareListProfiles)', () => {
	it('maps every result filter to the query string', async () => {
		const { context } = createContext({
			platform: 'x',
			sortBy: 'audience',
			profileFilters: {
				searchText: ' founder ',
				has: ['email', 'website'],
				minAudience: 1000,
				maxAudience: 0,
				minScore: 70,
				location: ' united states ',
				verifiedOnly: true,
			},
		});

		const request = await prepareListProfiles.call(
			context,
			baseRequest({ url: '/desearch/people/profiles' }),
		);

		expect(request.qs).toEqual({
			platform: 'x',
			sort: 'audience',
			q: 'founder',
			has: 'email,website',
			min_audience: 1000,
			max_audience: 0,
			min_score: 70,
			location: 'united states',
			verified: true,
		});
	});

	it('defaults to sorting by score and drops verified where the platform has no such filter', async () => {
		const { context } = createContext({
			platform: 'youtube',
			profileFilters: { verifiedOnly: true },
		});

		const request = await prepareListProfiles.call(context, baseRequest());

		expect(request.qs).toEqual({ platform: 'youtube', sort: 'score' });
	});
});

describe('Get Results: Wait for Completion (waitForPeopleTask)', () => {
	const waitParameters = {
		taskId: ` ${TASK_ID} `,
		waitForCompletion: true,
		timeout: 120,
		pollInterval: 15,
	};

	function taskSequence(...statuses: string[]) {
		let call = 0;
		return (options: IHttpRequestOptions) => {
			const status = statuses[Math.min(call, statuses.length - 1)];
			call++;
			return response({
				task_id: TASK_ID,
				status,
				count: 25,
				result_count: call * 3,
				url: options.url,
			});
		};
	}

	it('returns at once without polling when waiting is off', async () => {
		const { context, httpRequestWithAuthentication } = createContext({
			...waitParameters,
			waitForCompletion: false,
		});
		const request = baseRequest({ url: `/desearch/people/tasks/${TASK_ID}/results` });

		await expect(waitForPeopleTask.call(context, request)).resolves.toBe(request);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('polls the task every poll interval until it completes', async () => {
		const { context, httpRequestWithAuthentication } = createContext(waitParameters, {
			http: taskSequence('queued', 'running', 'running', 'completed'),
		});
		const request = baseRequest({
			url: `/desearch/people/tasks/${TASK_ID}/results`,
			timeout: 300000,
		});

		await expect(waitForPeopleTask.call(context, request)).resolves.toBe(request);

		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(4);
		expect(clock.sleeps).toEqual([15000, 15000, 15000]);
		const [credentialType, taskRequest] = httpRequestWithAuthentication.mock.calls[0];
		expect(credentialType).toBe('desearchApi');
		expect(taskRequest).toMatchObject({
			baseURL: 'https://api.desearch.ai',
			method: 'GET',
			url: `/desearch/people/tasks/${TASK_ID}`,
			json: true,
			ignoreHttpStatusErrors: true,
			returnFullResponse: true,
			timeout: 300000,
		});
		expect(taskRequest.body).toBeUndefined();
	});

	it.each(['partial', 'cancelled'])('treats %s as finished', async (status) => {
		const { context } = createContext(waitParameters, { http: taskSequence('running', status) });

		await expect(waitForPeopleTask.call(context, baseRequest())).resolves.toBeDefined();
		expect(clock.sleeps).toEqual([15000]);
	});

	it('fails with the task status when the search does not finish in time', async () => {
		const { context, httpRequestWithAuthentication } = createContext(
			{ ...waitParameters, timeout: 40 },
			{ http: taskSequence('running') },
		);

		const error = await waitForPeopleTask.call(context, baseRequest()).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe(
			'The search did not finish within 40 seconds',
		);
		expect((error as NodeOperationError).description).toContain(TASK_ID);
		expect((error as NodeOperationError).description).toContain('running');
		// 0s, 15s, 30s, then a last check at the 40s deadline.
		expect(clock.sleeps).toEqual([15000, 15000, 10000]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(4);
	});

	it('fails when the search failed, with its errors', async () => {
		const { context } = createContext(waitParameters, {
			http: () =>
				response({ task_id: TASK_ID, status: 'failed', errors: [{ message: 'upstream down' }] }),
		});

		const error = await waitForPeopleTask.call(context, baseRequest()).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe('The search failed');
		expect((error as NodeOperationError).description).toBe('upstream down');
	});

	it('fails instead of waiting on a paused search', async () => {
		const { context } = createContext(waitParameters, { http: taskSequence('paused') });

		const error = await waitForPeopleTask.call(context, baseRequest()).catch((e: unknown) => e);

		expect((error as NodeOperationError).message).toBe('The search is paused');
		expect(clock.sleeps).toEqual([]);
	});

	it('fails when the results expired', async () => {
		const { context } = createContext(waitParameters, { http: taskSequence('expired') });

		await expect(waitForPeopleTask.call(context, baseRequest())).rejects.toThrow(
			'The search results expired',
		);
	});

	it('fails with the API reason when the task cannot be read', async () => {
		const { context } = createContext(waitParameters, {
			http: () => response({ detail: 'Task not found' }, 404),
		});

		const error = await waitForPeopleTask.call(context, baseRequest()).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('404');
		expect((error as NodeApiError).description).toBe('Task not found');
	});

	it('wraps network errors in NodeApiError', async () => {
		const { context } = createContext(waitParameters, {
			http: () => {
				throw new Error('socket hang up');
			},
		});

		await expect(waitForPeopleTask.call(context, baseRequest())).rejects.toThrow(NodeApiError);
	});

	it('stops when the execution is cancelled', async () => {
		const controller = new AbortController();
		controller.abort();
		const { context, httpRequestWithAuthentication } = createContext(waitParameters, {
			cancelSignal: controller.signal,
		});

		await expect(waitForPeopleTask.call(context, baseRequest())).rejects.toThrow(/cancelled/);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('Get Results pagination (paginateResults)', () => {
	const people = (from: number, to: number) =>
		Array.from({ length: to - from }, (_, i) => ({
			id: `p${from + i}`,
			platform: 'x',
			handle: `h${from + i}`,
		}));

	/** Serves 1,200 results in pages of `limit`, with cursors "c<offset>". */
	function resultsApi(total: number) {
		return (options: IHttpRequestOptions) => {
			const qs = options.qs ?? {};
			const offset = qs.cursor ? Number(String(qs.cursor).slice(1)) : 0;
			const limit = Number(qs.limit);
			const end = Math.min(total, offset + limit);
			return {
				task_id: TASK_ID,
				status: 'completed',
				results: people(offset, end),
				next_cursor: `c${end}`,
				has_more: end < total,
			};
		};
	}

	it('returns every page as one item per person when Return All is on', async () => {
		const { context, makeRoutingRequest } = createContext(
			{ returnAll: true },
			{ routing: resultsApi(1200) },
		);

		const items = await paginateResults.call(context, routingRequest({ qs: {} }));

		expect(items).toHaveLength(1200);
		expect(items[0]).toEqual({ json: { id: 'p0', platform: 'x', handle: 'h0' } });
		expect(items[1199].json.id).toBe('p1199');
		const pages = makeRoutingRequest.mock.calls.map(([request]) => request.options.qs);
		expect(pages).toEqual([
			{ limit: 500 },
			{ limit: 500, cursor: 'c500' },
			{ limit: 500, cursor: 'c1000' },
		]);
	});

	it('stops at Limit and asks only for what is still missing', async () => {
		const { context, makeRoutingRequest } = createContext(
			{ returnAll: false, limit: 700 },
			{ routing: resultsApi(1200) },
		);

		const items = await paginateResults.call(context, routingRequest());

		expect(items).toHaveLength(700);
		const pages = makeRoutingRequest.mock.calls.map(([request]) => request.options.qs);
		expect(pages).toEqual([{ limit: 500 }, { limit: 200, cursor: 'c500' }]);
	});

	it('returns no items when the search has found no one yet', async () => {
		const { context, makeRoutingRequest } = createContext(
			{ returnAll: true },
			{ routing: () => ({ status: 'running', results: [], next_cursor: 'c0', has_more: false }) },
		);

		await expect(paginateResults.call(context, routingRequest())).resolves.toEqual([]);
		expect(makeRoutingRequest).toHaveBeenCalledTimes(1);
	});
});

describe('List Tasks and List Profiles pagination', () => {
	it('follows next_cursor until it is null and keeps the filters on every page', async () => {
		const pages: Record<string, IDataObject> = {
			start: { tasks: [{ task_id: 't1' }, { task_id: 't2' }], next_cursor: 'n1' },
			n1: { tasks: [{ task_id: 't3' }], next_cursor: null },
		};
		const { context, makeRoutingRequest } = createContext(
			{ returnAll: true },
			{ routing: (options) => pages[String(options.qs?.cursor ?? 'start')] },
		);

		const items = await paginateTasks.call(context, routingRequest({ qs: { platform: 'x' } }));

		expect(items.map((item) => item.json.task_id)).toEqual(['t1', 't2', 't3']);
		expect(makeRoutingRequest.mock.calls.map(([request]) => request.options.qs)).toEqual([
			{ platform: 'x', limit: 100 },
			{ platform: 'x', limit: 100, cursor: 'n1' },
		]);
	});

	it('asks for at most 200 profiles per page and stops at Limit', async () => {
		const { context, makeRoutingRequest } = createContext(
			{ returnAll: false, limit: 3 },
			{
				routing: () => ({
					profiles: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
					total: 10,
					next_cursor: 'more',
				}),
			},
		);

		const items = await paginateProfiles.call(
			context,
			routingRequest({ qs: { platform: 'linkedin', sort: 'score' } }),
		);

		expect(items.map((item) => item.json.id)).toEqual(['a', 'b', 'c']);
		expect(makeRoutingRequest).toHaveBeenCalledTimes(1);
		expect(makeRoutingRequest.mock.calls[0][0].options.qs).toEqual({
			platform: 'linkedin',
			sort: 'score',
			limit: 3,
		});
	});

	it('uses the default limit of 50 when Return All is off', async () => {
		const { context, makeRoutingRequest } = createContext(
			{ returnAll: false },
			{ routing: () => ({ profiles: [], total: 0, next_cursor: null }) },
		);

		await paginateProfiles.call(context, routingRequest({ qs: { platform: 'x' } }));

		expect(makeRoutingRequest.mock.calls[0][0].options.qs).toEqual({ platform: 'x', limit: 50 });
	});
});

describe('API errors (checkPeopleResponse)', () => {
	const items: INodeExecutionData[] = [{ json: { task_id: TASK_ID } }];

	it('passes successful responses through', async () => {
		const { context } = createContext({});

		await expect(
			checkPeopleResponse.call(context, items, response({ task_id: TASK_ID }, 202)),
		).resolves.toBe(items);
	});

	it.each([
		[402, { detail: 'Not enough credits for the reservation.' }],
		[409, { detail: 'Task is completed; it cannot be paused.', task: { status: 'completed' } }],
		[429, { detail: 'Too many searches are already queued, running or paused.' }],
	])('fails HTTP %i with the API detail as the description', async (statusCode, body) => {
		const { context } = createContext({});

		const error = await checkPeopleResponse
			.call(context, items, response(body, statusCode))
			.catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe(String(statusCode));
		expect((error as NodeApiError).description).toBe(body.detail);
		expect((error as NodeApiError).context.itemIndex).toBe(0);
	});

	it('lists validation errors by field', () => {
		expect(
			apiErrorDetail({
				detail: [
					{ loc: ['body', 'query'], msg: 'String should have at least 3 characters' },
					{ loc: ['body', 'filters', 'min_followers'], msg: 'Input should be >= 0' },
				],
			}),
		).toBe(
			'query: String should have at least 3 characters; filters.min_followers: Input should be >= 0',
		);
	});

	it('handles bodies without a detail', () => {
		expect(apiErrorDetail('Bad gateway')).toBe('Bad gateway');
		expect(apiErrorDetail('<html><body>502 Bad Gateway</body></html>')).toBeUndefined();
		expect(apiErrorDetail('')).toBeUndefined();
		expect(apiErrorDetail({ error: 'x' })).toBeUndefined();
		expect(apiErrorDetail(undefined)).toBeUndefined();
	});
});
