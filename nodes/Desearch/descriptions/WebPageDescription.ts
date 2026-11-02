import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const showFor = (operation: string[]) => ({ show: { resource: ['webPage'], operation } });

export const webPageOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['webPage'] } },
	options: [
		{
			name: 'Extract',
			value: 'extract',
			action: 'Extract a web page',
			description: 'Get the text or HTML of a public web page',
		},
	],
	default: 'extract',
};

export const webPageFields: INodeProperties[] = [
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://desearch.ai',
		description: 'Public URL of the page',
		displayOptions: showFor(['extract']),
	},
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		options: [
			{ name: 'HTML', value: 'html', description: 'The page HTML' },
			{ name: 'Text', value: 'text', description: 'The readable text of the page' },
		],
		default: 'text',
		displayOptions: showFor(['extract']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['extract']),
		options: [
			{
				displayName: 'Render JavaScript',
				name: 'renderJavaScript',
				type: 'boolean',
				default: false,
				description:
					'Whether to load the page in a headless browser first, for pages whose content is built with JavaScript. Billed at a higher rate.',
			},
			{
				displayName: 'Wait (Ms)',
				name: 'waitMs',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 30000 },
				default: 0,
				description:
					'Extra time to wait after the page loads, in milliseconds (up to 30,000). Only used with Render JavaScript.',
			},
		],
	},
];
