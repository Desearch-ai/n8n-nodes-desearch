// A minimal IExecuteFunctions for running a node's execute() outside n8n.
// Shared by the unit tests (fake HTTP) and scripts/e2e-full-coverage.mts (real API),
// so it imports nothing at runtime: Node runs that script without a TypeScript build.
import type {
	IBinaryData,
	IExecuteFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INode,
	INodeParameters,
} from 'n8n-workflow';

/** helpers.httpRequestWithAuthentication: credential type and request options -> response. */
export type AuthenticatedRequest = (
	credentialType: string,
	options: IHttpRequestOptions,
) => Promise<IN8nHttpFullResponse | unknown>;

/** helpers.prepareBinaryData as n8n stores small files: base64 data plus file metadata. */
export async function prepareBinaryData(
	data: Buffer,
	fileName?: string,
	mimeType?: string,
): Promise<IBinaryData> {
	const extension = fileName?.includes('.') ? fileName.split('.').pop() : undefined;
	return {
		data: data.toString('base64'),
		mimeType: mimeType ?? 'application/octet-stream',
		fileName,
		fileExtension: extension,
		fileSize: String(data.length),
	};
}

/**
 * An execute() context with one input item per entry of `parameters` (node
 * parameters with their defaults already filled in, as n8n does when it loads a
 * workflow). Authenticated HTTP goes to `httpRequestWithAuthentication`.
 */
export function createNodeExecuteContext({
	node,
	parameters,
	httpRequestWithAuthentication,
	continueOnFail = false,
	cancelSignal,
}: {
	node: INode;
	parameters: INodeParameters[];
	httpRequestWithAuthentication: AuthenticatedRequest;
	continueOnFail?: boolean;
	cancelSignal?: AbortSignal;
}): IExecuteFunctions {
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
		helpers: { httpRequestWithAuthentication, prepareBinaryData },
	};
	return context as unknown as IExecuteFunctions;
}
