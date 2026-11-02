import { NodeApiError, NodeOperationError, type IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { apiDate, compact, listPage, toItems } from '../nodes/Desearch/GenericFunctions';
import {
	apiError,
	apiErrorDetail,
	attachmentFileName,
	buildExportResultsQuery,
	buildListProfilesQuery,
	buildListTasksQuery,
	buildStartSearchRequest,
	splitList,
	taskPath,
} from '../nodes/DesearchPeopleSearch/GenericFunctions';
import { responseHeader } from '../nodes/shared/transport';
import { node, response } from './helpers';

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

describe('taskPath', () => {
	it('encodes the task ID', () => {
		expect(taskPath('5b33f3ee-168b-4780-9c8e-63a626781872', '/pause')).toBe(
			'/desearch/people/tasks/5b33f3ee-168b-4780-9c8e-63a626781872/pause',
		);
		expect(taskPath('a/../b?c')).toBe('/desearch/people/tasks/a%2F..%2Fb%3Fc');
	});
});

describe('buildStartSearchRequest', () => {
	const start = (parameters: {
		platform: string;
		query?: string;
		count?: number;
		searchOptions?: IDataObject;
		searchFilters?: IDataObject;
	}) =>
		buildStartSearchRequest(node, 0, {
			query: 'founders',
			count: 25,
			searchOptions: {},
			searchFilters: {},
			...parameters,
		});

	it('sends query, count, options and the filters of the chosen platform', () => {
		expect(
			start({
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
			}),
		).toEqual({
			path: '/desearch/people/search/x',
			body: {
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
			},
			headers: { 'Idempotency-Key': 'run-42' },
		});
	});

	it('maps YouTube subscriber filters and leaves out filters other platforms use', () => {
		const { path, body } = start({
			platform: 'youtube',
			searchFilters: {
				minSubscribers: 10000,
				maxSubscribers: 500000,
				requireContact: true,
				minFollowers: 5,
				verifiedOnly: true,
			},
		});
		expect(path).toBe('/desearch/people/search/youtube');
		expect(body.filters).toEqual({
			min_subscribers: 10000,
			max_subscribers: 500000,
			require_contact: true,
		});
	});

	it('only sends filters LinkedIn and TikTok accept', () => {
		const searchFilters = {
			minFollowers: 100,
			countries: 'United States',
			requireContact: true,
			verifiedOnly: true,
			minSubscribers: 1,
		};
		expect(start({ platform: 'linkedin', searchFilters }).body.filters).toEqual({
			min_followers: 100,
			countries: ['United States'],
		});
		expect(start({ platform: 'tiktok', searchFilters }).body.filters).toEqual({
			min_followers: 100,
			require_contact: true,
		});
	});

	it('sends no filters, exclude or Idempotency-Key when none are set', () => {
		expect(
			start({
				platform: 'x',
				searchOptions: { exclude: ' , ', idempotencyKey: '  ' },
				searchFilters: { keywords: '' },
			}),
		).toEqual({
			path: '/desearch/people/search/x',
			body: { query: 'founders', count: 25 },
			headers: {},
		});
	});

	it.each(['myspace', 'constructor', ''])('rejects the unknown platform "%s"', (platform) => {
		expect(() => start({ platform })).toThrow(NodeOperationError);
	});
});

describe('buildListTasksQuery', () => {
	it('sends platform and comma-separated statuses', () => {
		expect(buildListTasksQuery({ platform: 'tiktok', status: ['running', 'paused'] })).toEqual({
			platform: 'tiktok',
			status: 'running,paused',
		});
		expect(buildListTasksQuery({})).toEqual({});
	});
});

describe('buildListProfilesQuery', () => {
	it('maps every result filter', () => {
		expect(
			buildListProfilesQuery('x', 'audience', {
				searchText: ' founder ',
				has: ['email', 'website'],
				minAudience: 1000,
				maxAudience: 0,
				minScore: 70,
				location: ' united states ',
				verifiedOnly: true,
			}),
		).toEqual({
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

	it('drops verified where the platform has no such filter', () => {
		expect(buildListProfilesQuery('youtube', 'score', { verifiedOnly: true })).toEqual({
			platform: 'youtube',
			sort: 'score',
		});
	});
});

describe('API errors', () => {
	it('uses the API detail as the error description', () => {
		const error = apiError(node, 409, { detail: 'Task is completed; it cannot be paused.' }, 2);
		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.httpCode).toBe('409');
		expect(error.description).toBe('Task is completed; it cannot be paused.');
		expect(error.context.itemIndex).toBe(2);
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

describe('buildExportResultsQuery', () => {
	it('sends the format and the result filters, verified as set', () => {
		expect(
			buildExportResultsQuery('jsonl', {
				has: ['email', 'x'],
				minAudience: 0,
				maxAudience: 1000,
				minScore: 80,
				location: ' berlin ',
				verifiedOnly: true,
			}),
		).toEqual({
			format: 'jsonl',
			has: 'email,x',
			min_audience: 0,
			max_audience: 1000,
			min_score: 80,
			location: 'berlin',
			verified: true,
		});
		expect(buildExportResultsQuery('csv', { verifiedOnly: false })).toEqual({ format: 'csv' });
	});
});

describe('attachmentFileName', () => {
	it('reads the file name of an attachment', () => {
		expect(attachmentFileName('attachment; filename="people-search-x-profiles.csv"')).toBe(
			'people-search-x-profiles.csv',
		);
		expect(attachmentFileName('attachment; filename=results.jsonl')).toBe('results.jsonl');
		expect(attachmentFileName("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.csv")).toBe(
			'r%C3%A9sum%C3%A9.csv',
		);
	});

	it('keeps only the base name and ignores headers without one', () => {
		expect(attachmentFileName('attachment; filename="../../etc/passwd"')).toBe('passwd');
		expect(attachmentFileName('inline')).toBeUndefined();
		expect(attachmentFileName(undefined)).toBeUndefined();
	});
});

describe('Desearch node helpers', () => {
	it('toItems: one item per array entry, one item for an object, none for nothing', () => {
		expect(toItems([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
		expect(toItems(['a'])).toEqual([{ value: 'a' }]);
		expect(toItems({ a: 1 })).toEqual([{ a: 1 }]);
		expect(toItems('text')).toEqual([{ value: 'text' }]);
		expect(toItems(undefined)).toEqual([]);
		expect(toItems([])).toEqual([]);
	});

	it('listPage: results and the next cursor header, null when absent', () => {
		expect(listPage(response([{ id: 1 }], 200, { 'x-desearch-next-cursor': 'abc' }))).toEqual({
			results: [{ id: 1 }],
			nextCursor: 'abc',
		});
		expect(listPage(response([], 200, { 'x-desearch-next-cursor': '' }))).toEqual({
			results: [],
			nextCursor: null,
		});
		expect(listPage(response({}))).toEqual({ results: [], nextCursor: null });
		expect(listPage(response({ id: 1 }))).toEqual({ results: [{ id: 1 }], nextCursor: null });
	});

	it('responseHeader: any case, first value of a list', () => {
		const reply = response({}, 200, { 'Content-Disposition': 'a', 'set-cookie': ['b', 'c'] });
		expect(responseHeader(reply, 'content-disposition')).toBe('a');
		expect(responseHeader(reply, 'Set-Cookie')).toBe('b');
		expect(responseHeader(reply, 'x-missing')).toBeUndefined();
	});

	it('apiDate: UTC date-times, or days, from dates with or without a time zone', () => {
		expect(apiDate(node, 0, '2025-05-01T00:00:00', 'Start Date')).toBe('2025-05-01T00:00:00Z');
		expect(apiDate(node, 0, '2025-05-01T08:15', 'Start Date')).toBe('2025-05-01T08:15:00Z');
		expect(apiDate(node, 0, '2025-05-01T02:00:00.000+02:00', 'Start Date')).toBe(
			'2025-05-01T00:00:00Z',
		);
		expect(apiDate(node, 0, '2025-05-01', 'Start Date')).toBe('2025-05-01T00:00:00Z');
		expect(apiDate(node, 0, '2026-09-17T23:30:00', 'End Date', true)).toBe('2026-09-17');
		expect(apiDate(node, 0, '', 'Start Date')).toBeUndefined();
		expect(() => apiDate(node, 3, 'soon', 'End Date')).toThrow('End Date is not a valid date');
	});

	it('compact drops unset values but keeps false and 0', () => {
		expect(compact({ a: undefined, b: null, c: '', d: false, e: 0, f: 'x' })).toEqual({
			d: false,
			e: 0,
			f: 'x',
		});
	});
});
