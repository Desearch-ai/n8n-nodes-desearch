import {
	NodeHelpers,
	type IDataObject,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INode,
	type INodeParameters,
	type INodeType,
} from 'n8n-workflow';
import { vi } from 'vitest';

import { Desearch } from '../nodes/Desearch/Desearch.node';
import { DesearchPeopleSearch } from '../nodes/DesearchPeopleSearch/DesearchPeopleSearch.node';
import { createNodeExecuteContext } from './context';

export const peopleNode = new DesearchPeopleSearch();
export const searchNode = new Desearch();

export const node: INode = {
	id: 'people-node',
	name: 'Desearch People Search',
	type: 'n8n-nodes-desearch.desearchPeopleSearch',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

export const desearchNode: INode = {
	id: 'desearch-node',
	name: 'Desearch',
	type: 'n8n-nodes-desearch.desearch',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

/** Node parameters with defaults filled in, the way n8n does when it loads a workflow. */
export function nodeParameters(nodeType: INodeType, parameters: INodeParameters): INodeParameters {
	const { description } = nodeType;
	return (
		NodeHelpers.getNodeParameters(
			description.properties,
			parameters,
			true,
			false,
			null,
			description,
		) ?? {}
	);
}

/** People Search node parameters with defaults filled in. */
export function withDefaults(parameters: INodeParameters): INodeParameters {
	return nodeParameters(peopleNode, parameters);
}

/** An HTTP response as httpRequestWithAuthentication returns it with returnFullResponse. */
export function response(
	body: unknown,
	statusCode = 200,
	headers: IDataObject = {},
): IN8nHttpFullResponse {
	return { body: body as IDataObject, headers, statusCode };
}

/**
 * The path and query of a request, e.g. "GET /desearch/people/tasks?limit=100".
 * List values are repeated (`urls=a&urls=b`), which is how the node asks n8n to send them.
 */
export function describeRequest(options: IHttpRequestOptions): string {
	const path = options.url.replace('https://api.desearch.ai', '');
	const query = new URLSearchParams(
		Object.entries(options.qs ?? {}).flatMap(([key, value]) =>
			(Array.isArray(value) ? value : [value]).map((entry) => [key, String(entry)]),
		),
	).toString();
	return `${options.method} ${path}${query ? `?${query}` : ''}`;
}

export type HttpHandler = (options: IHttpRequestOptions) => IN8nHttpFullResponse;

function contextFor(nodeType: INodeType, nodeData: INode) {
	return (
		items: INodeParameters | INodeParameters[],
		{
			http = () => {
				throw new Error('Unexpected HTTP request');
			},
			continueOnFail = false,
			cancelSignal,
		}: { http?: HttpHandler; continueOnFail?: boolean; cancelSignal?: AbortSignal } = {},
	) => {
		const parameters = (Array.isArray(items) ? items : [items]).map((entry) =>
			nodeParameters(nodeType, entry),
		);
		const httpRequestWithAuthentication = vi.fn(
			async (_credentialType: string, options: IHttpRequestOptions) => http(options),
		);
		const requests = () =>
			httpRequestWithAuthentication.mock.calls.map(([, options]) => describeRequest(options));
		return {
			context: createNodeExecuteContext({
				node: nodeData,
				parameters,
				httpRequestWithAuthentication,
				continueOnFail,
				cancelSignal,
			}),
			parameters,
			httpRequestWithAuthentication,
			requests,
		};
	};
}

/**
 * A minimal IExecuteFunctions for the People Search node: one input item per entry of
 * `items` (its node parameters, defaults filled in), authenticated HTTP goes to `http`
 * (no network).
 */
export const createExecuteContext = contextFor(peopleNode, node);

/** The same for the Desearch node. */
export const createSearchContext = contextFor(searchNode, desearchNode);
