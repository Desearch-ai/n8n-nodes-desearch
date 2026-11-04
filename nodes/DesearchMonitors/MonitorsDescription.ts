import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const showFor = (resource: string[], operation: string[]) => ({
	show: { resource, operation },
});

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Item',
			value: 'item',
			description: 'What a monitor kept: new posts, pages and videos that passed screening',
		},
		{
			name: 'Monitor',
			value: 'monitor',
			description: 'A search that runs on a schedule and keeps only what is new',
		},
		{
			name: 'Run',
			value: 'run',
			description: 'One scheduled or manual run of a monitor',
		},
	],
	default: 'monitor',
};

export const monitorOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['monitor'] } },
	options: [
		{
			name: 'Create',
			value: 'create',
			action: 'Create a monitor',
			description: 'Create a monitor. Free; each run is billed.',
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a monitor',
			description: 'Stop a monitor for good. A queued run is cancelled.',
		},
		{
			name: 'Estimate Cost',
			value: 'estimate',
			action: 'Estimate the cost of a monitor',
			description: 'The most one run and one month of runs can cost, before you create it',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a monitor',
			description: 'Get the settings, status, last run and totals of a monitor',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many monitors',
			description: 'Get your monitors, newest first',
		},
		{
			name: 'Rotate Webhook Secret',
			value: 'rotateWebhookSecret',
			action: 'Rotate the webhook secret of a monitor',
			description: 'Get a new signing secret, returned once',
		},
		{
			name: 'Test Webhook',
			value: 'testWebhook',
			action: 'Send a test event to the webhook of a monitor',
			description: 'Send a signed test event and report what your endpoint answered',
		},
		{
			name: 'Trigger Run',
			value: 'trigger',
			action: 'Run a monitor now',
			description: 'Queue a run now, outside the schedule. The run is billed.',
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update a monitor',
			description: 'Change any setting, or pause and resume a monitor',
		},
	],
	default: 'create',
};

export const runOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['run'] } },
	options: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get a monitor run',
			description: 'Get one run with the items it kept, optionally waiting until it ends',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many monitor runs',
			description: 'Get the runs of a monitor, newest first',
		},
	],
	default: 'getAll',
};

export const itemOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['item'] } },
	options: [
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many monitor items',
			description: 'Get everything a monitor kept, newest first',
		},
	],
	default: 'getAll',
};

const TIKTOK_NOTE =
	"TikTok search has no working date filter and ranks by relevance, so a TikTok keyword monitor finds a new video only when it reaches TikTok's top results. To follow creators or a tag, watch their accounts (TikTok Accounts) or the hashtag (TikTok Hashtags).";

// Instagram and Facebook have no keyword search here: they only watch accounts (and Instagram hashtags) and pages.
const INSTAGRAM_NOTE =
	'Instagram only watches accounts and hashtags (Instagram Accounts, Instagram Hashtags): it has no keyword search here, so the API refuses a monitor with Instagram and neither (422).';

const FACEBOOK_NOTE =
	'Facebook only watches pages (Facebook Pages): it has no keyword search or hashtag feed for posts, so the API refuses a monitor with Facebook and no pages (422). For ads by keyword, use Meta Ads.';

const META_ADS_NOTE =
	'Meta Ads searches the Meta Ad Library by keyword, so the query should be keywords: a brand, product or short phrase such as ChatGPT (a sentence finds nothing). An ad is new the first time a run sees it, if it started within the last 30 days.';

const THREADS_NOTE =
	'Threads keyword search returns loosely matched posts, so watching accounts (Threads Accounts) works better.';

const sourceOptions = [
	{ name: 'Facebook', value: 'facebook', description: FACEBOOK_NOTE },
	{ name: 'Instagram', value: 'instagram', description: INSTAGRAM_NOTE },
	{ name: 'Meta Ads', value: 'meta_ads', description: META_ADS_NOTE },
	{ name: 'Reddit', value: 'reddit' },
	{ name: 'Threads', value: 'threads', description: THREADS_NOTE },
	{
		name: 'TikTok',
		value: 'tiktok',
		description: TIKTOK_NOTE,
	},
	{ name: 'Web', value: 'web' },
	{ name: 'X', value: 'x' },
	{ name: 'YouTube', value: 'youtube' },
];

const intervalOptions = [
	{ name: 'Every Hour', value: '1h' },
	{ name: 'Every 3 Hours', value: '3h' },
	{ name: 'Every 6 Hours', value: '6h' },
	{ name: 'Every 12 Hours', value: '12h' },
	{ name: 'Every Day', value: '1d' },
	{ name: 'Every Week', value: '7d' },
];

const statusOptions = [
	{ name: 'Active', value: 'active' },
	{ name: 'Paused', value: 'paused' },
];

const criteriaField: INodeProperties = {
	displayName: 'Criteria',
	name: 'criteria',
	type: 'string',
	typeOptions: { rows: 3 },
	default: '',
	placeholder: 'e.g. Announces a new subnet, release or partnership',
	description:
		'Conditions an item must meet to be kept, one per line (up to 5, each up to 300 characters). Each one is checked for every new item.',
};

const metadataField: INodeProperties = {
	displayName: 'Metadata',
	name: 'metadata',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Label',
	default: {},
	description:
		'Your own labels for the monitor, echoed in its webhook events (up to 20; keys up to 64 characters, values up to 500). They do not change what is found or what it costs.',
	options: [
		{
			displayName: 'Label',
			name: 'label',
			values: [
				{
					displayName: 'Key',
					name: 'key',
					type: 'string',
					default: '',
					placeholder: 'e.g. team',
				},
				{
					displayName: 'Value',
					name: 'value',
					type: 'string',
					default: '',
					placeholder: 'e.g. growth',
				},
			],
		},
	],
};

const minScoreField: INodeProperties = {
	displayName: 'Min Score',
	name: 'minScore',
	type: 'number',
	typeOptions: { minValue: 0, maxValue: 100 },
	default: 60,
	description:
		'Relevance (0 to 100) an item needs to be kept. 0 keeps every new post, for example from watched accounts.',
};

const nameField: INodeProperties = {
	displayName: 'Name',
	name: 'name',
	type: 'string',
	default: '',
	placeholder: 'e.g. Bittensor subnet news',
	description: 'A label for the console and webhook events (up to 120 characters)',
};

const summaryField: INodeProperties = {
	displayName: 'Summary',
	name: 'summary',
	type: 'boolean',
	default: false,
	description:
		'Whether each run writes a short digest of the items it kept. Billed at the LLM usage plus 50%.',
};

const webCountField: INodeProperties = {
	displayName: 'Web Results per Run',
	name: 'webCount',
	type: 'options',
	options: [
		{ name: '10', value: 10 },
		{ name: '15', value: 15 },
		{ name: '20', value: 20 },
	],
	default: 10,
	description: 'Pages each run reads from the web source',
};

const webhookEventsField: INodeProperties = {
	displayName: 'Webhook Events',
	name: 'webhookEvents',
	type: 'multiOptions',
	options: [
		{
			name: 'Items Found',
			value: 'monitor.items.found',
			description: 'A run kept at least one item',
		},
		{
			name: 'Run Completed',
			value: 'monitor.run.completed',
			description: 'Every completed run, also with no new items',
		},
		{
			name: 'Run Failed',
			value: 'monitor.run.failed',
		},
	],
	default: [],
	description: 'Events to send. When empty, Items Found and Run Failed.',
};

const webhookUrlField: INodeProperties = {
	displayName: 'Webhook URL',
	name: 'webhookUrl',
	type: 'string',
	default: '',
	placeholder: 'e.g. https://example.com/hooks/desearch',
	description:
		'HTTPS URL on a public address that receives new items, signed with the Desearch-Signature header. Redirects are not followed. A new URL gets a new secret, returned once as webhook_secret.',
};

const xCountField: INodeProperties = {
	displayName: 'X Posts per Run',
	name: 'xCount',
	type: 'number',
	typeOptions: { minValue: 1, maxValue: 100 },
	default: 20,
	description: 'Newest X posts each run reads (1 to 100)',
};

const xLangField: INodeProperties = {
	displayName: 'X Language',
	name: 'xLang',
	type: 'string',
	default: '',
	placeholder: 'e.g. en',
	description: 'Only X posts in this language (a 2 or 3 letter code)',
};

const xMinLikesField: INodeProperties = {
	displayName: 'X Min Likes',
	name: 'xMinLikes',
	type: 'number',
	typeOptions: { minValue: 0 },
	default: 0,
	description: 'Only X posts with at least this many likes',
};

// With watched accounts, the query and criteria still decide what is kept.
const ACCOUNTS_NOTE =
	"The query and criteria still decide which posts are kept; Min Score 0 keeps every new one. Kept items have data.account, and an account that cannot be read is listed in the run's stats.sources.<source>.accounts_failed.";

// Watched hashtags: feeds of posts from any account.
const HASHTAGS_NOTE =
	"A hashtag feed lists popular as well as recent posts from any account, so it finds posts outside the watched accounts; with accounts or hashtags, the source reads those feeds instead of searching. The query and criteria still decide which posts are kept; Min Score 0 keeps every new one. Kept items have data.hashtag, and a hashtag that cannot be read is listed in the run's stats.sources.<source>.hashtags_failed.";

const facebookPagesField: INodeProperties = {
	displayName: 'Facebook Pages',
	name: 'facebookPages',
	type: 'string',
	default: '',
	placeholder: 'e.g. NASA, 100064869009429',
	description: `1 to 10 Facebook pages to watch, separated by commas or new lines (NASA, a numeric page ID or a page URL; profile.php and /pages/Name/123… links become the page ID). Required with the Facebook source, which has no keyword search or hashtag feed for posts; for ads by keyword, use Meta Ads. Each run reads up to 10 newest posts of each page ($0.0207 a page per run). ${ACCOUNTS_NOTE}`,
};

const instagramAccountsField: INodeProperties = {
	displayName: 'Instagram Accounts',
	name: 'instagramAccounts',
	type: 'string',
	default: '',
	placeholder: 'e.g. openai, @natgeo',
	description: `Up to 10 Instagram usernames to watch, separated by commas or new lines (openai, @openai or a profile URL). The Instagram source has no keyword search here, so it needs Instagram Accounts or Instagram Hashtags. Each run reads up to 12 newest posts of each account ($0.02484 an account per run). ${ACCOUNTS_NOTE}`,
};

const instagramHashtagsField: INodeProperties = {
	displayName: 'Instagram Hashtags',
	name: 'instagramHashtags',
	type: 'string',
	default: '',
	placeholder: 'e.g. skincare, #სილამაზე',
	description: `Up to 10 hashtags to watch on Instagram, separated by commas or new lines, in any script (skincare, #სილამაზე or an instagram.com/explore/tags/… URL). Each run reads up to 12 posts of each hashtag ($0.02484 a hashtag per run). The API returns them without #. ${HASHTAGS_NOTE}`,
};

const metaAdsCountField: INodeProperties = {
	displayName: 'Meta Ads per Run',
	name: 'metaAdsCount',
	type: 'options',
	options: [
		{ name: '10', value: 10 },
		{ name: '20', value: 20 },
		{ name: '30', value: 30 },
	],
	default: 10,
	description: `Ads each run reads from the Meta Ad Library. They are billed at the Ad Library price: $0.0207 for 10, $0.0621 for 30. ${META_ADS_NOTE}`,
};

const redditSubredditsField: INodeProperties = {
	displayName: 'Reddit Subreddits',
	name: 'redditSubreddits',
	type: 'string',
	default: '',
	placeholder: 'e.g. LocalLLaMA, r/MachineLearning',
	description: `Up to 10 subreddits to watch, separated by commas or new lines (LocalLLaMA, r/LocalLLaMA or a subreddit URL). Reddit then reads each one's newest posts instead of searching ($0.00207 a subreddit per run). ${ACCOUNTS_NOTE}`,
};

const threadsAccountsField: INodeProperties = {
	displayName: 'Threads Accounts',
	name: 'threadsAccounts',
	type: 'string',
	default: '',
	placeholder: 'e.g. zuck, @openai',
	description: `Up to 10 Threads usernames to watch, separated by commas or new lines (zuck, @zuck or a profile URL). Threads then reads each account's newest posts instead of searching ($0.00207 an account per run). Keyword search returns loosely matched posts, so accounts work better. ${ACCOUNTS_NOTE}`,
};

const tiktokAccountsField: INodeProperties = {
	displayName: 'TikTok Accounts',
	name: 'tiktokAccounts',
	type: 'string',
	default: '',
	placeholder: 'e.g. openai, @duolingo',
	description: `Up to 10 TikTok usernames to watch, separated by commas or new lines (openai, @openai or a profile URL). TikTok then reads TikTok Posts per Run newest posts of each account instead of searching. ${ACCOUNTS_NOTE}`,
};

const tiktokHashtagsField: INodeProperties = {
	displayName: 'TikTok Hashtags',
	name: 'tiktokHashtags',
	type: 'string',
	default: '',
	placeholder: 'e.g. skincare, #სილამაზე',
	description: `Up to 10 hashtags to watch on TikTok, separated by commas or new lines, in any script (skincare, #სილამაზე or a tiktok.com/tag/… URL). Each run reads TikTok Posts per Run posts of each hashtag ($0.00207 a post). The API returns them without #. ${HASHTAGS_NOTE}`,
};

const tiktokCountField: INodeProperties = {
	displayName: 'TikTok Posts per Run',
	name: 'tiktokCount',
	type: 'options',
	options: [
		{ name: '10', value: 10 },
		{ name: '20', value: 20 },
		{ name: '30', value: 30 },
	],
	default: 10,
	description: `Posts each run reads from TikTok ($0.00207 a post). With TikTok Accounts or TikTok Hashtags, this many from each account and each hashtag. ${TIKTOK_NOTE}`,
};

const xAccountsField: INodeProperties = {
	displayName: 'X Accounts',
	name: 'xAccounts',
	type: 'string',
	default: '',
	placeholder: 'e.g. OpenAI, @AnthropicAI',
	description: `Up to 10 X usernames to watch, separated by commas or new lines (OpenAI, @OpenAI or an x.com URL). X then reads each account's timeline instead of searching (20 posts, about $0.003 an account per run), so X Posts per Run is not used; X Language and X Min Likes still filter. ${ACCOUNTS_NOTE}`,
};

const youtubeChannelsField: INodeProperties = {
	displayName: 'YouTube Channels',
	name: 'youtubeChannels',
	type: 'string',
	default: '',
	placeholder: 'e.g. @OpenAI, UCXZCJLdBC09xxGZ6gcdrc6A',
	description: `Up to 10 channels to watch, separated by commas or new lines (@handle, a UC… channel ID or a channel URL). YouTube then reads each channel's latest videos instead of searching ($0.00207 a channel per run). ${ACCOUNTS_NOTE}`,
};

/**
 * An account or hashtag field in Update Fields, where set but empty stops watching. `source`
 * names a source that only watches accounts, which must leave Sources in the same update
 * unless it keeps `other` (Instagram: its accounts or hashtags).
 */
const stopWatching = (field: INodeProperties, source?: string, other?: string): INodeProperties => ({
	...field,
	description: `${field.description} Empty stops watching them${source ? `; ${other ? `keep ${other} or ` : ''}take ${source} out of Sources in the same update, or the API refuses it (422)` : ''}.`,
});

const sourcesField = (operations: string[]): INodeProperties => ({
	displayName: 'Sources',
	name: 'sources',
	type: 'multiOptions',
	required: true,
	options: sourceOptions,
	default: ['web', 'x'],
	description:
		'Where to look. Each run searches every source and is billed for those searches. Instagram and Facebook only watch accounts: add Instagram Accounts or Instagram Hashtags, or Facebook Pages, under Options.',
	displayOptions: showFor(['monitor'], operations),
});

const intervalField = (operations: string[]): INodeProperties => ({
	displayName: 'Interval',
	name: 'interval',
	type: 'options',
	options: intervalOptions,
	default: '1d',
	description: 'How often the monitor runs',
	displayOptions: showFor(['monitor'], operations),
});

const createFields: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 2 },
		placeholder: 'e.g. Bittensor subnet launches and updates',
		description:
			'What to watch, in plain words (3 to 500 characters). Each source is searched with it; with watched accounts or hashtags, it decides which of their posts are kept. Meta Ads needs keywords: a brand, product or short phrase.',
		displayOptions: showFor(['monitor'], ['create']),
	},
	sourcesField(['create', 'estimate']),
	intervalField(['create', 'estimate']),
	{
		displayName: 'Options',
		name: 'createOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['monitor'], ['create']),
		options: [
			criteriaField,
			facebookPagesField,
			instagramAccountsField,
			instagramHashtagsField,
			metaAdsCountField,
			metadataField,
			minScoreField,
			nameField,
			redditSubredditsField,
			{
				displayName: 'Run Now',
				name: 'runNow',
				type: 'boolean',
				default: true,
				description: 'Whether to queue the first run at once instead of waiting for the schedule',
			},
			summaryField,
			threadsAccountsField,
			tiktokAccountsField,
			tiktokHashtagsField,
			tiktokCountField,
			webCountField,
			webhookEventsField,
			webhookUrlField,
			xAccountsField,
			xLangField,
			xMinLikesField,
			xCountField,
			youtubeChannelsField,
		],
	},
	{
		displayName: 'Options',
		name: 'estimateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['monitor'], ['estimate']),
		// What changes the cost of a run.
		options: [
			facebookPagesField,
			instagramAccountsField,
			instagramHashtagsField,
			metaAdsCountField,
			redditSubredditsField,
			summaryField,
			threadsAccountsField,
			tiktokAccountsField,
			tiktokHashtagsField,
			tiktokCountField,
			webCountField,
			xAccountsField,
			xCountField,
			youtubeChannelsField,
		],
	},
];

const monitorIdField = (resource: string, operations: string[]): INodeProperties => ({
	displayName: 'Monitor ID',
	name: 'monitorId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. 6f1d0c9e-0d55-4b8e-9a3c-3c4d9b8e2a10',
	description: 'The monitor_id that Create returned',
	displayOptions: showFor([resource], operations),
});

const monitorIdFields: INodeProperties[] = [
	monitorIdField('monitor', [
		'delete',
		'get',
		'rotateWebhookSecret',
		'testWebhook',
		'trigger',
		'update',
	]),
	monitorIdField('run', ['get', 'getAll']),
	monitorIdField('item', ['getAll']),
];

const updateFields: INodeProperties[] = [
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['monitor'], ['update']),
		options: [
			{ ...criteriaField, description: `${criteriaField.description} Empty removes them.` },
			stopWatching(facebookPagesField, 'Facebook'),
			stopWatching(instagramAccountsField, 'Instagram', 'Instagram Hashtags'),
			stopWatching(instagramHashtagsField, 'Instagram', 'Instagram Accounts'),
			{
				displayName: 'Interval',
				name: 'interval',
				type: 'options',
				options: intervalOptions,
				default: '1d',
				description: 'How often the monitor runs',
			},
			metaAdsCountField,
			{ ...metadataField, description: "Replaces the monitor's labels. Empty removes them." },
			minScoreField,
			nameField,
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				typeOptions: { rows: 2 },
				description: 'What to watch, in plain words (3 to 500 characters)',
			},
			stopWatching(redditSubredditsField),
			{
				displayName: 'Remove Webhook',
				name: 'removeWebhook',
				type: 'boolean',
				default: false,
				description: 'Whether to remove the webhook. Items stay readable through Item > Get Many.',
			},
			{
				displayName: 'Sources',
				name: 'sources',
				type: 'multiOptions',
				options: sourceOptions,
				default: ['web', 'x'],
				description:
					'Where to look. Instagram and Facebook need watched accounts: the monitor as updated must have Instagram Accounts or Instagram Hashtags for Instagram, and Facebook Pages for Facebook.',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: statusOptions,
				default: 'paused',
				description:
					'Paused stops scheduled runs (Trigger Run still works). Active resumes them, also after a pause for credits or a failing webhook.',
			},
			summaryField,
			stopWatching(threadsAccountsField),
			stopWatching(tiktokAccountsField),
			stopWatching(tiktokHashtagsField),
			tiktokCountField,
			webCountField,
			webhookEventsField,
			webhookUrlField,
			stopWatching(xAccountsField),
			xLangField,
			xMinLikesField,
			xCountField,
			stopWatching(youtubeChannelsField),
		],
	},
];

const runFields: INodeProperties[] = [
	{
		displayName: 'Run ID',
		name: 'runId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 0c6a1e2b-5d3f-4a7c-9b8e-1f2d3c4b5a69',
		description: "A run_id from Trigger Run or the monitor's runs",
		displayOptions: showFor(['run'], ['get']),
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: false,
		description:
			'Whether to wait until the run ends, for example right after Trigger Run. A run usually takes under a minute.',
		displayOptions: showFor(['run'], ['get']),
	},
	{
		displayName: 'Timeout (Seconds)',
		name: 'timeout',
		type: 'number',
		typeOptions: { minValue: 10 },
		default: 300,
		description:
			'How long to wait. If the run is still going then, the node fails with its status and the run keeps going.',
		displayOptions: {
			show: { resource: ['run'], operation: ['get'], waitForCompletion: [true] },
		},
	},
	{
		displayName: 'Poll Interval (Seconds)',
		name: 'pollInterval',
		type: 'number',
		typeOptions: { minValue: 5 },
		default: 10,
		description: 'How often to check whether the run has ended',
		displayOptions: {
			show: { resource: ['run'], operation: ['get'], waitForCompletion: [true] },
		},
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		options: [
			{
				name: 'Kept Items',
				value: 'items',
				description: 'One output item per item the run kept, most relevant first',
			},
			{
				name: 'Run',
				value: 'run',
				description: 'The run, with its items in items',
			},
		],
		default: 'run',
		displayOptions: showFor(['run'], ['get']),
	},
];

const listFields: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor(['monitor', 'run', 'item'], ['getAll']),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['monitor', 'run', 'item'], operation: ['getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'monitorFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['monitor'], ['getAll']),
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: statusOptions,
				default: [],
				description: 'Only monitors with one of these statuses',
			},
		],
	},
	{
		displayName: 'Filters',
		name: 'itemFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['item'], ['getAll']),
		options: [
			{
				displayName: 'Source',
				name: 'source',
				type: 'options',
				options: sourceOptions,
				default: 'x',
				description: 'Only items from this source',
			},
		],
	},
];

export const monitorsProperties: INodeProperties[] = [
	resourceProperty,
	monitorOperations,
	runOperations,
	itemOperations,
	...monitorIdFields,
	...createFields,
	...updateFields,
	...runFields,
	...listFields,
];
