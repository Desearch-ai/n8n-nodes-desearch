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

const sourceOptions = [
	{ name: 'Reddit', value: 'reddit' },
	{ name: 'Threads', value: 'threads' },
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
	description: 'Relevance (0 to 100) an item needs to be kept',
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

const sourcesField = (operations: string[]): INodeProperties => ({
	displayName: 'Sources',
	name: 'sources',
	type: 'multiOptions',
	required: true,
	options: sourceOptions,
	default: ['web', 'x'],
	description: 'Where to look. Each run searches every source and is billed for those searches.',
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
			'What to watch, in plain words (3 to 500 characters). Each source is searched with it.',
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
			metadataField,
			minScoreField,
			nameField,
			{
				displayName: 'Run Now',
				name: 'runNow',
				type: 'boolean',
				default: true,
				description: 'Whether to queue the first run at once instead of waiting for the schedule',
			},
			summaryField,
			webCountField,
			webhookEventsField,
			webhookUrlField,
			xLangField,
			xMinLikesField,
			xCountField,
		],
	},
	{
		displayName: 'Options',
		name: 'estimateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['monitor'], ['estimate']),
		options: [summaryField, webCountField, xCountField],
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
			{
				displayName: 'Interval',
				name: 'interval',
				type: 'options',
				options: intervalOptions,
				default: '1d',
				description: 'How often the monitor runs',
			},
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
				description: 'Where to look',
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
			webCountField,
			webhookEventsField,
			webhookUrlField,
			xLangField,
			xMinLikesField,
			xCountField,
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
