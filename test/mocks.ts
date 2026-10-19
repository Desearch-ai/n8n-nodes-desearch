import type {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
} from 'n8n-workflow';
import { vi } from 'vitest';

export const node: INode = {
	id: 'desearch-node',
	name: 'Desearch',
	type: 'n8n-nodes-desearch.desearch',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

export type HttpHandler = (options: IHttpRequestOptions) => unknown;

/**
 * A minimal IExecuteSingleFunctions / IExecutePaginationFunctions for one item:
 * node parameters come from `parameters`, authenticated HTTP calls go to `http`
 * (no network), and routing requests made by pagination go to `routing`.
 */
export function createContext(
	parameters: IDataObject,
	{
		http = () => {
			throw new Error('Unexpected HTTP request');
		},
		routing = () => ({}),
		cancelSignal,
	}: {
		http?: HttpHandler;
		routing?: (options: DeclarativeRestApiSettings.HttpRequestOptions) => IDataObject;
		cancelSignal?: AbortSignal;
	} = {},
) {
	const httpRequestWithAuthentication = vi.fn(
		async (_credentialType: string, options: IHttpRequestOptions) => http(options),
	);
	const makeRoutingRequest = vi.fn(
		async (
			requestData: DeclarativeRestApiSettings.ResultOptions,
		): Promise<INodeExecutionData[]> => [{ json: routing(requestData.options) }],
	);
	const context = {
		getNode: () => node,
		getItemIndex: () => 0,
		getExecutionCancelSignal: () => cancelSignal,
		getNodeParameter: (name: string, fallback?: unknown) =>
			name in parameters ? parameters[name] : fallback,
		helpers: { httpRequestWithAuthentication },
		makeRoutingRequest,
	};
	return {
		context: context as unknown as IExecuteSingleFunctions & IExecutePaginationFunctions,
		httpRequestWithAuthentication,
		makeRoutingRequest,
	};
}

/** Request options as RoutingNode hands them to a preSend hook. */
export function baseRequest(overrides: Partial<IHttpRequestOptions> = {}): IHttpRequestOptions {
	return {
		baseURL: 'https://api.desearch.ai',
		url: '/desearch/people/tasks',
		method: 'GET',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		qs: {},
		body: {},
		...overrides,
	};
}

/** Request data as RoutingNode hands it to a pagination function. */
export function routingRequest(
	options: Partial<IHttpRequestOptions> = {},
): DeclarativeRestApiSettings.ResultOptions {
	return {
		options: baseRequest(options),
		preSend: [],
		postReceive: [],
		paginate: true,
	};
}
