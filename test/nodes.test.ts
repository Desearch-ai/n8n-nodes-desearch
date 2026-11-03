import {
	NodeHelpers,
	type INodeParameters,
	type INodeProperties,
	type INodePropertyOptions,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import pkg from '../package.json';
import { SOCIAL_ROUTES } from '../nodes/Desearch/GenericFunctions';
import { PEOPLE_SEARCH_FILTERS } from '../nodes/DesearchPeopleSearch/GenericFunctions';
import {
	companyNode,
	monitorsNode,
	nodeParameters,
	peopleNode,
	searchNode,
	withDefaults,
} from './helpers';

const withSearchDefaults = (parameters: INodeParameters) => nodeParameters(searchNode, parameters);

/** Paths of every function inside a value, e.g. ["properties[0].routing.output.postReceive[0]"]. */
function functionPaths(value: unknown, path = 'description'): string[] {
	if (typeof value === 'function') return [path];
	if (Array.isArray(value))
		return value.flatMap((entry, i) => functionPaths(entry, `${path}[${i}]`));
	if (value !== null && typeof value === 'object') {
		return Object.entries(value).flatMap(([key, entry]) => functionPaths(entry, `${path}.${key}`));
	}
	return [];
}

describe.each([
	['Desearch', searchNode.description],
	['Desearch People Search', peopleNode.description],
	['Desearch Company Search', companyNode.description],
	['Desearch Monitors', monitorsNode.description],
])('%s node description', (_name, description: INodeTypeDescription) => {
	// n8n runs structuredClone() on the description of every node that is usable as
	// an AI tool when it loads nodes; a function anywhere in it stops n8n from starting.
	it('can be structured-cloned, as n8n does for AI tools', () => {
		expect(description.usableAsTool).toBe(true);
		expect(functionPaths(description)).toEqual([]);
		expect(() => structuredClone(description)).not.toThrow();
	});
});

describe('package registration', () => {
	it('registers the four nodes and the credential', () => {
		expect(pkg.n8n.nodes).toEqual([
			'dist/nodes/Desearch/Desearch.node.js',
			'dist/nodes/DesearchPeopleSearch/DesearchPeopleSearch.node.js',
			'dist/nodes/DesearchCompanySearch/DesearchCompanySearch.node.js',
			'dist/nodes/DesearchMonitors/DesearchMonitors.node.js',
		]);
		expect(pkg.n8n.credentials).toEqual(['dist/credentials/DesearchApi.credentials.js']);
		expect('dependencies' in pkg).toBe(false);
	});

	it('uses the shared Desearch credential and icons', () => {
		for (const { description } of [peopleNode, companyNode, monitorsNode]) {
			expect(description.credentials).toEqual([{ name: 'desearchApi', required: true }]);
			expect(description.icon).toEqual(searchNode.description.icon);
		}
		expect(peopleNode.description.name).toBe('desearchPeopleSearch');
		expect(companyNode.description.name).toBe('desearchCompanySearch');
		expect(monitorsNode.description.name).toBe('desearchMonitors');
	});
});

describe('Desearch node resources and operations', () => {
	const { properties } = searchNode.description;
	const optionValues = (name: string, resource?: string) =>
		(
			properties.find(
				(p) =>
					p.name === name &&
					(resource === undefined || p.displayOptions?.show?.resource?.includes(resource)),
			)?.options as INodePropertyOptions[]
		).map((o) => o.value);

	it('groups operations by resource, Search first by default', () => {
		expect(optionValues('resource')).toEqual([
			'facebook',
			'instagram',
			'reddit',
			'search',
			'threads',
			'tiktok',
			'webPage',
			'x',
			'youtube',
		]);
		expect(withSearchDefaults({})).toMatchObject({ resource: 'search', operation: 'aiSearch' });
	});

	it.each([
		[
			'search',
			['aiSearch', 'aiWebLinksSearch', 'aiXLinksSearch', 'searchApi', 'webSearch', 'xSearch'],
		],
		['webPage', ['extract']],
		[
			'x',
			[
				'getPost',
				'getPostReplies',
				'getPostsByUrls',
				'getRetweeters',
				'getTrends',
				'getUserPosts',
				'getUserReplies',
				'searchUserPosts',
			],
		],
		[
			'tiktok',
			[
				'getComments',
				'getHashtagPosts',
				'getPost',
				'getProfile',
				'getProfilePosts',
				'getTrending',
				'search',
			],
		],
		[
			'facebook',
			['getComments', 'getHashtagPosts', 'getPost', 'getProfile', 'getProfilePosts', 'search'],
		],
		[
			'instagram',
			['getComments', 'getHashtagPosts', 'getPost', 'getProfile', 'getProfilePosts', 'search'],
		],
		[
			'youtube',
			['getChannel', 'getChannelVideos', 'getComments', 'getTranscript', 'getVideo', 'search'],
		],
		['reddit', ['getComments', 'getPost', 'getSubreddit', 'getSubredditPosts', 'search']],
		['threads', ['getPost', 'getProfile', 'getProfilePosts', 'search', 'searchUsers']],
	])('%s has its operations', (resource, operations) => {
		expect(optionValues('operation', resource)).toEqual(operations);
	});

	it('routes every TikTok, Facebook, Instagram, YouTube, Reddit and Threads operation', () => {
		for (const resource of ['tiktok', 'facebook', 'instagram', 'youtube', 'reddit', 'threads']) {
			expect(Object.keys(SOCIAL_ROUTES[resource]).sort(), resource).toEqual(
				[...optionValues('operation', resource)].sort(),
			);
		}
	});

	it('shows Cursor on every social list that pages, and only there', () => {
		const cursorShown = (resource: string, operation: string) =>
			'cursor' in withSearchDefaults({ resource, operation });
		for (const [resource, routes] of Object.entries(SOCIAL_ROUTES)) {
			for (const [operation, route] of Object.entries(routes)) {
				expect(cursorShown(resource, operation), `${resource} ${operation}`).toBe(
					route.cursor === true,
				);
			}
		}
		expect(cursorShown('x', 'getRetweeters')).toBe(true);
		expect(cursorShown('x', 'getUserPosts')).toBe(true);
		expect(cursorShown('x', 'getPost')).toBe(false);
	});

	it('shows Count on no YouTube, Reddit or Threads operation (they take none)', () => {
		for (const resource of ['youtube', 'reddit', 'threads']) {
			for (const [operation, route] of Object.entries(SOCIAL_ROUTES[resource])) {
				if (route.list) {
					expect(route.noCount, `${resource} ${operation}`).toBe(true);
				}
				expect('count' in withSearchDefaults({ resource, operation }), operation).toBe(false);
			}
		}
	});

	it('has the documented defaults', () => {
		expect(withSearchDefaults({ operation: 'aiWebLinksSearch' })).toMatchObject({
			count: 10,
			options: {},
		});
		expect(withSearchDefaults({ operation: 'searchApi' })).toMatchObject({ count: 10 });
		expect(withSearchDefaults({ resource: 'webPage' })).toMatchObject({
			operation: 'extract',
			format: 'text',
		});
		expect(withSearchDefaults({ resource: 'x' })).toMatchObject({ operation: 'getPost' });
		expect(withSearchDefaults({ resource: 'x', operation: 'getTrends' })).toMatchObject({
			woeid: 1,
			count: 30,
		});
		expect(withSearchDefaults({ resource: 'tiktok' })).toMatchObject({
			operation: 'search',
			count: 10,
			cursor: '',
		});
		expect(withSearchDefaults({ resource: 'tiktok', operation: 'getTrending' })).toMatchObject({
			region: 'US',
			count: 20,
		});
		expect(withSearchDefaults({ resource: 'instagram', operation: 'getComments' })).toMatchObject({
			count: 20,
			cursor: '',
		});
		expect(withSearchDefaults({ resource: 'youtube' })).toMatchObject({
			operation: 'search',
			query: '',
			cursor: '',
			options: {},
		});
		expect(withSearchDefaults({ resource: 'reddit', operation: 'getComments' })).toMatchObject({
			postId: '',
			cursor: '',
		});
		expect(withSearchDefaults({ resource: 'threads' })).toMatchObject({
			operation: 'search',
			options: {},
		});
		expect('cursor' in withSearchDefaults({ resource: 'threads' })).toBe(false);
	});
});

describe('Desearch People Search node parameters', () => {
	const { properties } = peopleNode.description;
	const optionValues = (resource: string) =>
		(
			properties.find(
				(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource),
			)?.options as INodePropertyOptions[]
		).map((o) => o.value);

	it('has the search and profile operations', () => {
		expect(optionValues('search')).toEqual([
			'cancel',
			'exportResults',
			'get',
			'getAll',
			'getResults',
			'pause',
			'resume',
			'start',
		]);
		expect(optionValues('profile')).toEqual(['export', 'getAll']);
	});

	it('has the documented defaults', () => {
		expect(withDefaults({ query: 'founders' })).toMatchObject({
			resource: 'search',
			operation: 'start',
			platform: 'x',
			count: 25,
			searchFilters: {},
			searchOptions: {},
		});
		expect(withDefaults({ operation: 'getResults', taskId: 'abc' })).toMatchObject({
			waitForCompletion: true,
			timeout: 600,
			pollInterval: 15,
			returnAll: true,
		});
		expect(withDefaults({ operation: 'getAll' })).toMatchObject({ returnAll: false, limit: 50 });
		expect(withDefaults({ operation: 'exportResults', taskId: 'abc' })).toMatchObject({
			waitForCompletion: true,
			timeout: 600,
			pollInterval: 15,
			format: 'csv',
			binaryPropertyName: 'data',
			resultFilters: {},
		});
		expect(withDefaults({ resource: 'profile', operation: 'export' })).toMatchObject({
			platform: 'x',
			sortBy: 'score',
			format: 'csv',
			binaryPropertyName: 'data',
			profileFilters: {},
		});
		expect(withDefaults({ resource: 'profile' })).toMatchObject({
			operation: 'getAll',
			platform: 'x',
			returnAll: false,
			limit: 50,
			sortBy: 'score',
		});
	});

	it('shows each platform only the Start filters the API accepts for it', () => {
		const filters = properties.find((p) => p.name === 'searchFilters')
			?.options as INodeProperties[];
		const apiNames: Record<string, string> = {
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
		for (const platform of ['x', 'youtube', 'linkedin', 'tiktok'] as const) {
			const shown = filters
				.filter((filter) =>
					NodeHelpers.displayParameter({}, filter, { typeVersion: 1 }, peopleNode.description, {
						resource: 'search',
						operation: 'start',
						platform,
					}),
				)
				.map((filter) => apiNames[filter.name])
				.sort();
			expect(shown, platform).toEqual([...PEOPLE_SEARCH_FILTERS[platform]].sort());
		}
	});
});

describe('Desearch Company Search node parameters', () => {
	const { properties } = companyNode.description;
	const optionValues = (resource: string) =>
		(
			properties.find(
				(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource),
			)?.options as INodePropertyOptions[]
		).map((o) => o.value);
	const shown = (parameters: Record<string, unknown>) =>
		properties
			.filter((property) =>
				NodeHelpers.displayParameter(
					withDefaults(parameters as never, companyNode),
					property,
					{ typeVersion: 1 },
					companyNode.description,
				),
			)
			.map((property) => property.name);

	it('has the same task operations for Company Search and Company Enrich', () => {
		const operations = ['cancel', 'get', 'getAll', 'getResults', 'pause', 'resume', 'start'];
		expect(optionValues('search')).toEqual(operations);
		expect(optionValues('enrich')).toEqual(operations);
		expect(
			(properties.find((p) => p.name === 'resource')?.options as INodePropertyOptions[]).map(
				(o) => o.value,
			),
		).toEqual(['enrich', 'search']);
	});

	it('has the documented defaults', () => {
		expect(withDefaults({ query: 'fintech startups' }, companyNode)).toMatchObject({
			resource: 'search',
			operation: 'start',
			count: 25,
			searchFilters: {},
			searchOptions: {},
		});
		expect(withDefaults({ resource: 'enrich', domains: 'acme.com' }, companyNode)).toMatchObject({
			operation: 'start',
			enrichOptions: {},
		});
		expect(
			withDefaults({ resource: 'enrich', operation: 'getResults', taskId: 'abc' }, companyNode),
		).toMatchObject({ waitForCompletion: true, timeout: 600, pollInterval: 15, returnAll: true });
		expect(withDefaults({ operation: 'getAll' }, companyNode)).toMatchObject({
			returnAll: false,
			limit: 50,
			taskFilters: {},
		});
	});

	it('shows each Start only its own fields', () => {
		expect(shown({ resource: 'search', operation: 'start' })).toEqual([
			'resource',
			'operation',
			'query',
			'count',
			'searchFilters',
			'searchOptions',
		]);
		expect(shown({ resource: 'enrich', operation: 'start' })).toEqual([
			'resource',
			'operation',
			'domains',
			'enrichOptions',
		]);
	});

	it('lists every option in alphabetical order, as n8n shows them', () => {
		const collections = properties.filter((p) => p.type === 'collection');
		for (const collection of collections) {
			const names = (collection.options as INodeProperties[]).map((o) => o.displayName);
			expect(names, collection.name).toEqual([...names].sort());
		}
	});
});

describe('Desearch Monitors node parameters', () => {
	const { properties } = monitorsNode.description;
	const optionValues = (resource: string) =>
		(
			properties.find(
				(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource),
			)?.options as INodePropertyOptions[]
		).map((o) => o.value);
	const shown = (parameters: Record<string, unknown>) =>
		properties
			.filter((property) =>
				NodeHelpers.displayParameter(
					withDefaults(parameters as never, monitorsNode),
					property,
					{ typeVersion: 1 },
					monitorsNode.description,
				),
			)
			.map((property) => property.name);

	it('has an operation for every Monitors route', () => {
		expect(
			(properties.find((p) => p.name === 'resource')?.options as INodePropertyOptions[]).map(
				(o) => o.value,
			),
		).toEqual(['item', 'monitor', 'run']);
		expect(optionValues('monitor')).toEqual([
			'create',
			'delete',
			'estimate',
			'get',
			'getAll',
			'rotateWebhookSecret',
			'testWebhook',
			'trigger',
			'update',
		]);
		expect(optionValues('run')).toEqual(['get', 'getAll']);
		expect(optionValues('item')).toEqual(['getAll']);
		const sources = (name: string) =>
			(properties.find((p) => p.name === name)?.options as INodePropertyOptions[]).map(
				(o) => o.value,
			);
		expect(sources('sources')).toEqual(['reddit', 'threads', 'tiktok', 'web', 'x', 'youtube']);
		const itemSource = (
			properties.find((p) => p.name === 'itemFilters')?.options as INodeProperties[]
		).find((o) => o.name === 'source')?.options as INodePropertyOptions[];
		expect(itemSource.map((o) => o.value)).toEqual([
			'reddit',
			'threads',
			'tiktok',
			'web',
			'x',
			'youtube',
		]);
	});

	it('has the documented defaults', () => {
		expect(withDefaults({ query: 'OpenAI launches' }, monitorsNode)).toMatchObject({
			resource: 'monitor',
			operation: 'create',
			sources: ['web', 'x'],
			interval: '1d',
			createOptions: {},
		});
		expect(
			withDefaults(
				{ resource: 'run', operation: 'get', monitorId: 'm', runId: 'r', waitForCompletion: true },
				monitorsNode,
			),
		).toMatchObject({ timeout: 300, pollInterval: 10, output: 'run' });
		expect(withDefaults({ resource: 'item', monitorId: 'm' }, monitorsNode)).toMatchObject({
			operation: 'getAll',
			returnAll: false,
			limit: 50,
			itemFilters: {},
		});
	});

	it('shows each operation only its own fields', () => {
		expect(shown({ operation: 'create' })).toEqual([
			'resource',
			'operation',
			'query',
			'sources',
			'interval',
			'createOptions',
		]);
		expect(shown({ operation: 'estimate' })).toEqual([
			'resource',
			'operation',
			'sources',
			'interval',
			'estimateOptions',
		]);
		expect(shown({ operation: 'update' })).toEqual([
			'resource',
			'operation',
			'monitorId',
			'updateFields',
		]);
		expect(shown({ operation: 'getAll' })).toEqual([
			'resource',
			'operation',
			'returnAll',
			'limit',
			'monitorFilters',
		]);
		for (const operation of ['delete', 'get', 'rotateWebhookSecret', 'testWebhook', 'trigger']) {
			expect(shown({ operation }), operation).toEqual(['resource', 'operation', 'monitorId']);
		}
		expect(shown({ resource: 'run', operation: 'get' })).toEqual([
			'resource',
			'operation',
			'monitorId',
			'runId',
			'waitForCompletion',
			'output',
		]);
		expect(shown({ resource: 'item', operation: 'getAll' })).toEqual([
			'resource',
			'operation',
			'monitorId',
			'returnAll',
			'limit',
			'itemFilters',
		]);
	});

	it('lists every option in alphabetical order, as n8n shows them', () => {
		const collections = properties.filter((p) => p.type === 'collection');
		for (const collection of collections) {
			const names = (collection.options as INodeProperties[]).map((o) => o.displayName);
			expect(names, collection.name).toEqual([...names].sort());
		}
	});
});
