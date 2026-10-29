import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const SOCIAL = ['tiktok', 'facebook', 'instagram'];

const show = (resource: string[], operation: string[]) => ({ show: { resource, operation } });

const LIST_OUTPUT =
	'One item with the page in results and the cursor of the next page in nextCursor';

export const tiktokOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['tiktok'] } },
	options: [
		{
			name: 'Get Comments',
			value: 'getComments',
			action: 'Get comments on a video',
			description: `Get comments on a video. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Hashtag Posts',
			value: 'getHashtagPosts',
			action: 'Get videos for a hashtag',
			description: `Get videos for a hashtag. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Post',
			value: 'getPost',
			action: 'Get a video',
			description: 'Get a video by its ID',
		},
		{
			name: 'Get Profile',
			value: 'getProfile',
			action: 'Get a profile',
			description: 'Get a profile by its username',
		},
		{
			name: 'Get Profile Posts',
			value: 'getProfilePosts',
			action: 'Get the videos of a profile',
			description: `Get the videos of a profile. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Trending',
			value: 'getTrending',
			action: 'Get trending videos',
			description: 'Get trending videos in a region, in one item (results)',
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search videos',
			description: `Search videos by keyword. ${LIST_OUTPUT}.`,
		},
	],
	default: 'search',
};

export const facebookOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['facebook'] } },
	options: [
		{
			name: 'Get Comments',
			value: 'getComments',
			action: 'Get comments on a post',
			description: `Get comments on a post, about 10 per page. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Hashtag Posts',
			value: 'getHashtagPosts',
			action: 'Get ad library records for a hashtag',
			description: `Get Meta Ad Library records for a keyword or hashtag. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Post',
			value: 'getPost',
			action: 'Get a post',
			description: 'Get a public post by its ID',
		},
		{
			name: 'Get Profile',
			value: 'getProfile',
			action: 'Get a profile or page',
			description: 'Get a public profile or page',
		},
		{
			name: 'Get Profile Posts',
			value: 'getProfilePosts',
			action: 'Get the posts of a profile or page',
			description: `Get the posts of a profile or page. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Search Ad Library',
			value: 'search',
			action: 'Search the ad library',
			description: `Search public Meta Ad Library records by keyword. ${LIST_OUTPUT}.`,
		},
	],
	default: 'search',
};

export const instagramOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['instagram'] } },
	options: [
		{
			name: 'Get Comments',
			value: 'getComments',
			action: 'Get comments on a post',
			description: `Get comments on a post. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Hashtag Posts',
			value: 'getHashtagPosts',
			action: 'Get posts for a hashtag',
			description: `Get posts for a hashtag. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Post',
			value: 'getPost',
			action: 'Get a post',
			description: 'Get a post by its shortcode, ID or URL',
		},
		{
			name: 'Get Profile',
			value: 'getProfile',
			action: 'Get a profile',
			description: 'Get a profile by its username',
		},
		{
			name: 'Get Profile Posts',
			value: 'getProfilePosts',
			action: 'Get the posts of a profile',
			description: `Get the posts of a profile. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Search Profiles',
			value: 'search',
			action: 'Search profiles',
			description:
				'Search profiles by keyword, in one item (results). Returns one page; it does not paginate.',
		},
	],
	default: 'search',
};

const cursorField = (resource: string[], operation: string[]): INodeProperties => ({
	displayName: 'Cursor',
	name: 'cursor',
	type: 'string',
	default: '',
	placeholder: 'e.g. {{ $json.nextCursor }}',
	description:
		'Leave empty for the first page. For the next page, use the nextCursor of the previous page, unchanged, with the same other parameters. A cursor is valid for 24 hours.',
	displayOptions: show(resource, operation),
});

export const socialFields: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. bittensor',
		description: 'Keyword or phrase to search for',
		displayOptions: show(SOCIAL, ['search']),
	},
	{
		displayName: 'Video ID',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 7499229683859426602',
		description: 'The TikTok video ID',
		displayOptions: show(['tiktok'], ['getPost', 'getComments']),
	},
	{
		displayName: 'Post ID',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 1234567890123456',
		description: 'The ID of the public post',
		displayOptions: show(['facebook'], ['getPost', 'getComments']),
	},
	{
		displayName: 'Post',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. DeuOR-CjKE9',
		description: 'The shortcode, ID or public URL of the post',
		displayOptions: show(['instagram'], ['getPost']),
	},
	{
		displayName: 'Shortcode',
		name: 'shortcode',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. DeuOR-CjKE9',
		description:
			'The code in the post URL, for example DeuOR-CjKE9 in https://www.instagram.com/p/DeuOR-CjKE9/',
		displayOptions: show(['instagram'], ['getComments']),
	},
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. tiktok',
		description: 'Username, with or without the @',
		displayOptions: show(['tiktok', 'instagram'], ['getProfile', 'getProfilePosts']),
	},
	{
		displayName: 'Profile or Page',
		name: 'profileId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. facebook',
		description: 'The public handle or ID of the profile or page',
		displayOptions: show(['facebook'], ['getProfile', 'getProfilePosts']),
	},
	{
		displayName: 'Hashtag',
		name: 'hashtag',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. ai',
		description: 'Hashtag, with or without the #',
		displayOptions: show(SOCIAL, ['getHashtagPosts']),
	},
	{
		displayName: 'Region',
		name: 'region',
		type: 'string',
		default: 'US',
		placeholder: 'e.g. US',
		description: 'Two-letter region code',
		displayOptions: show(['tiktok'], ['getTrending']),
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 10,
		description: 'Max number of results to return (1 to 100). A page can have fewer.',
		displayOptions: show(SOCIAL, ['search']),
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 20,
		description: 'Max number of results to return (1 to 100). A page can have fewer.',
		displayOptions: show(SOCIAL, [
			'getComments',
			'getHashtagPosts',
			'getProfilePosts',
			'getTrending',
		]),
	},
	cursorField(
		['tiktok', 'facebook'],
		['search', 'getComments', 'getHashtagPosts', 'getProfilePosts'],
	),
	cursorField(['instagram'], ['getComments', 'getHashtagPosts', 'getProfilePosts']),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['tiktok'], ['search']),
		options: [
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'string',
				default: '',
				description: 'Sort option, sent to TikTok as is when it supports one',
			},
		],
	},
];
