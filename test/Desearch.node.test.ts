import {
	NodeHelpers,
	Workflow,
	type INode,
	type INodeParameters,
	type INodeProperties,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypes,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { Desearch } from '../nodes/Desearch/Desearch.node';
import {
	PEOPLE_SEARCH_FILTERS,
	checkPeopleResponse,
	paginateProfiles,
	paginateResults,
	paginateTasks,
	prepareListProfiles,
	prepareListTasks,
	prepareStartSearch,
	waitForPeopleTask,
} from '../nodes/Desearch/PeopleSearchFunctions';

const nodeType = new Desearch();
const { properties } = nodeType.description;

function operationProperty(resource: string): INodeProperties {
	const property = properties.find(
		(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource),
	);
	if (!property) throw new Error(`No operation property for resource ${resource}`);
	return property;
}

function operation(resource: string, value: string): INodePropertyOptions {
	const option = (operationProperty(resource).options as INodePropertyOptions[]).find(
		(o) => o.value === value,
	);
	if (!option) throw new Error(`No operation ${resource}.${value}`);
	return option;
}

/** Parameters the node gets in a workflow, with defaults filled in like n8n does on load. */
function nodeParameters(parameters: INodeParameters): INodeParameters {
	return (
		NodeHelpers.getNodeParameters(
			properties,
			parameters,
			true,
			false,
			null,
			nodeType.description,
		) ?? {}
	);
}

/** Resolves a routing expression with n8n's expression engine for a node with these parameters. */
function resolve(expression: string, parameters: INodeParameters): unknown {
	const node: INode = {
		id: 'desearch-node',
		name: 'Desearch',
		type: 'n8n-nodes-desearch.desearch',
		typeVersion: 1,
		position: [0, 0],
		parameters: nodeParameters(parameters),
	};
	const nodeTypes: INodeTypes = {
		getByName: () => nodeType,
		getByNameAndVersion: () => nodeType as INodeType,
		getKnownTypes: () => ({}),
	};
	const workflow = new Workflow({ nodes: [node], connections: {}, active: false, nodeTypes });
	return workflow.expression.getSimpleParameterValue(node, expression, 'manual', {});
}

describe('Desearch node description', () => {
	it('keeps existing workflows on the Search resource', () => {
		const resource = properties.find((p) => p.name === 'resource');
		expect(resource?.default).toBe('search');
		expect(nodeParameters({ operation: 'webSearch', query: 'desearch' })).toMatchObject({
			resource: 'search',
			operation: 'webSearch',
		});
		expect(nodeParameters({})).toMatchObject({ resource: 'search', operation: 'aiSearch' });
	});

	it('leaves the AI, web and X search routing unchanged', () => {
		expect(operation('search', 'aiSearch').routing).toEqual({
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
		});
		expect(operation('search', 'webSearch').routing).toEqual({
			request: {
				method: 'GET',
				url: '/web',
				qs: { query: '={{$parameter.query}}', start: '={{$parameter.start}}' },
			},
		});
		expect(operation('search', 'xSearch').routing).toEqual({
			request: {
				method: 'GET',
				url: '/twitter',
				qs: {
					query: '={{$parameter.query}}',
					count: '={{$parameter.count}}',
					sort: '={{$parameter.sort}}',
				},
			},
		});
	});

	it('lists the People Search operations', () => {
		const values = (operationProperty('peopleSearch').options as INodePropertyOptions[]).map(
			(o) => o.value,
		);
		expect(values).toEqual([
			'cancelTask',
			'getResults',
			'getTask',
			'listProfiles',
			'listTasks',
			'pauseTask',
			'resumeTask',
			'startSearch',
		]);
	});

	it('routes every People Search operation to its API route', () => {
		const routes = Object.fromEntries(
			(operationProperty('peopleSearch').options as INodePropertyOptions[]).map((o) => [
				o.value,
				`${o.routing?.request?.method} ${o.routing?.request?.url}`,
			]),
		);
		const task =
			'/desearch/people/tasks/{{ encodeURIComponent(String($parameter.taskId).trim()) }}';
		expect(routes).toEqual({
			startSearch: 'POST =/desearch/people/search/{{ $parameter.platform }}',
			getTask: `GET =${task}`,
			getResults: `GET =${task}/results`,
			pauseTask: `POST =${task}/pause`,
			resumeTask: `POST =${task}/resume`,
			cancelTask: `POST =${task}/cancel`,
			listTasks: 'GET /desearch/people/tasks',
			listProfiles: 'GET /desearch/people/profiles',
		});
	});

	it('checks the HTTP status of every People Search request itself', () => {
		for (const option of operationProperty('peopleSearch').options as INodePropertyOptions[]) {
			expect(option.routing?.request?.ignoreHttpStatusErrors, option.value as string).toBe(true);
			expect(option.routing?.output?.postReceive, option.value as string).toEqual([
				checkPeopleResponse,
			]);
		}
	});

	it('wires the request hooks and pagination', () => {
		expect(operation('peopleSearch', 'startSearch').routing?.send).toEqual({
			preSend: [prepareStartSearch],
		});
		expect(operation('peopleSearch', 'getResults').routing).toMatchObject({
			send: { preSend: [waitForPeopleTask], paginate: true },
			operations: { pagination: paginateResults },
		});
		expect(operation('peopleSearch', 'listTasks').routing).toMatchObject({
			send: { preSend: [prepareListTasks], paginate: true },
			operations: { pagination: paginateTasks },
		});
		expect(operation('peopleSearch', 'listProfiles').routing).toMatchObject({
			send: { preSend: [prepareListProfiles], paginate: true },
			operations: { pagination: paginateProfiles },
		});
	});

	it('shows each platform only the Start Search filters the API accepts for it', () => {
		const filters = properties.find((p) => p.name === 'searchFilters')
			?.options as INodeProperties[];
		const shown = (platform: string) =>
			filters
				.filter((filter) =>
					NodeHelpers.displayParameter({}, filter, { typeVersion: 1 }, nodeType.description, {
						resource: 'peopleSearch',
						operation: 'startSearch',
						platform,
					}),
				)
				.map((filter) => filter.name)
				.sort();

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
			expect(
				shown(platform)
					.map((name) => apiNames[name])
					.sort(),
				platform,
			).toEqual([...PEOPLE_SEARCH_FILTERS[platform]].sort());
		}
	});

	it('defaults Start Search to 25 people on X and Get Results to waiting for every result', () => {
		expect(
			nodeParameters({ resource: 'peopleSearch', operation: 'startSearch', query: 'founders' }),
		).toMatchObject({ platform: 'x', count: 25, searchFilters: {}, searchOptions: {} });
		expect(
			nodeParameters({ resource: 'peopleSearch', operation: 'getResults', taskId: 'abc' }),
		).toMatchObject({ waitForCompletion: true, timeout: 600, pollInterval: 15, returnAll: true });
		expect(nodeParameters({ resource: 'peopleSearch', operation: 'listProfiles' })).toMatchObject({
			platform: 'x',
			returnAll: false,
			limit: 50,
			sortBy: 'score',
		});
	});
});

describe('People Search routing expressions', () => {
	it('builds the Start Search URL from the platform', () => {
		const url = operation('peopleSearch', 'startSearch').routing?.request?.url as string;
		expect(
			resolve(url, {
				resource: 'peopleSearch',
				operation: 'startSearch',
				platform: 'tiktok',
				query: 'q',
			}),
		).toBe('/desearch/people/search/tiktok');
	});

	it('trims and encodes the task ID in task URLs', () => {
		const url = operation('peopleSearch', 'pauseTask').routing?.request?.url as string;
		expect(
			resolve(url, {
				resource: 'peopleSearch',
				operation: 'pauseTask',
				taskId: ' 5b33f3ee-168b-4780-9c8e-63a626781872 ',
			}),
		).toBe('/desearch/people/tasks/5b33f3ee-168b-4780-9c8e-63a626781872/pause');
		expect(
			resolve(url, { resource: 'peopleSearch', operation: 'pauseTask', taskId: 'a/../b?c' }),
		).toBe('/desearch/people/tasks/a%2F..%2Fb%3Fc/pause');
	});
});
