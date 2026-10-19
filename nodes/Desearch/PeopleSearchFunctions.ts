import {
	NodeApiError,
	NodeOperationError,
	sleep,
	type DeclarativeRestApiSettings,
	type IDataObject,
	type IExecutePaginationFunctions,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INode,
	type INodeExecutionData,
	type JsonObject,
} from 'n8n-workflow';

/**
 * Routing hooks for the People Search resource (`/desearch/people/*`).
 *
 * The node stays declarative: every operation is a routing request, and these
 * functions only build request bodies and query strings, wait for a search to
 * finish, follow `next_cursor` pages and turn API errors into node errors.
 */

export type PeoplePlatform = 'x' | 'youtube' | 'linkedin' | 'tiktok';

/**
 * Search filters each platform accepts inside the request `filters` object.
 * The API rejects any other key, so filters that do not apply to the chosen
 * platform are left out of the request.
 */
export const PEOPLE_SEARCH_FILTERS: Record<PeoplePlatform, readonly string[]> = {
	x: [
		'min_followers',
		'max_followers',
		'verified_only',
		'countries',
		'keywords',
		'exclude_keywords',
	],
	youtube: [
		'min_subscribers',
		'max_subscribers',
		'countries',
		'require_contact',
		'keywords',
		'exclude_keywords',
	],
	linkedin: ['min_followers', 'max_followers', 'countries', 'keywords', 'exclude_keywords'],
	tiktok: ['min_followers', 'max_followers', 'require_contact', 'keywords', 'exclude_keywords'],
};

/** Node parameter name in the Start Search "Filters" collection -> API filter name. */
const SEARCH_FILTER_PARAMETERS: Record<string, string> = {
	countries: 'countries',
	excludeKeywords: 'exclude_keywords',
	keywords: 'keywords',
	maxFollowers: 'max_followers',
	maxSubscribers: 'max_subscribers',
	minFollowers: 'min_followers',
	minSubscribers: 'min_subscribers',
	requireContact: 'require_contact',
	verifiedOnly: 'verified_only',
};

/** API filters that take a list of strings. */
const LIST_FILTERS = new Set(['countries', 'keywords', 'exclude_keywords']);

/** Platforms whose people can be filtered by `verified` on List Profiles. */
const VERIFIED_PLATFORMS = new Set(['x', 'tiktok']);

/** Statuses after which a search does not change again and its results can be read. */
const FINISHED_STATUSES = new Set(['completed', 'partial', 'cancelled']);

/** Largest `limit` each paginated route accepts. */
export const MAX_PAGE_SIZE = {
	results: 500,
	tasks: 100,
	profiles: 200,
} as const;

/** Splits a comma or newline separated string (or an array) into trimmed, non-empty strings. */
export function splitList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const parts: unknown[] = Array.isArray(value) ? value : String(value).split(/[,\n]/);
	return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

function numberOrUndefined(value: unknown): number | undefined {
	if (!isSet(value)) {
		return undefined;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}

/**
 * The reason the API gives for an error. The API puts it in `detail`: a string,
 * or a list of validation errors (`[{ loc, msg }]`).
 */
export function apiErrorDetail(body: unknown): string | undefined {
	if (typeof body === 'string') {
		// Plain-text bodies only: an HTML error page (for example from a proxy) says nothing useful.
		const text = body.trim();
		return text === '' || text.startsWith('<') ? undefined : text.slice(0, 500);
	}
	const detail = (body as IDataObject | undefined)?.detail;
	if (typeof detail === 'string') {
		return detail;
	}
	if (Array.isArray(detail)) {
		const messages = detail.map((entry) => {
			const { loc, msg } = (entry ?? {}) as IDataObject;
			const field = Array.isArray(loc) ? loc.filter((part) => part !== 'body').join('.') : '';
			const text = typeof msg === 'string' ? msg : JSON.stringify(entry);
			return field === '' ? text : `${field}: ${text}`;
		});
		return messages.length > 0 ? messages.join('; ') : undefined;
	}
	return undefined;
}

/** A node error for an HTTP error response, with the API's reason as its description. */
function apiError(node: INode, statusCode: number, body: unknown, itemIndex: number): NodeApiError {
	const errorBody = (
		body !== null && typeof body === 'object' ? body : { detail: body }
	) as JsonObject;
	return new NodeApiError(node, errorBody, {
		httpCode: String(statusCode),
		description: apiErrorDetail(body),
		itemIndex,
	});
}

/**
 * People Search requests are sent with `ignoreHttpStatusErrors`, so this check
 * fails the item on an HTTP error and shows the API's reason (for example
 * "Not enough credits" or why a task cannot be paused) instead of a generic message.
 */
export async function checkPeopleResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (response.statusCode < 400) {
		return items;
	}
	throw apiError(this.getNode(), response.statusCode, response.body, this.getItemIndex());
}

/** Builds the body and headers of `POST /desearch/people/search/{platform}`. */
export async function prepareStartSearch(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const platform = this.getNodeParameter('platform') as PeoplePlatform;
	if (!Object.prototype.hasOwnProperty.call(PEOPLE_SEARCH_FILTERS, platform)) {
		throw new NodeOperationError(this.getNode(), `Unknown platform "${platform}"`, {
			itemIndex: this.getItemIndex(),
			description: 'Use x, youtube, linkedin or tiktok.',
		});
	}

	const allowedFilters = PEOPLE_SEARCH_FILTERS[platform];

	const body: IDataObject = {
		query: String(this.getNodeParameter('query', '')).trim(),
		count: this.getNodeParameter('count', 25) as number,
	};

	const options = this.getNodeParameter('searchOptions', {}) as IDataObject;
	const minScore = numberOrUndefined(options.minScore);
	if (minScore !== undefined) {
		body.min_score = minScore;
	}
	const exclude = splitList(options.exclude);
	if (exclude.length > 0) {
		body.exclude = exclude;
	}

	const filterValues = this.getNodeParameter('searchFilters', {}) as IDataObject;
	const filters: IDataObject = {};
	for (const [parameter, value] of Object.entries(filterValues)) {
		const name = SEARCH_FILTER_PARAMETERS[parameter];
		if (!name || !allowedFilters.includes(name) || !isSet(value)) {
			continue;
		}
		if (LIST_FILTERS.has(name)) {
			const list = splitList(value);
			if (list.length > 0) {
				filters[name] = list;
			}
		} else {
			filters[name] = value;
		}
	}
	if (Object.keys(filters).length > 0) {
		body.filters = filters;
	}

	requestOptions.body = body;

	const idempotencyKey = String(options.idempotencyKey ?? '').trim();
	if (idempotencyKey !== '') {
		requestOptions.headers = { ...requestOptions.headers, 'Idempotency-Key': idempotencyKey };
	}

	return requestOptions;
}

/** Builds the query string of `GET /desearch/people/tasks`. */
export async function prepareListTasks(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const filters = this.getNodeParameter('taskFilters', {}) as IDataObject;
	const qs: IDataObject = { ...requestOptions.qs };
	if (isSet(filters.platform)) {
		qs.platform = filters.platform;
	}
	const statuses = splitList(filters.status);
	if (statuses.length > 0) {
		qs.status = statuses.join(',');
	}
	requestOptions.qs = qs;
	return requestOptions;
}

/** Builds the query string of `GET /desearch/people/profiles`. */
export async function prepareListProfiles(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const platform = this.getNodeParameter('platform') as string;
	const qs: IDataObject = {
		...requestOptions.qs,
		platform,
		sort: this.getNodeParameter('sortBy', 'score') as string,
	};

	const filters = this.getNodeParameter('profileFilters', {}) as IDataObject;
	const searchText = String(filters.searchText ?? '').trim();
	if (searchText !== '') {
		qs.q = searchText;
	}
	const has = splitList(filters.has);
	if (has.length > 0) {
		qs.has = has.join(',');
	}
	const numberFilters: Array<[string, string]> = [
		['minAudience', 'min_audience'],
		['maxAudience', 'max_audience'],
		['minScore', 'min_score'],
	];
	for (const [parameter, name] of numberFilters) {
		const value = numberOrUndefined(filters[parameter]);
		if (value !== undefined) {
			qs[name] = value;
		}
	}
	const location = String(filters.location ?? '').trim();
	if (location !== '') {
		qs.location = location;
	}
	if (filters.verifiedOnly === true && VERIFIED_PLATFORMS.has(platform)) {
		qs.verified = true;
	}

	requestOptions.qs = qs;
	return requestOptions;
}

function describeTaskErrors(task: IDataObject): string | undefined {
	const errors = Array.isArray(task.errors) ? task.errors : [];
	const text = errors
		.map((error) => {
			if (typeof error === 'string') {
				return error;
			}
			const object = (error ?? {}) as IDataObject;
			return String(object.message ?? object.detail ?? JSON.stringify(error));
		})
		.filter((message) => message !== '')
		.join('; ');
	return text === '' ? undefined : text;
}

/**
 * Get Results with "Wait for Completion": polls `GET /desearch/people/tasks/{task_id}`
 * until the search has finished, then lets the results request run.
 */
export async function waitForPeopleTask(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	if (this.getNodeParameter('waitForCompletion', false) !== true) {
		return requestOptions;
	}

	const node = this.getNode();
	const itemIndex = this.getItemIndex();
	const taskId = String(this.getNodeParameter('taskId', '')).trim();
	const timeoutSeconds = Math.max(0, Number(this.getNodeParameter('timeout', 600)) || 0);
	const pollMilliseconds =
		Math.max(1, Number(this.getNodeParameter('pollInterval', 15)) || 15) * 1000;
	const deadline = Date.now() + timeoutSeconds * 1000;
	const cancelSignal = this.getExecutionCancelSignal?.();

	// Same base URL, proxy, timeout and TLS settings as the results request.
	const taskRequest: IHttpRequestOptions = {
		...requestOptions,
		method: 'GET',
		url: `/desearch/people/tasks/${encodeURIComponent(taskId)}`,
		qs: {},
		body: undefined,
		json: true,
		ignoreHttpStatusErrors: true,
		returnFullResponse: true,
	};

	for (;;) {
		if (cancelSignal?.aborted) {
			throw new NodeOperationError(
				node,
				'The execution was cancelled while waiting for the search',
				{
					itemIndex,
				},
			);
		}

		let response: IN8nHttpFullResponse;
		try {
			response = (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'desearchApi',
				taskRequest,
			)) as IN8nHttpFullResponse;
		} catch (error) {
			throw new NodeApiError(node, error as JsonObject, { itemIndex });
		}
		if (response.statusCode >= 400) {
			throw apiError(node, response.statusCode, response.body, itemIndex);
		}

		const task = (response.body ?? {}) as IDataObject;
		const status = String(task.status ?? '');
		if (FINISHED_STATUSES.has(status)) {
			return requestOptions;
		}

		const found = `${task.result_count ?? 0} of ${task.count ?? '?'} people`;
		if (status === 'failed') {
			throw new NodeOperationError(node, 'The search failed', {
				itemIndex,
				description:
					describeTaskErrors(task) ??
					`Task ${taskId} failed. A search that delivers no people is not charged.`,
			});
		}
		if (status === 'expired') {
			throw new NodeOperationError(node, 'The search results expired', {
				itemIndex,
				description: `Task ${taskId}: results are kept for 30 days after a search ends.`,
			});
		}
		if (status === 'paused') {
			throw new NodeOperationError(node, 'The search is paused', {
				itemIndex,
				description: `Task ${taskId} found ${found} before it was paused. Resume it with the Resume Task operation, then run Get Results again.`,
			});
		}

		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			throw new NodeOperationError(
				node,
				`The search did not finish within ${timeoutSeconds} seconds`,
				{
					itemIndex,
					description: `Task ${taskId} is ${status || 'still running'} with ${found} found so far. It keeps running in the background: run Get Results again later with this task ID, or raise Timeout.`,
				},
			);
		}

		await sleep(Math.min(pollMilliseconds, remaining));
	}
}

/**
 * Pagination for routes that page with `limit` + `cursor` and return `next_cursor`.
 * Returns one item per entry of `listProperty`, honouring Return All and Limit.
 */
function cursorPagination(
	listProperty: string,
	maxPageSize: number,
	hasMorePages: (page: IDataObject) => boolean,
) {
	return async function (
		this: IExecutePaginationFunctions,
		requestData: DeclarativeRestApiSettings.ResultOptions,
	): Promise<INodeExecutionData[]> {
		const returnAll = this.getNodeParameter('returnAll', false) === true;
		const limit = returnAll
			? Number.POSITIVE_INFINITY
			: Math.max(1, Number(this.getNodeParameter('limit', 50)) || 50);

		const items: INodeExecutionData[] = [];
		let cursor: string | undefined;

		for (;;) {
			const qs: IDataObject = {
				...requestData.options.qs,
				limit: Math.min(maxPageSize, limit - items.length),
			};
			if (cursor === undefined) {
				delete qs.cursor;
			} else {
				qs.cursor = cursor;
			}

			const [response] = await this.makeRoutingRequest({
				...requestData,
				options: { ...requestData.options, qs },
			});
			const page = (response?.json ?? {}) as IDataObject;
			const entries = Array.isArray(page[listProperty])
				? (page[listProperty] as IDataObject[])
				: [];
			for (const json of entries.slice(0, limit - items.length)) {
				items.push({ json });
			}

			const nextCursor =
				typeof page.next_cursor === 'string' && page.next_cursor !== ''
					? page.next_cursor
					: undefined;
			if (
				items.length >= limit ||
				entries.length === 0 ||
				nextCursor === undefined ||
				!hasMorePages(page)
			) {
				return items;
			}
			cursor = nextCursor;
		}
	};
}

/** `GET /desearch/people/tasks/{task_id}/results`: `has_more` says whether another page is ready. */
export const paginateResults = cursorPagination(
	'results',
	MAX_PAGE_SIZE.results,
	(page) => page.has_more === true,
);

/** `GET /desearch/people/tasks`: `next_cursor` is null on the last page. */
export const paginateTasks = cursorPagination('tasks', MAX_PAGE_SIZE.tasks, () => true);

/** `GET /desearch/people/profiles`: `next_cursor` is null on the last page. */
export const paginateProfiles = cursorPagination('profiles', MAX_PAGE_SIZE.profiles, () => true);
