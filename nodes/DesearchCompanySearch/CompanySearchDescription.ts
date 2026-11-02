import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const RESOURCES = ['search', 'enrich'];

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
			name: 'Company Enrich',
			value: 'enrich',
			description: 'Contacts and leaders for company domains you already have',
		},
		{
			name: 'Company Search',
			value: 'search',
			description: 'A background search for companies that match a description',
		},
	],
	default: 'search',
};

const taskOperations = (
	resource: string,
	noun: string,
	start: { action: string; description: string },
): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{
			name: 'Cancel',
			value: 'cancel',
			action: `Cancel a ${noun}`,
			description: 'Stop a task. You pay only for the companies it delivered.',
		},
		{
			name: 'Get',
			value: 'get',
			action: `Get a ${noun}`,
			description: 'Get the status, progress and cost of a task',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: `Get many ${noun}s`,
			description: 'Get your tasks of this kind, newest first',
		},
		{
			name: 'Get Results',
			value: 'getResults',
			action: `Get the companies a ${noun} delivered`,
			description: 'Get the companies a task delivered, optionally waiting until it finishes',
		},
		{
			name: 'Pause',
			value: 'pause',
			action: `Pause a ${noun}`,
			description: 'Pause a task. Companies delivered so far stay available.',
		},
		{
			name: 'Resume',
			value: 'resume',
			action: `Resume a ${noun}`,
			description: 'Continue a paused task. It is not charged again.',
		},
		{
			name: 'Start',
			value: 'start',
			...start,
		},
	],
	default: 'start',
});

export const searchOperations = taskOperations('search', 'company search', {
	action: 'Start a company search',
	description: 'Start a background search for companies that match a description',
});

export const enrichOperations = taskOperations('enrich', 'company enrichment', {
	action: 'Start a company enrichment',
	description: 'Start a background task that collects contacts and leaders for your domains',
});

/** Options both Start operations take. Sorted by display name, as n8n lists them. */
const taskStartOptions: INodeProperties[] = [
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'string',
		default: '',
		placeholder: 'e.g. q4-berlin-fintech-2026-10-28',
		description:
			'Any string unique to this task. Sending the same key again returns the first task instead of starting and charging a new one.',
	},
	{
		displayName: 'Infer Emails',
		name: 'inferEmails',
		type: 'boolean',
		default: true,
		description:
			'Whether to guess leaders\' emails from the company\'s address pattern. Inferred emails have source "inferred" and a confidence.',
	},
	{
		displayName: 'Leader Roles',
		name: 'roles',
		type: 'multiOptions',
		options: [
			{ name: 'CEO', value: 'ceo' },
			{ name: 'CFO', value: 'cfo' },
			{ name: 'CMO', value: 'cmo' },
			{ name: 'COO', value: 'coo' },
			{ name: 'CTO', value: 'cto' },
			{ name: 'Founder', value: 'founder' },
			{ name: 'Managing Director', value: 'managing_director' },
			{ name: 'Owner', value: 'owner' },
			{ name: 'President', value: 'president' },
		],
		default: [],
		description: 'Leaders to find. When empty, the API looks for the CEO, founders, CTO and CFO.',
	},
	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Label',
		default: {},
		description:
			'Your own labels for the task, for example the campaign it runs for. Up to 10; keys are 1 to 40 characters of a-z, 0-9, _, . or -. They do not change what is found or what it costs.',
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
						placeholder: 'e.g. campaign',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						placeholder: 'e.g. q4-outbound',
					},
				],
			},
		],
	},
	{
		displayName: 'Verify Emails',
		name: 'verifyEmails',
		type: 'boolean',
		default: true,
		description: 'Whether to check every email (syntax, mail server and web)',
	},
];

const searchStartFields: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 2 },
		placeholder: 'e.g. Series A fintech startups in Berlin building payment infrastructure',
		description:
			'The companies you are looking for, in plain language: what they do, where, how far along (3 to 1,000 characters)',
		displayOptions: showFor(['search'], ['start']),
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 5, maxValue: 200 },
		default: 25,
		description:
			'How many companies to deliver (5 to 200). The task reserves this many at the Company Search price and bills only the companies it delivers. A task that delivers none is free.',
		displayOptions: showFor(['search'], ['start']),
	},
	{
		displayName: 'Filters',
		name: 'searchFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['search'], ['start']),
		options: [
			{
				displayName: 'Countries',
				name: 'countries',
				type: 'string',
				default: '',
				placeholder: 'e.g. DE, Austria',
				description:
					'Comma-separated countries the companies should be in: ISO codes or names (up to 20)',
			},
			{
				displayName: 'Must Have',
				name: 'require',
				type: 'multiOptions',
				options: [
					{ name: 'Company LinkedIn Page', value: 'linkedin' },
					{ name: 'Email', value: 'email' },
					{ name: 'Leader', value: 'leader' },
					{ name: 'Leader With Email', value: 'leader_email' },
					{ name: 'Phone', value: 'phone' },
				],
				default: [],
				description:
					'Only deliver companies that have every one of these. A company without them is not delivered or billed.',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'searchOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['search'], ['start']),
		options: [
			{
				displayName: 'Exclude Domains',
				name: 'exclude',
				type: 'string',
				default: '',
				placeholder: 'e.g. stripe.com, adyen.com',
				description:
					'Comma-separated domains or URLs to leave out, for example companies you already contacted (up to 1,000)',
			},
			// Idempotency Key, Infer Emails, Leader Roles, Metadata.
			...taskStartOptions.slice(0, 4),
			{
				displayName: 'Min Score',
				name: 'minScore',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 100 },
				default: 60,
				description: 'Only deliver companies with at least this fit score (0 to 100)',
			},
			// Verify Emails.
			...taskStartOptions.slice(4),
		],
	},
];

const enrichStartFields: INodeProperties[] = [
	{
		displayName: 'Domains',
		name: 'domains',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 4 },
		placeholder: 'e.g. acme.com, https://www.beta.io/about',
		description:
			'Company domains or URLs, separated by commas or new lines (1 to 200). Each is reduced to its host without www.; duplicates are removed. The task reserves one company per domain at the Company Enrich price and bills only the companies it delivers.',
		displayOptions: showFor(['enrich'], ['start']),
	},
	{
		displayName: 'Options',
		name: 'enrichOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(['enrich'], ['start']),
		options: taskStartOptions,
	},
];

const taskFields: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 0c9f3a52-7d1e-4f0a-9a3b-2b8e6f1d4c77',
		description: 'The task_id that Start returned',
		displayOptions: showFor(RESOURCES, ['get', 'getResults', 'pause', 'resume', 'cancel']),
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		description:
			'Whether to wait until the task finishes before returning companies. Companies arrive while it runs and later stages (leaders, inferred emails, email checks) fill them in, so waiting returns every company in its final version. When off, returns the companies delivered so far.',
		displayOptions: showFor(RESOURCES, ['getResults']),
	},
	{
		displayName: 'Timeout (Seconds)',
		name: 'timeout',
		type: 'number',
		typeOptions: { minValue: 10 },
		default: 600,
		description:
			'How long to wait. If the task is still running then, the node fails with its status and the task keeps running.',
		displayOptions: {
			show: { resource: RESOURCES, operation: ['getResults'], waitForCompletion: [true] },
		},
	},
	{
		displayName: 'Poll Interval (Seconds)',
		name: 'pollInterval',
		type: 'number',
		typeOptions: { minValue: 5 },
		default: 15,
		description: 'How often to check whether the task has finished',
		displayOptions: {
			show: { resource: RESOURCES, operation: ['getResults'], waitForCompletion: [true] },
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor(RESOURCES, ['getResults']),
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor(RESOURCES, ['getAll']),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: RESOURCES, operation: ['getResults', 'getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'taskFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(RESOURCES, ['getAll']),
		options: [
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Label',
				default: {},
				description: 'Only tasks whose metadata has every one of these labels (up to 3)',
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
								placeholder: 'e.g. campaign',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'e.g. q4-outbound',
							},
						],
					},
				],
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
				description: 'Only tasks with one of these statuses',
			},
		],
	},
];

export const companySearchProperties: INodeProperties[] = [
	resourceProperty,
	searchOperations,
	enrichOperations,
	...searchStartFields,
	...enrichStartFields,
	...taskFields,
];
