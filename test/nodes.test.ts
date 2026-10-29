import {
	NodeHelpers,
	type INodeProperties,
	type INodePropertyOptions,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { Desearch } from '../nodes/Desearch/Desearch.node';
import pkg from '../package.json';
import { PEOPLE_SEARCH_FILTERS } from '../nodes/DesearchPeopleSearch/GenericFunctions';
import { companyNode, peopleNode, withDefaults } from './helpers';

const searchNode = new Desearch();

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
	it('registers the three nodes and the credential', () => {
		expect(pkg.n8n.nodes).toEqual([
			'dist/nodes/Desearch/Desearch.node.js',
			'dist/nodes/DesearchPeopleSearch/DesearchPeopleSearch.node.js',
			'dist/nodes/DesearchCompanySearch/DesearchCompanySearch.node.js',
		]);
		expect(pkg.n8n.credentials).toEqual(['dist/credentials/DesearchApi.credentials.js']);
		expect('dependencies' in pkg).toBe(false);
	});

	it('uses the shared Desearch credential and icons', () => {
		for (const { description } of [peopleNode, companyNode]) {
			expect(description.credentials).toEqual([{ name: 'desearchApi', required: true }]);
			expect(description.icon).toEqual(searchNode.description.icon);
		}
		expect(peopleNode.description.name).toBe('desearchPeopleSearch');
		expect(companyNode.description.name).toBe('desearchCompanySearch');
	});
});

describe('Desearch node (AI, web and X search)', () => {
	const operations = searchNode.description.properties.find((p) => p.name === 'operation')
		?.options as INodePropertyOptions[];

	it('keeps the same parameters as before People Search', () => {
		expect(searchNode.description.properties.map((p) => p.name)).toEqual([
			'operation',
			'prompt',
			'tools',
			'dateFilter',
			'resultType',
			'query',
			'start',
			'count',
			'sort',
		]);
		expect(operations.map((o) => o.value)).toEqual(['aiSearch', 'webSearch', 'xSearch']);
	});

	it('keeps the AI, web and X search routing', () => {
		expect(operations.map((o) => o.routing)).toEqual([
			{
				request: {
					method: 'POST',
					url: '/desearch/ai/search',
					body: {
						prompt: '={{$parameter.prompt}}',
						tools: '={{$parameter.tools}}',
						date_filter: '={{$parameter.dateFilter || undefined}}',
						result_type: '={{$parameter.resultType}}',
						streaming: false,
					},
				},
			},
			{
				request: {
					method: 'GET',
					url: '/web',
					qs: { query: '={{$parameter.query}}', start: '={{$parameter.start}}' },
				},
			},
			{
				request: {
					method: 'GET',
					url: '/twitter',
					qs: {
						query: '={{$parameter.query}}',
						count: '={{$parameter.count}}',
						sort: '={{$parameter.sort}}',
					},
				},
			},
		]);
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
			'get',
			'getAll',
			'getResults',
			'pause',
			'resume',
			'start',
		]);
		expect(optionValues('profile')).toEqual(['getAll']);
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
