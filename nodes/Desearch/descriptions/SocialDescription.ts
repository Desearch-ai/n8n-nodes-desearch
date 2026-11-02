import type { INodeProperties } from 'n8n-workflow';

// Plain data only: n8n structured-clones the description of nodes that are
// usable as AI tools, so it must not contain functions.

const SOCIAL = ['tiktok', 'facebook', 'instagram'];

/** YouTube, Reddit and Threads: no `count`, one provider page per call. */
const YRT = ['youtube', 'reddit', 'threads'];

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

export const youtubeOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['youtube'] } },
	options: [
		{
			name: 'Get Channel',
			value: 'getChannel',
			action: 'Get a channel',
			description: 'Get a channel by its handle or ID: subscribers, description, country and links',
		},
		{
			name: 'Get Channel Videos',
			value: 'getChannelVideos',
			action: 'Get the videos of a channel',
			description: `Get the videos a channel uploaded, latest or most popular first. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Comments',
			value: 'getComments',
			action: 'Get comments on a video',
			description: `Get the top-level comments on a video. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Transcript',
			value: 'getTranscript',
			action: 'Get the transcript of a video',
			description: 'Get the captions of a video as plain text and timestamped segments',
		},
		{
			name: 'Get Video',
			value: 'getVideo',
			action: 'Get a video',
			description:
				'Get a video or Short by its ID or URL: title, description, channel, views, likes, chapters and caption languages',
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search videos and channels',
			description: `Search videos, Shorts, live streams, channels and playlists by keyword. ${LIST_OUTPUT}.`,
		},
	],
	default: 'search',
};

export const redditOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['reddit'] } },
	options: [
		{
			name: 'Get Comments',
			value: 'getComments',
			action: 'Get comments on a post',
			description: `Get the comments on a post as a tree, with the replies Reddit loaded. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Get Post',
			value: 'getPost',
			action: 'Get a post',
			description: 'Get a post by its ID or URL, without its comments',
		},
		{
			name: 'Get Subreddit',
			value: 'getSubreddit',
			action: 'Get a subreddit',
			description: 'Get a subreddit: description, rules, weekly active users and contributions',
		},
		{
			name: 'Get Subreddit Posts',
			value: 'getSubredditPosts',
			action: 'Get the posts of a subreddit',
			description: `Get the posts of a subreddit, with Reddit's sort and time filters. ${LIST_OUTPUT}.`,
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search posts',
			description: `Search posts across all subreddits by keyword. ${LIST_OUTPUT}.`,
		},
	],
	default: 'search',
};

export const threadsOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['threads'] } },
	options: [
		{
			name: 'Get Post',
			value: 'getPost',
			action: 'Get a post',
			description: 'Get a post by its URL or shortcode, with its replies and thread posts',
		},
		{
			name: 'Get Profile',
			value: 'getProfile',
			action: 'Get a profile',
			description: 'Get a profile by its username: bio, followers, verification and links',
		},
		{
			name: 'Get Profile Posts',
			value: 'getProfilePosts',
			action: 'Get the posts of a profile',
			description:
				'Get the latest 20 to 30 posts of a profile, in one item (results). It does not paginate.',
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search posts',
			description: 'Search posts by keyword, in one item (results). It does not paginate.',
		},
		{
			name: 'Search Users',
			value: 'searchUsers',
			action: 'Search users',
			description: 'Search accounts by username or name, in one item (results)',
		},
	],
	default: 'search',
};

/** Reddit time windows. */
const TIMEFRAMES = [
	{ name: 'All Time', value: 'all' },
	{ name: 'Day', value: 'day' },
	{ name: 'Month', value: 'month' },
	{ name: 'Week', value: 'week' },
	{ name: 'Year', value: 'year' },
];

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

	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. bittensor',
		description: 'Keyword or phrase to search for',
		displayOptions: show(YRT, ['search']),
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. zuck',
		description: 'Username or name to search for',
		displayOptions: show(['threads'], ['searchUsers']),
	},
	{
		displayName: 'Video',
		name: 'videoId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. dQw4w9WgXcQ',
		description: 'The ID or URL of the video or Short',
		displayOptions: show(['youtube'], ['getVideo', 'getTranscript', 'getComments']),
	},
	{
		displayName: 'Channel',
		name: 'channel',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. @MrBeast',
		description: 'The channel handle, with or without the @, or its channel ID (UC…)',
		displayOptions: show(['youtube'], ['getChannel', 'getChannelVideos']),
	},
	{
		displayName: 'Subreddit',
		name: 'subreddit',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. AskReddit',
		description:
			'The subreddit name, with or without r/. Case-sensitive: AskReddit, not askreddit.',
		displayOptions: show(['reddit'], ['getSubreddit', 'getSubredditPosts']),
	},
	{
		displayName: 'Post',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 1q6pxwn',
		description: 'The post ID (with or without t3_) or its URL',
		displayOptions: show(['reddit'], ['getPost', 'getComments']),
	},
	{
		displayName: 'Post',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://www.threads.com/@zuck/post/DK-BydcJHkF',
		description: 'The post URL or shortcode',
		displayOptions: show(['threads'], ['getPost']),
	},
	{
		displayName: 'Username',
		name: 'username',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. zuck',
		description: 'Username, with or without the @',
		displayOptions: show(['threads'], ['getProfile', 'getProfilePosts']),
	},
	cursorField(['youtube'], ['search', 'getComments', 'getChannelVideos']),
	cursorField(['reddit'], ['search', 'getSubredditPosts', 'getComments']),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['youtube'], ['search']),
		options: [
			{
				displayName: 'Duration',
				name: 'duration',
				type: 'options',
				options: [
					{ name: '3 to 20 Minutes', value: 'between_3_and_20_min' },
					{ name: 'Over 20 Minutes', value: 'over_20_min' },
					{ name: 'Under 3 Minutes', value: 'under_3_min' },
				],
				default: 'under_3_min',
				description: 'Video length. Applies to videos, not Shorts.',
			},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				options: [
					{ name: 'Popular', value: 'popular' },
					{ name: 'Relevance', value: 'relevance' },
				],
				default: 'relevance',
				description: 'Order of the results',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Channels', value: 'channels' },
					{ name: 'Playlists', value: 'playlists' },
					{ name: 'Shorts', value: 'shorts' },
					{ name: 'Videos', value: 'videos' },
				],
				default: 'videos',
				description: 'Only return this kind of result. Leave out for mixed results.',
			},
			{
				displayName: 'Upload Date',
				name: 'uploadDate',
				type: 'options',
				options: [
					{ name: 'This Month', value: 'this_month' },
					{ name: 'This Week', value: 'this_week' },
					{ name: 'This Year', value: 'this_year' },
					{ name: 'Today', value: 'today' },
				],
				default: 'this_week',
				description: 'Only return videos uploaded in this window',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['youtube'], ['getTranscript']),
		options: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'e.g. en',
				description:
					"Caption language code, for example en or es. Leave out for YouTube's default track.",
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['youtube'], ['getComments']),
		options: [
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Newest', value: 'newest' },
					{ name: 'Top', value: 'top' },
				],
				default: 'top',
				description: 'Order of the comments',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['youtube'], ['getChannelVideos']),
		options: [
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Latest', value: 'latest' },
					{ name: 'Popular', value: 'popular' },
				],
				default: 'latest',
				description: 'Order of the videos (latest when left out)',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['reddit'], ['search']),
		options: [
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Comment Count', value: 'comment_count' },
					{ name: 'New', value: 'new' },
					{ name: 'Relevance', value: 'relevance' },
					{ name: 'Top', value: 'top' },
				],
				default: 'relevance',
				description: 'Order of the results',
			},
			{
				displayName: 'Timeframe',
				name: 'timeframe',
				type: 'options',
				options: TIMEFRAMES,
				default: 'all',
				description: 'Only return posts from this window',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['reddit'], ['getSubredditPosts']),
		options: [
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Best', value: 'best' },
					{ name: 'Hot', value: 'hot' },
					{ name: 'New', value: 'new' },
					{ name: 'Rising', value: 'rising' },
					{ name: 'Top', value: 'top' },
				],
				default: 'hot',
				description: 'Order of the posts',
			},
			{
				displayName: 'Timeframe',
				name: 'timeframe',
				type: 'options',
				options: TIMEFRAMES,
				default: 'week',
				description: 'Time window for Top. Ignored with another sort; without a sort it means Top.',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['threads'], ['search']),
		options: [
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				description: 'Only posts on or before this day (UTC)',
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				description: 'Only posts on or after this day (UTC)',
			},
		],
	},
];
