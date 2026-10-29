// The Desearch node description as published in 0.2.0 (git show 80195c7:nodes/Desearch/Desearch.node.ts),
// copied unchanged: a declarative node whose operations sent requests through `routing`.
// test/Desearch.compat.test.ts checks that workflows saved with it still resolve to the
// same parameters and send the same requests.
import { NodeConnectionTypes, type INodeTypeDescription } from 'n8n-workflow';

export const desearch020Description: INodeTypeDescription = {
	displayName: 'Desearch',
	name: 'desearch',
	icon: { light: 'file:../../icons/desearch.svg', dark: 'file:../../icons/desearch.dark.svg' },
	group: ['transform'],
	version: 1,
	subtitle: '={{$parameter["operation"]}}',
	description: 'AI search, X search and web search for AI agents',
	defaults: {
		name: 'Desearch',
	},
	usableAsTool: true,
	inputs: [NodeConnectionTypes.Main],
	outputs: [NodeConnectionTypes.Main],
	credentials: [{ name: 'desearchApi', required: true }],
	requestDefaults: {
		baseURL: 'https://api.desearch.ai',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
	},
	properties: [
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			options: [
				{
					name: 'AI Search',
					value: 'aiSearch',
					action: 'Run an AI search',
					description: 'Search several sources and get links with a summary',
					routing: {
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
					},
				},
				{
					name: 'Web Search',
					value: 'webSearch',
					action: 'Search the web',
					description: 'Get web search results for a query',
					routing: {
						request: {
							method: 'GET',
							url: '/web',
							qs: {
								query: '={{$parameter.query}}',
								start: '={{$parameter.start}}',
							},
						},
					},
				},
				{
					name: 'X Search',
					value: 'xSearch',
					action: 'Search x posts',
					description: 'Search posts on X',
					routing: {
						request: {
							method: 'GET',
							url: '/twitter',
							qs: {
								query: '={{$parameter.query}}',
								count: '={{$parameter.count}}',
								sort: '={{$parameter.sort}}',
							},
						},
					},
				},
			],
			default: 'aiSearch',
		},
		{
			displayName: 'Prompt',
			name: 'prompt',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'e.g. Bittensor subnet news',
			description: 'What to search for',
			displayOptions: { show: { operation: ['aiSearch'] } },
		},
		{
			displayName: 'Sources',
			name: 'tools',
			type: 'multiOptions',
			options: [
				{ name: 'ArXiv', value: 'arxiv' },
				{ name: 'Hacker News', value: 'hackernews' },
				{ name: 'Reddit', value: 'reddit' },
				{ name: 'Web', value: 'web' },
				{ name: 'Wikipedia', value: 'wikipedia' },
				{ name: 'X', value: 'twitter' },
			],
			default: ['web', 'twitter'],
			description: 'Sources to search',
			displayOptions: { show: { operation: ['aiSearch'] } },
		},
		{
			displayName: 'Date Filter',
			name: 'dateFilter',
			type: 'options',
			options: [
				{ name: 'Any Time', value: '' },
				{ name: 'Past 2 Days', value: 'PAST_2_DAYS' },
				{ name: 'Past 24 Hours', value: 'PAST_24_HOURS' },
				{ name: 'Past Month', value: 'PAST_MONTH' },
				{ name: 'Past Week', value: 'PAST_WEEK' },
				{ name: 'Past Year', value: 'PAST_YEAR' },
			],
			default: '',
			displayOptions: { show: { operation: ['aiSearch'] } },
		},
		{
			displayName: 'Result Type',
			name: 'resultType',
			type: 'options',
			options: [
				{ name: 'Links With Final Summary', value: 'LINKS_WITH_FINAL_SUMMARY' },
				{ name: 'Only Links', value: 'ONLY_LINKS' },
			],
			default: 'LINKS_WITH_FINAL_SUMMARY',
			displayOptions: { show: { operation: ['aiSearch'] } },
		},
		{
			displayName: 'Query',
			name: 'query',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'e.g. Desearch',
			displayOptions: { show: { operation: ['webSearch', 'xSearch'] } },
		},
		{
			displayName: 'Start',
			name: 'start',
			type: 'number',
			typeOptions: { minValue: 0 },
			default: 0,
			description: 'Result offset for paging',
			displayOptions: { show: { operation: ['webSearch'] } },
		},
		{
			displayName: 'Count',
			name: 'count',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 100 },
			default: 20,
			description: 'Number of posts to return',
			displayOptions: { show: { operation: ['xSearch'] } },
		},
		{
			displayName: 'Sort',
			name: 'sort',
			type: 'options',
			options: [
				{ name: 'Top', value: 'Top' },
				{ name: 'Latest', value: 'Latest' },
			],
			default: 'Top',
			displayOptions: { show: { operation: ['xSearch'] } },
		},
	],
};
