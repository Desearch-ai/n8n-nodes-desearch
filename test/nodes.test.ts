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
import { nodeParameters, peopleNode, searchNode, withDefaults } from './helpers';

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
	it('registers both nodes and the credential', () => {
		expect(pkg.n8n.nodes).toEqual([
			'dist/nodes/Desearch/Desearch.node.js',
			'dist/nodes/DesearchPeopleSearch/DesearchPeopleSearch.node.js',
		]);
		expect(pkg.n8n.credentials).toEqual(['dist/credentials/DesearchApi.credentials.js']);
		expect('dependencies' in pkg).toBe(false);
	});

	it('uses the shared Desearch credential and icons', () => {
		expect(peopleNode.description.credentials).toEqual([{ name: 'desearchApi', required: true }]);
		expect(peopleNode.description.icon).toEqual(searchNode.description.icon);
		expect(peopleNode.description.name).toBe('desearchPeopleSearch');
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
			'search',
			'tiktok',
			'webPage',
			'x',
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
	])('%s has its operations', (resource, operations) => {
		expect(optionValues('operation', resource)).toEqual(operations);
	});

	it('routes every TikTok, Facebook and Instagram operation', () => {
		for (const resource of ['tiktok', 'facebook', 'instagram']) {
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
