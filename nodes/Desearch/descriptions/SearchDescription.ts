import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const showFor = (operation: string[]) => ({ show: { resource: ['search'], operation } });

export const searchOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['search'] } },
	options: [
		{
			name: 'AI Search',
			value: 'aiSearch',
			action: 'Run an AI search',
			description: 'Search several sources and get links with a summary',
		},
		{
			name: 'AI Web Links Search',
			value: 'aiWebLinksSearch',
			action: 'Search web links with AI',
			description: 'Get web pages that match a prompt, with key excerpts, without a summary',
		},
		{
			name: 'AI X Links Search',
			value: 'aiXLinksSearch',
			action: 'Search X posts with AI',
			description: 'Get X posts that match a prompt, without a summary',
		},
		{
			name: 'Search API',
			value: 'searchApi',
			action: 'Search ranked web pages',
			description: 'Get ranked web pages, each with the passage that best matches the query',
		},
		{
			name: 'Web Search',
			value: 'webSearch',
			action: 'Search the web',
			description: 'Get web search results for a query',
		},
		{
			name: 'X Search',
			value: 'xSearch',
			action: 'Search x posts',
			description: 'Search posts on X',
		},
	],
	default: 'aiSearch',
};

/**
 * AI Search, Web Search and X Search fields. Their names, types, options and defaults
 * are the ones the node had in 0.2.0 (before resources existed), so a saved workflow,
 * which has no `resource` and gets the default `search`, resolves to the same values
 * and the same requests. Keep them that way.
 */
const legacyFields: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Bittensor subnet news',
		description: 'What to search for',
		displayOptions: showFor(['aiSearch', 'aiWebLinksSearch', 'aiXLinksSearch']),
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
		displayOptions: showFor(['aiSearch']),
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
		displayOptions: showFor(['aiSearch']),
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
		displayOptions: showFor(['aiSearch']),
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Desearch',
		displayOptions: showFor(['searchApi', 'webSearch', 'xSearch']),
	},
	{
		displayName: 'Start',
		name: 'start',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		description: 'Result offset for paging',
		displayOptions: showFor(['webSearch']),
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 20,
		description: 'Number of posts to return',
		displayOptions: showFor(['xSearch']),
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
		displayOptions: showFor(['xSearch']),
	},
];

const startDate = (description: string): INodeProperties => ({
	displayName: 'Start Date',
	name: 'startDate',
	type: 'dateTime',
	default: '',
	description,
});

const endDate = (description: string): INodeProperties => ({
	displayName: 'End Date',
	name: 'endDate',
	type: 'dateTime',
	default: '',
	description,
});

const linkSearchFields: INodeProperties[] = [
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 10, maxValue: 200 },
		default: 10,
		description: 'How many results to return (10 to 200)',
		displayOptions: showFor(['aiWebLinksSearch', 'aiXLinksSearch']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['aiWebLinksSearch']),
		options: [
			endDate('Only pages up to this time. Times without a time zone are UTC.'),
			{
				displayName: 'Highlights',
				name: 'highlights',
				type: 'boolean',
				default: true,
				description: 'Whether to include key excerpts from each page',
			},
			{
				displayName: 'Page Text',
				name: 'pageText',
				type: 'boolean',
				default: false,
				description: 'Whether to include the full text of each page. Responses get much larger.',
			},
			startDate('Only pages from this time on. Times without a time zone are UTC.'),
		],
	},
];

const searchApiFields: INodeProperties[] = [
	{
		displayName: 'Count',
		name: 'count',
		type: 'options',
		options: [
			{ name: '10', value: 10 },
			{ name: '15', value: 15 },
			{ name: '20', value: 20 },
		],
		default: 10,
		description: 'How many pages to return',
		displayOptions: showFor(['searchApi']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['searchApi']),
		options: [
			endDate('Only pages published on or before this day'),
			{
				displayName: 'Highlights',
				name: 'highlights',
				type: 'boolean',
				default: true,
				description: 'Whether to include the passage that best matches the query',
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{ name: 'Balanced', value: 'balanced', description: 'Favors relevance' },
					{ name: 'Fast', value: 'fast', description: 'Returns results sooner' },
				],
				default: 'balanced',
			},
			{
				displayName: 'Page Text',
				name: 'pageText',
				type: 'boolean',
				default: false,
				description: 'Whether to include the full text of each page. Responses get much larger.',
			},
			startDate('Only pages published on or after this day'),
		],
	},
];

export const searchFields: INodeProperties[] = [
	...legacyFields,
	...linkSearchFields,
	...searchApiFields,
];
