import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DesearchApi implements ICredentialType {
	name = 'desearchApi';

	displayName = 'Desearch API';

	icon: Icon = { light: 'file:../icons/desearch.svg', dark: 'file:../icons/desearch.dark.svg' };

	documentationUrl = 'https://desearch.ai/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Your Desearch API key from https://console.desearch.ai/api-keys',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.apiKey}}',
			},
		},
	};

	// Free key check: GET /web without the required `query` parameter.
	// The API checks the key before it validates parameters, so a valid key gets
	// HTTP 422 (validation error, no search is run and nothing is billed), an
	// invalid key gets HTTP 403 {"detail":"Forbidden"} and a missing key gets
	// HTTP 401 {"detail":"Unauthorized"}. Status errors are ignored here so the
	// response body can be checked by the rules below.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.desearch.ai',
			url: '/web',
			method: 'GET',
			ignoreHttpStatusErrors: true,
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'detail',
					value: 'Forbidden',
					message: 'Invalid API key. Create or copy a key at https://console.desearch.ai/api-keys',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'detail',
					value: 'Unauthorized',
					message: 'Missing API key. Create or copy a key at https://console.desearch.ai/api-keys',
				},
			},
		],
	};
}
