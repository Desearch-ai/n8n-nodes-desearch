// Workflows saved with 0.2.0 must keep working: the Desearch node was declarative
// then (its operations sent requests through `routing`) and had no `resource`.
// Here the 0.2.0 description (test/fixtures/desearch-0.2.0.ts, copied unchanged)
// resolves saved parameters and its routing is evaluated into the request 0.2.0
// sent; the current node must resolve the same parameters and send the same request.
import {
	NodeHelpers,
	type IDataObject,
	type INodeParameters,
	type INodeProperties,
	type INodePropertyOptions,
	type IRequestOptionsSimplified,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { desearch020Description as v020 } from './fixtures/desearch-0.2.0';
import { createSearchContext, nodeParameters, response, searchNode } from './helpers';

/** Parameters as n8n resolves them with the 0.2.0 description. */
function resolveWith020(saved: INodeParameters): INodeParameters {
	return NodeHelpers.getNodeParameters(v020.properties, saved, true, false, null, v020) ?? {};
}

/**
 * The value of a 0.2.0 routing entry. 0.2.0 only used `={{$parameter.<name>}}` and
 * `={{$parameter.<name> || undefined}}`; any other expression fails the test.
 */
function evaluate(value: unknown, parameters: INodeParameters): unknown {
	if (typeof value === 'string' && value.startsWith('=')) {
		const match = /^=\{\{\$parameter\.(\w+)( \|\| undefined)?\}\}$/.exec(value);
		if (!match) throw new Error(`Unexpected expression in the 0.2.0 routing: ${value}`);
		const resolved = parameters[match[1]];
		return match[2] ? resolved || undefined : resolved;
	}
	if (Array.isArray(value)) return value.map((entry) => evaluate(entry, parameters));
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, evaluate(entry, parameters)]),
		);
	}
	return value;
}

/** The request 0.2.0 sent for saved parameters: its operation's routing plus requestDefaults. */
function request020(saved: INodeParameters) {
	const parameters = resolveWith020(saved);
	const operation = v020.properties.find((p) => p.name === 'operation');
	const option = (operation?.options as INodePropertyOptions[]).find(
		(o) => o.value === parameters.operation,
	);
	const { method, url, qs, body } = option?.routing?.request as IRequestOptionsSimplified & {
		method: string;
		url: string;
	};
	const evaluated = {
		method,
		url: `${v020.requestDefaults?.baseURL}${url}`,
		headers: v020.requestDefaults?.headers,
		qs: qs === undefined ? undefined : evaluate(qs, parameters),
		// The body goes out as JSON, where undefined values are left out.
		body: body === undefined ? undefined : JSON.parse(JSON.stringify(evaluate(body, parameters))),
	};
	return evaluated;
}

/** Saved workflows: n8n stores only parameters that differ from their default. */
const savedWorkflows: Array<[string, INodeParameters]> = [
	['AI Search with defaults', { prompt: 'Bittensor subnet news' }],
	[
		'AI Search with every option',
		{
			prompt: 'Bittensor subnet news',
			tools: ['web', 'hackernews', 'arxiv'],
			dateFilter: 'PAST_WEEK',
			resultType: 'ONLY_LINKS',
		},
	],
	['Web Search with defaults', { operation: 'webSearch', query: 'desearch' }],
	['Web Search, second page', { operation: 'webSearch', query: 'desearch', start: 20 }],
	['X Search with defaults', { operation: 'xSearch', query: 'bittensor' }],
	['X Search, latest', { operation: 'xSearch', query: 'bittensor', count: 5, sort: 'Latest' }],
	[
		// An exported workflow can carry every parameter, defaults included.
		'X Search saved with every parameter',
		{
			operation: 'xSearch',
			prompt: '',
			tools: ['web', 'twitter'],
			dateFilter: '',
			resultType: 'LINKS_WITH_FINAL_SUMMARY',
			query: 'bittensor',
			start: 0,
			count: 20,
			sort: 'Top',
		},
	],
];

describe('workflows saved with 0.2.0', () => {
	it('still load as the same node type and version', () => {
		expect(searchNode.description.name).toBe(v020.name);
		expect(searchNode.description.version).toBe(v020.version);
		expect(searchNode.description.credentials).toEqual(v020.credentials);
	});

	it('keep every 0.2.0 parameter name, type, default and option under Search', () => {
		for (const old of v020.properties.filter((p) => p.name !== 'operation')) {
			const current = searchNode.description.properties.filter(
				(p) =>
					p.name === old.name &&
					p.displayOptions?.show?.resource?.includes('search') &&
					(old.displayOptions?.show?.operation ?? []).every((operation) =>
						p.displayOptions?.show?.operation?.includes(operation),
					),
			);
			expect(current, old.name).toHaveLength(1);
			// Only the conditions that show a field changed (they now include the resource).
			const strip = (property: INodeProperties) => {
				const copy = { ...property };
				delete copy.displayOptions;
				return copy;
			};
			expect(strip(current[0]), old.name).toEqual(strip(old));
		}
	});

	it('keep the operation values aiSearch, webSearch and xSearch, aiSearch by default', () => {
		const operation = searchNode.description.properties.find(
			(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes('search'),
		);
		const values = (operation?.options as INodePropertyOptions[]).map((o) => o.value);
		expect(values).toEqual(expect.arrayContaining(['aiSearch', 'webSearch', 'xSearch']));
		expect(operation?.default).toBe('aiSearch');
		const resource = searchNode.description.properties.find((p) => p.name === 'resource');
		expect(resource?.default).toBe('search');
	});

	it.each(savedWorkflows)('%s: resolves to the same parameter values', (_name, saved) => {
		const before = resolveWith020(saved);
		const now = nodeParameters(searchNode, saved);
		expect(now.resource).toBe('search');
		for (const [name, value] of Object.entries(before)) {
			expect(now[name], name).toEqual(value);
		}
	});

	it.each(savedWorkflows)('%s: sends the same request', async (_name, saved) => {
		const expected = request020(saved);
		const { context, httpRequestWithAuthentication } = createSearchContext(saved, {
			http: () => response({}),
		});

		await searchNode.execute.call(context);

		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		const [credentialType, sent] = httpRequestWithAuthentication.mock.calls[0];
		expect(credentialType).toBe('desearchApi');
		expect({
			method: sent.method,
			url: sent.url,
			headers: sent.headers,
			qs: sent.qs,
			body: sent.body === undefined ? undefined : JSON.parse(JSON.stringify(sent.body)),
		}).toEqual(expected);
		expect(sent.arrayFormat).toBeUndefined();
		expect(sent.encoding).toBeUndefined();
	});

	it('output one item per post for X Search, as the declarative node did', async () => {
		const posts = [
			{ id: '1', text: 'a' },
			{ id: '2', text: 'b' },
		];
		const { context } = createSearchContext(
			[{ operation: 'xSearch', query: 'bittensor' }, { prompt: 'Bittensor' }],
			{
				http: (options) =>
					options.url.endsWith('/twitter')
						? response(posts)
						: response({ search: [{ link: 'https://desearch.ai' }], completion: 'Summary' }),
			},
		);

		const [output] = await searchNode.execute.call(context);

		expect(output).toEqual([
			{ json: posts[0], pairedItem: { item: 0 } },
			{ json: posts[1], pairedItem: { item: 0 } },
			{
				json: { search: [{ link: 'https://desearch.ai' }], completion: 'Summary' },
				pairedItem: { item: 1 },
			},
		]);
	});

	it('the 0.2.0 fixture is what 0.2.0 shipped: three routed operations', () => {
		const operation = v020.properties.find((p) => p.name === 'operation');
		const routes = (operation?.options as INodePropertyOptions[]).map((o) => [
			o.value,
			o.routing?.request?.method,
			o.routing?.request?.url,
		]);
		expect(routes).toEqual([
			['aiSearch', 'POST', '/desearch/ai/search'],
			['webSearch', 'GET', '/web'],
			['xSearch', 'GET', '/twitter'],
		]);
		expect(v020.requestDefaults).toEqual({
			baseURL: 'https://api.desearch.ai',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		} satisfies IDataObject);
	});
});
