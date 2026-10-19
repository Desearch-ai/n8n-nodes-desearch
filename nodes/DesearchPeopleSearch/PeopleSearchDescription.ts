import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const platformOptions = [
	{ name: 'LinkedIn', value: 'linkedin' },
	{ name: 'TikTok', value: 'tiktok' },
	{ name: 'X', value: 'x' },
	{ name: 'YouTube', value: 'youtube' },
];

const showFor = (resource: string, operation: string[]) => ({
	show: { resource: [resource], operation },
});

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Profile',
			value: 'profile',
			description: 'The people your searches found',
		},
		{
			name: 'Search',
			value: 'search',
			description: 'A background search for people on one platform',
		},
	],
	default: 'search',
};

export const searchOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['search'] } },
	options: [
		{
			name: 'Cancel',
			value: 'cancel',
			action: 'Cancel a search',
			description: 'Stop a search. You pay only for the people it delivered.',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a search',
			description: 'Get the status, progress and cost of a search',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many searches',
			description: 'Get your searches, newest first',
		},
		{
			name: 'Get Results',
			value: 'getResults',
			action: 'Get the people a search found',
			description: 'Get the people a search found, optionally waiting until it finishes',
		},
		{
			name: 'Pause',
			value: 'pause',
			action: 'Pause a search',
			description: 'Pause a search. People found so far stay available.',
		},
		{
			name: 'Resume',
			value: 'resume',
			action: 'Resume a search',
			description: 'Continue a paused search. It is not charged again.',
		},
		{
			name: 'Start',
			value: 'start',
			action: 'Start a search',
			description: 'Start a background search for people on X, YouTube, LinkedIn or TikTok',
		},
	],
	default: 'start',
};

export const profileOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['profile'] } },
	options: [
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many profiles',
			description: 'Get everyone your searches on one platform found, with filters',
		},
	],
	default: 'getAll',
};

const searchStartFields: INodeProperties[] = [
	{
		displayName: 'Platform',
		name: 'platform',
		type: 'options',
		options: platformOptions,
		default: 'x',
		required: true,
		description: 'Where to look for people',
		displayOptions: showFor('search', ['start']),
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 2 },
		placeholder: 'e.g. Indie hackers building in public who share their MRR',
		description: 'Who you are looking for, in plain language (3 to 1,000 characters)',
		displayOptions: showFor('search', ['start']),
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 5, maxValue: 200 },
		default: 25,
		description:
			'How many people to find (5 to 200). The search reserves this many at the platform price and bills only the people it delivers. A search that finds no one is free.',
		displayOptions: showFor('search', ['start']),
	},
	{
		displayName: 'Filters',
		name: 'searchFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor('search', ['start']),
		options: [
			{
				displayName: 'Countries',
				name: 'countries',
				type: 'string',
				default: '',
				placeholder: 'e.g. US, United Kingdom',
				description: 'Comma-separated countries to prefer',
				displayOptions: { show: { '/platform': ['x', 'youtube', 'linkedin'] } },
			},
			{
				displayName: 'Exclude Keywords',
				name: 'excludeKeywords',
				type: 'string',
				default: '',
				placeholder: 'e.g. giveaway, crypto',
				description: 'Comma-separated words. People who mention them are left out.',
			},
			{
				displayName: 'Keywords',
				name: 'keywords',
				type: 'string',
				default: '',
				placeholder: 'e.g. SaaS, MRR',
				description: 'Comma-separated words that should appear in posts, videos or bios',
			},
			{
				displayName: 'Max Followers',
				name: 'maxFollowers',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 100000,
				description: 'Maximum follower count',
				displayOptions: { show: { '/platform': ['x', 'linkedin', 'tiktok'] } },
			},
			{
				displayName: 'Max Subscribers',
				name: 'maxSubscribers',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 500000,
				description: 'Maximum subscriber count',
				displayOptions: { show: { '/platform': ['youtube'] } },
			},
			{
				displayName: 'Min Followers',
				name: 'minFollowers',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description: 'Minimum follower count',
				displayOptions: { show: { '/platform': ['x', 'linkedin', 'tiktok'] } },
			},
			{
				displayName: 'Min Subscribers',
				name: 'minSubscribers',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description: 'Minimum subscriber count',
				displayOptions: { show: { '/platform': ['youtube'] } },
			},
			{
				displayName: 'Require Contact',
				name: 'requireContact',
				type: 'boolean',
				default: false,
				description:
					'Whether to find only creators with a public email (TikTok) or a public email or contact link (YouTube)',
				displayOptions: { show: { '/platform': ['youtube', 'tiktok'] } },
			},
			{
				displayName: 'Verified Only',
				name: 'verifiedOnly',
				type: 'boolean',
				default: false,
				description: 'Whether to find only verified or X Premium accounts',
				displayOptions: { show: { '/platform': ['x'] } },
			},
		],
	},
	{
		displayName: 'Options',
		name: 'searchOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor('search', ['start']),
		options: [
			{
				displayName: 'Exclude Handles',
				name: 'exclude',
				type: 'string',
				default: '',
				placeholder: 'e.g. elonmusk, naval',
				description:
					'Comma-separated handles to leave out, for example people you already contacted',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				placeholder: 'e.g. weekly-founders-2026-10-19',
				description:
					'Any string unique to this search. Sending the same key again returns the first search instead of starting and charging a new one.',
			},
			{
				displayName: 'Min Score',
				name: 'minScore',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 100 },
				default: 60,
				description: 'Only return people with at least this fit score (0 to 100)',
			},
		],
	},
];

const searchTaskFields: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 5b33f3ee-168b-4780-9c8e-63a626781872',
		description: 'The task_id that Start returned',
		displayOptions: showFor('search', ['get', 'getResults', 'pause', 'resume', 'cancel']),
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		description:
			'Whether to wait until the search finishes before returning people. Searches usually take 1 to 5 minutes. When off, returns the people found so far.',
		displayOptions: showFor('search', ['getResults']),
	},
	{
		displayName: 'Timeout (Seconds)',
		name: 'timeout',
		type: 'number',
		typeOptions: { minValue: 10 },
		default: 600,
		description:
			'How long to wait. If the search is still running then, the node fails with its status and the search keeps running.',
		displayOptions: {
			show: { resource: ['search'], operation: ['getResults'], waitForCompletion: [true] },
		},
	},
	{
		displayName: 'Poll Interval (Seconds)',
		name: 'pollInterval',
		type: 'number',
		typeOptions: { minValue: 5 },
		default: 15,
		description: 'How often to check whether the search has finished',
		displayOptions: {
			show: { resource: ['search'], operation: ['getResults'], waitForCompletion: [true] },
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor('search', ['getResults']),
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor('search', ['getAll']),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['search'], operation: ['getResults', 'getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'taskFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor('search', ['getAll']),
		options: [
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				options: platformOptions,
				default: 'x',
				description: 'Only searches on this platform',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Cancelling', value: 'cancelling' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Partial', value: 'partial' },
					{ name: 'Paused', value: 'paused' },
					{ name: 'Pausing', value: 'pausing' },
					{ name: 'Queued', value: 'queued' },
					{ name: 'Running', value: 'running' },
				],
				default: [],
				description: 'Only searches with one of these statuses',
			},
		],
	},
];

const profileFields: INodeProperties[] = [
	{
		displayName: 'Platform',
		name: 'platform',
		type: 'options',
		options: platformOptions,
		default: 'x',
		required: true,
		description: 'Whose people to list',
		displayOptions: showFor('profile', ['getAll']),
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor('profile', ['getAll']),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['profile'], operation: ['getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Sort By',
		name: 'sortBy',
		type: 'options',
		options: [
			{ name: 'Audience', value: 'audience', description: 'Most followers or subscribers first' },
			{ name: 'Most Recent', value: 'recent', description: 'Most recently found first' },
			{ name: 'Score', value: 'score', description: 'Best fit first' },
		],
		default: 'score',
		displayOptions: showFor('profile', ['getAll']),
	},
	{
		displayName: 'Filters',
		name: 'profileFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor('profile', ['getAll']),
		options: [
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
				placeholder: 'e.g. united states',
				description: 'Text in the location',
			},
			{
				displayName: 'Max Audience',
				name: 'maxAudience',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 100000,
				description: 'Maximum followers (subscribers on YouTube)',
			},
			{
				displayName: 'Min Audience',
				name: 'minAudience',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description: 'Minimum followers (subscribers on YouTube)',
			},
			{
				displayName: 'Min Score',
				name: 'minScore',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 100 },
				default: 60,
				description: 'Minimum fit score (0 to 100)',
			},
			{
				displayName: 'Must Have',
				name: 'has',
				type: 'multiOptions',
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'Instagram', value: 'instagram' },
					{ name: 'LinkedIn', value: 'linkedin' },
					{ name: 'TikTok', value: 'tiktok' },
					{ name: 'Website', value: 'website' },
					{ name: 'X', value: 'x' },
					{ name: 'YouTube', value: 'youtube' },
				],
				default: [],
				description: 'Only people who have every one of these',
			},
			{
				displayName: 'Search Text',
				name: 'searchText',
				type: 'string',
				default: '',
				placeholder: 'e.g. founder',
				description: 'Text in the name, handle, bio or location',
			},
			{
				displayName: 'Verified Only',
				name: 'verifiedOnly',
				type: 'boolean',
				default: false,
				description: 'Whether to return only verified accounts',
				displayOptions: { show: { '/platform': ['x', 'tiktok'] } },
			},
		],
	},
];

export const peopleSearchProperties: INodeProperties[] = [
	resourceProperty,
	searchOperations,
	profileOperations,
	...searchStartFields,
	...searchTaskFields,
	...profileFields,
];
