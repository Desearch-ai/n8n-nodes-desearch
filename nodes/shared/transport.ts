import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INode,
	type JsonObject,
} from 'n8n-workflow';

export const DESEARCH_API_URL = 'https://api.desearch.ai';

export function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

/** Splits a comma or newline separated string (or an array) into trimmed, non-empty strings. */
export function splitList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const parts: unknown[] = Array.isArray(value) ? value : String(value).split(/[,\n]/);
	return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

/**
 * The reason the API gives for an error. The API puts it in `detail`: a string,
 * or a list of validation errors (`[{ loc, msg }]`).
 */
export function apiErrorDetail(body: unknown): string | undefined {
	if (typeof body === 'string') {
		// Plain-text bodies only: an HTML error page (for example from a proxy) says nothing useful.
		const text = body.trim();
		return text === '' || text.startsWith('<') ? undefined : text.slice(0, 500);
	}
	const detail = (body as IDataObject | undefined)?.detail;
	if (typeof detail === 'string') {
		return detail;
	}
	if (Array.isArray(detail)) {
		const messages = detail.map((entry) => {
			const { loc, msg } = (entry ?? {}) as IDataObject;
			const field = Array.isArray(loc) ? loc.filter((part) => part !== 'body').join('.') : '';
			const text = typeof msg === 'string' ? msg : JSON.stringify(entry);
			return field === '' ? text : `${field}: ${text}`;
		});
		return messages.length > 0 ? messages.join('; ') : undefined;
	}
	return undefined;
}

/** A node error for an HTTP error response, with the API's reason as its description. */
export function apiError(
	node: INode,
	statusCode: number,
	body: unknown,
	itemIndex: number,
): NodeApiError {
	const errorBody = (
		body !== null && typeof body === 'object' ? body : { detail: body }
	) as JsonObject;
	return new NodeApiError(node, errorBody, {
		httpCode: String(statusCode),
		description: apiErrorDetail(body),
		itemIndex,
	});
}

/** Keeps errors n8n already understands; wraps anything else in a NodeOperationError. */
export function asNodeError(
	node: INode,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		return error;
	}
	return new NodeOperationError(node, error as Error, { itemIndex });
}

/**
 * An error body read as text or bytes (text and file routes), parsed as JSON when it is JSON,
 * so the API's `detail` can be shown.
 */
function readErrorBody(body: unknown): unknown {
	let text: string | undefined;
	if (Buffer.isBuffer(body)) {
		text = body.toString('utf8');
	} else if (body instanceof ArrayBuffer) {
		text = Buffer.from(body).toString('utf8');
	} else if (typeof body === 'string') {
		text = body;
	}
	if (text === undefined) {
		return body;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

/** A response header by name, any case. Undefined when it is missing or empty. */
export function responseHeader(response: IN8nHttpFullResponse, name: string): string | undefined {
	const wanted = name.toLowerCase();
	for (const [key, value] of Object.entries(response.headers ?? {})) {
		if (key.toLowerCase() !== wanted) {
			continue;
		}
		const text = Array.isArray(value) ? value[0] : value;
		return typeof text === 'string' && text !== '' ? text : undefined;
	}
	return undefined;
}

export interface DesearchRequest {
	qs?: IDataObject;
	body?: IDataObject;
	headers?: IDataObject;
	/** Read the response as text or as bytes instead of JSON. */
	encoding?: 'text' | 'arraybuffer';
	/** How list values in `qs` are sent. `repeat` sends `urls=a&urls=b`. */
	arrayFormat?: 'repeat';
}

/**
 * Calls the Desearch API with the node's Desearch credential and returns the full
 * response (body, headers, status). Query values that are not set are left out.
 * HTTP errors fail the item with the reason the API gives (for example
 * "Not enough credits" or a validation error) instead of a generic message.
 */
export async function desearchApiRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	method: IHttpRequestMethods,
	path: string,
	{ qs, body, headers, encoding, arrayFormat }: DesearchRequest = {},
): Promise<IN8nHttpFullResponse> {
	const options: IHttpRequestOptions = {
		method,
		url: `${DESEARCH_API_URL}${path}`,
		headers: {
			Accept: 'application/json',
			...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			...headers,
		},
		json: encoding === undefined,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	};
	if (qs !== undefined) {
		options.qs = Object.fromEntries(Object.entries(qs).filter(([, value]) => isSet(value)));
	}
	if (body !== undefined) {
		options.body = body;
	}
	if (encoding !== undefined) {
		options.encoding = encoding;
	}
	if (arrayFormat !== undefined) {
		options.arrayFormat = arrayFormat;
	}

	let response: IN8nHttpFullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'desearchApi',
			options,
		)) as IN8nHttpFullResponse;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}
	if (response.statusCode >= 400) {
		throw apiError(this.getNode(), response.statusCode, readErrorBody(response.body), itemIndex);
	}
	return response;
}
