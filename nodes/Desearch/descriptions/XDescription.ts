import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const showFor = (operation: string[]) => ({ show: { resource: ['x'], operation } });

export const xOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['x'] } },
	options: [
		{
			name: 'Get Post',
			value: 'getPost',
			action: 'Get a post',
			description: 'Get a post by its ID',
		},
		{
			name: 'Get Post Replies',
			value: 'getPostReplies',
			action: 'Get replies to a post',
			description: 'Get replies to a post, one item per reply',
		},
		{
			name: 'Get Posts by URLs',
			value: 'getPostsByUrls',
			action: 'Get posts by URL',
			description: 'Get posts from their URLs, one item per post',
		},
		{
			name: 'Get Retweeters',
			value: 'getRetweeters',
			action: 'Get the users who reposted a post',
			description: 'Get the users who reposted a post, a page at a time',
		},
		{
			name: 'Get Trends',
			value: 'getTrends',
			action: 'Get trends',
			description: 'Get trending topics for a location',
		},
		{
			name: 'Get User Posts',
			value: 'getUserPosts',
			action: 'Get a user timeline',
			description: 'Get the latest posts on a user timeline, a page at a time',
		},
		{
			name: 'Get User Replies',
			value: 'getUserReplies',
			action: 'Get posts and replies by a user',
			description: 'Get posts and replies by a user, one item per post',
		},
		{
			name: 'Search User Posts',
			value: 'searchUserPosts',
			action: 'Search posts by a user',
			description: 'Search the posts of one user, one item per post',
		},
	],
	default: 'getPost',
};

export const xFields: INodeProperties[] = [
	{
		displayName: 'Post ID',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 1932946234920349827',
		description: 'The numeric ID of the post',
		displayOptions: showFor(['getPost', 'getPostReplies', 'getRetweeters']),
	},
	{
		displayName: 'Post URLs',
		name: 'urls',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 3 },
		placeholder: 'e.g. https://x.com/desearch_ai/status/1932946234920349827',
		description: 'URLs of the posts, separated by commas or new lines',
		displayOptions: showFor(['getPostsByUrls']),
	},
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. elonmusk',
		description: 'Username, with or without the @',
		displayOptions: showFor(['getUserPosts', 'getUserReplies', 'searchUserPosts']),
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		default: '',
		placeholder: 'e.g. bittensor',
		description: 'Only posts that match this X search query',
		displayOptions: showFor(['getPostReplies', 'getUserReplies', 'searchUserPosts']),
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 10,
		description: 'Max number of posts to return (1 to 100)',
		displayOptions: showFor(['getPostReplies', 'getUserReplies', 'searchUserPosts']),
	},
	{
		displayName: 'WOEID',
		name: 'woeid',
		type: 'number',
		required: true,
		default: 1,
		description:
			'Where On Earth ID of a location X publishes trends for. Worldwide is 1, the United States is 23424977.',
		displayOptions: showFor(['getTrends']),
	},
	{
		displayName: 'Count',
		name: 'count',
		type: 'number',
		typeOptions: { minValue: 30, maxValue: 100 },
		default: 30,
		description: 'How many trends to return (30 to 100)',
		displayOptions: showFor(['getTrends']),
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		placeholder: 'e.g. {{ $json.next_cursor }}',
		description:
			'Leave empty for the first page. For the next page, use the next_cursor of the previous page, unchanged.',
		displayOptions: showFor(['getRetweeters', 'getUserPosts']),
	},
];
