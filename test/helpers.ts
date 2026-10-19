import {
	NodeHelpers,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INode,
	type INodeParameters,
} from 'n8n-workflow';
import { vi } from 'vitest';

import { DesearchPeopleSearch } from '../nodes/DesearchPeopleSearch/DesearchPeopleSearch.node';

export const peopleNode = new DesearchPeopleSearch();

export const node: INode = {
	id: 'people-node',
	name: 'Desearch People Search',
	type: 'n8n-nodes-desearch.desearchPeopleSearch',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

/** Node parameters with defaults filled in, the way n8n does when it loads a workflow. */
export function withDefaults(parameters: INodeParameters): INodeParameters {
	const { description } = peopleNode;
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

/** An HTTP response as httpRequestWithAuthentication returns it with returnFullResponse. */
export function response(body: unknown, statusCode = 200): IN8nHttpFullResponse {
	return { body: body as IDataObject, headers: {}, statusCode };
}

/** The path and query of a request, e.g. "GET /desearch/people/tasks?limit=100". */
export function describeRequest(options: IHttpRequestOptions): string {
	const path = options.url.replace('https://api.desearch.ai', '');
	const query = new URLSearchParams(
		Object.entries(options.qs ?? {}).map(([key, value]) => [key, String(value)]),
	).toString();
	return `${options.method} ${path}${query ? `?${query}` : ''}`;
}

export type HttpHandler = (options: IHttpRequestOptions) => IN8nHttpFullResponse;

/**
 * A minimal IExecuteFunctions: one input item per entry of `items` (its node
 * parameters, defaults filled in), authenticated HTTP goes to `http` (no network).
 */
export function createExecuteContext(
	items: INodeParameters | INodeParameters[],
	{
		http = () => {
			throw new Error('Unexpected HTTP request');
		},
		continueOnFail = false,
		cancelSignal,
	}: { http?: HttpHandler; continueOnFail?: boolean; cancelSignal?: AbortSignal } = {},
) {
	const parameters = (Array.isArray(items) ? items : [items]).map(withDefaults);
	const httpRequestWithAuthentication = vi.fn(
		async (_credentialType: string, options: IHttpRequestOptions) => http(options),
	);
	const context = {
		getInputData: () => parameters.map(() => ({ json: {} })),
		getNode: () => node,
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
			const value = parameters[itemIndex][name];
			if (value !== undefined) return value;
			if (fallback !== undefined) return fallback;
			throw new Error(`Could not get parameter "${name}"`);
		},
		continueOnFail: () => continueOnFail,
		getExecutionCancelSignal: () => cancelSignal,
		helpers: { httpRequestWithAuthentication },
	};
	const requests = () =>
		httpRequestWithAuthentication.mock.calls.map(([, options]) => describeRequest(options));
	return {
		context: context as unknown as IExecuteFunctions,
		httpRequestWithAuthentication,
		requests,
	};
}
