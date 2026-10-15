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
			description: 'Your Desearch API key from https://console.desearch.ai',
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

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.desearch.ai',
			url: '/web',
			method: 'GET',
			qs: { query: 'desearch' },
		},
	};
}
