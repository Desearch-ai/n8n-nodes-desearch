import {
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type INode,
} from 'n8n-workflow';

import { metadataLabels } from '../DesearchCompanySearch/GenericFunctions';
import { peopleApiRequest, splitList } from '../DesearchPeopleSearch/GenericFunctions';
import { isSet } from '../shared/transport';

/**
 * Monitors (`/desearch/monitors/*`): searches that run on a schedule and keep only what is
 * new. Every route is free; each run is billed (its searches at list price, AI screening per
 * item and the summary's LLM usage). Same credential and errors as People Search.
 */

export const MONITOR_SOURCES = [
	'web',
	'x',
	'reddit',
	'youtube',
	'threads',
	'tiktok',
	'instagram',
	'facebook',
	'meta_ads',
] as const;

export const MONITOR_INTERVALS = ['1h', '3h', '6h', '12h', '1d', '7d'] as const;

export const MONITOR_EVENTS = [
	'monitor.items.found',
	'monitor.run.completed',
	'monitor.run.failed',
] as const;

/** Most criteria a monitor takes. */
export const MONITOR_CRITERIA_MAX = 5;

/**
 * Watched-account and watched-hashtag fields: node field -> [source, API option]. With
 * accounts or hashtags (up to 10 each per source), a source reads their newest posts instead
 * of searching; a hashtag feed lists posts from any account. Names and hashtags go to the API
 * as typed; it cleans them (`@OpenAI` or a profile URL becomes `OpenAI`, `#ავერსი` or a tag
 * URL becomes the tag) and returns 422 for one it cannot read. Instagram and Facebook only
 * watch accounts (and Instagram hashtags): the API returns 422 for a monitor with Instagram
 * and no accounts or hashtags, or with Facebook and no pages.
 */
const ACCOUNT_FIELDS: Record<string, [string, string]> = {
	xAccounts: ['x', 'accounts'],
	redditSubreddits: ['reddit', 'subreddits'],
	youtubeChannels: ['youtube', 'channels'],
	tiktokAccounts: ['tiktok', 'accounts'],
	tiktokHashtags: ['tiktok', 'hashtags'],
	threadsAccounts: ['threads', 'accounts'],
	instagramAccounts: ['instagram', 'accounts'],
	instagramHashtags: ['instagram', 'hashtags'],
	facebookPages: ['facebook', 'pages'],
};

/** Largest `limit` each monitor list accepts. */
export const MONITOR_PAGE_SIZE = {
	monitors: 100,
	runs: 100,
	items: 200,
} as const;

/** Run statuses after which a run does not change again. */
const RUN_ENDED_STATUSES = new Set(['completed', 'failed', 'cancelled']);

/** Path of one monitor, e.g. monitorPath(id, '/trigger'). */
export function monitorPath(monitorId: string, suffix = ''): string {
	return `/desearch/monitors/${encodeURIComponent(monitorId)}${suffix}`;
}

/** Path of one run of a monitor. */
export function monitorRunPath(monitorId: string, runId: string): string {
	return monitorPath(monitorId, `/runs/${encodeURIComponent(runId)}`);
}

/** One entry per line, trimmed, empty lines left out. Criteria may contain commas. */
export function splitLines(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const parts: unknown[] = Array.isArray(value) ? value : String(value).split('\n');
	return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

function criteriaList(node: INode, itemIndex: number, value: unknown): string[] {
	const criteria = splitLines(value);
	if (criteria.length > MONITOR_CRITERIA_MAX) {
		throw new NodeOperationError(node, `Too many criteria (${criteria.length})`, {
			itemIndex,
			description: `A monitor takes at most ${MONITOR_CRITERIA_MAX} criteria, one per line.`,
		});
	}
	return criteria;
}

function sourceList(node: INode, itemIndex: number, value: unknown): string[] {
	const sources = [...new Set(splitList(value))];
	if (sources.length === 0) {
		throw new NodeOperationError(node, 'Sources is empty', {
			itemIndex,
			description:
				'Pick at least one of Web, X, Reddit, YouTube, Threads, TikTok, Instagram, Facebook and Meta Ads.',
		});
	}
	return sources;
}

/**
 * The API's per-source `options` from the node's flat option fields, or undefined when none
 * is set: `web.count`; `x.count`, `x.lang`, `x.min_likes`, `x.accounts`; `reddit.subreddits`;
 * `youtube.channels`; `tiktok.count`, `tiktok.accounts`, `tiktok.hashtags`; `threads.accounts`;
 * `instagram.accounts`, `instagram.hashtags`; `facebook.pages`; `meta_ads.count`. An account
 * or hashtag field that is set but empty is sent as `[]` with `clearEmpty` (Update: it stops
 * watching them).
 */
export function sourceOptions(
	fields: IDataObject,
	{ clearEmpty = false }: { clearEmpty?: boolean } = {},
): IDataObject | undefined {
	const options: Record<string, IDataObject> = {};
	const set = (source: string, name: string, value: number | string | string[]) => {
		options[source] = { ...options[source], [name]: value };
	};
	if (isSet(fields.webCount)) {
		set('web', 'count', Number(fields.webCount));
	}
	if (isSet(fields.xCount)) {
		set('x', 'count', Number(fields.xCount));
	}
	const lang = String(fields.xLang ?? '').trim();
	if (lang !== '') {
		set('x', 'lang', lang);
	}
	if (isSet(fields.xMinLikes)) {
		set('x', 'min_likes', Number(fields.xMinLikes));
	}
	if (isSet(fields.tiktokCount)) {
		set('tiktok', 'count', Number(fields.tiktokCount));
	}
	if (isSet(fields.metaAdsCount)) {
		set('meta_ads', 'count', Number(fields.metaAdsCount));
	}
	for (const [field, [source, name]] of Object.entries(ACCOUNT_FIELDS)) {
		if (fields[field] === undefined) {
			continue;
		}
		const accounts = [...new Set(splitList(fields[field]))];
		if (accounts.length > 0 || clearEmpty) {
			set(source, name, accounts);
		}
	}
	return Object.keys(options).length > 0 ? options : undefined;
}

/** `{ url, events }` from Webhook URL and Webhook Events, or undefined without a URL. */
function webhookBody(fields: IDataObject): IDataObject | undefined {
	const url = String(fields.webhookUrl ?? '').trim();
	if (url === '') {
		return undefined;
	}
	const webhook: IDataObject = { url };
	const events = splitList(fields.webhookEvents);
	if (events.length > 0) {
		webhook.events = [...new Set(events)];
	}
	return webhook;
}

/** Whether an Update changes the webhook (its URL or events) without removing it. */
function changesWebhook(fields: IDataObject): boolean {
	return (
		fields.removeWebhook !== true &&
		(String(fields.webhookUrl ?? '').trim() !== '' || splitList(fields.webhookEvents).length > 0)
	);
}

/** Body of `POST /desearch/monitors`. */
export function buildCreateMonitorBody(
	node: INode,
	itemIndex: number,
	{
		query,
		sources,
		interval,
		createOptions,
	}: { query: unknown; sources: unknown; interval: unknown; createOptions: IDataObject },
): IDataObject {
	const body: IDataObject = {
		query: String(query ?? '').trim(),
		sources: sourceList(node, itemIndex, sources),
		interval: String(interval ?? '1d'),
	};

	const name = String(createOptions.name ?? '').trim();
	if (name !== '') {
		body.name = name;
	}
	const criteria = criteriaList(node, itemIndex, createOptions.criteria);
	if (criteria.length > 0) {
		body.criteria = criteria;
	}
	const options = sourceOptions(createOptions);
	if (options !== undefined) {
		body.options = options;
	}
	if (isSet(createOptions.minScore)) {
		body.min_score = Number(createOptions.minScore);
	}
	if (typeof createOptions.summary === 'boolean') {
		body.summary = createOptions.summary;
	}
	const webhook = webhookBody(createOptions);
	if (webhook !== undefined) {
		body.webhook = webhook;
	}
	const metadata = metadataLabels(createOptions.metadata);
	if (metadata !== undefined) {
		body.metadata = metadata;
	}
	if (typeof createOptions.runNow === 'boolean') {
		body.run_now = createOptions.runNow;
	}
	return body;
}

/** Body of `POST /desearch/monitors/estimate`. */
export function buildEstimateBody(
	node: INode,
	itemIndex: number,
	{
		sources,
		interval,
		estimateOptions,
	}: { sources: unknown; interval: unknown; estimateOptions: IDataObject },
): IDataObject {
	const body: IDataObject = {
		sources: sourceList(node, itemIndex, sources),
		interval: String(interval ?? '1d'),
	};
	const options = sourceOptions(estimateOptions);
	if (options !== undefined) {
		body.options = options;
	}
	if (typeof estimateOptions.summary === 'boolean') {
		body.summary = estimateOptions.summary;
	}
	return body;
}

/**
 * Whether an Update needs the monitor's current settings: the API replaces `options` and
 * `webhook` as a whole, so changing part of them keeps the rest from the current monitor.
 */
export function updateNeedsCurrent(fields: IDataObject): boolean {
	return sourceOptions(fields, { clearEmpty: true }) !== undefined || changesWebhook(fields);
}

/**
 * Body of `PATCH /desearch/monitors/{monitor_id}`: only the fields that are set. The API
 * replaces `options` and `webhook` as a whole, so `current` (the monitor before the update)
 * fills in the per-source options and the webhook URL this update does not change.
 */
export function buildUpdateMonitorBody(
	node: INode,
	itemIndex: number,
	fields: IDataObject,
	current: IDataObject = {},
): IDataObject {
	const body: IDataObject = {};

	for (const name of ['name', 'query'] as const) {
		const value = String(fields[name] ?? '').trim();
		if (value !== '') {
			body[name] = value;
		}
	}
	if (fields.criteria !== undefined) {
		// Set but empty clears the criteria.
		body.criteria = criteriaList(node, itemIndex, fields.criteria);
	}
	if (fields.sources !== undefined) {
		body.sources = sourceList(node, itemIndex, fields.sources);
	}
	if (isSet(fields.interval)) {
		body.interval = fields.interval;
	}
	if (isSet(fields.status)) {
		body.status = fields.status;
	}
	if (isSet(fields.minScore)) {
		body.min_score = Number(fields.minScore);
	}
	if (typeof fields.summary === 'boolean') {
		body.summary = fields.summary;
	}

	const changed = sourceOptions(fields, { clearEmpty: true });
	if (changed !== undefined) {
		const options: IDataObject = { ...((current.options ?? {}) as IDataObject) };
		for (const [source, values] of Object.entries(changed)) {
			options[source] = { ...((options[source] ?? {}) as IDataObject), ...(values as IDataObject) };
		}
		body.options = options;
	}

	if (fields.removeWebhook === true) {
		body.webhook = null;
	} else if (changesWebhook(fields)) {
		const currentWebhook = (current.webhook ?? {}) as IDataObject;
		const webhook = webhookBody({
			webhookUrl: String(fields.webhookUrl ?? '').trim() || currentWebhook.url,
			webhookEvents:
				splitList(fields.webhookEvents).length > 0 ? fields.webhookEvents : currentWebhook.events,
		});
		if (webhook === undefined) {
			throw new NodeOperationError(node, 'The monitor has no webhook', {
				itemIndex,
				description: 'Set Webhook URL to add one with these events.',
			});
		}
		body.webhook = webhook;
	}

	if (fields.metadata !== undefined) {
		body.metadata = metadataLabels(fields.metadata) ?? {};
	}

	if (Object.keys(body).length === 0) {
		throw new NodeOperationError(node, 'Nothing to update', {
			itemIndex,
			description: 'Add at least one field under Update Fields.',
		});
	}
	return body;
}

/** Query string of `GET /desearch/monitors`. */
export function buildListMonitorsQuery(filters: IDataObject): IDataObject {
	const qs: IDataObject = {};
	const statuses = splitList(filters.status);
	if (statuses.length > 0) {
		qs.status = statuses.join(',');
	}
	return qs;
}

/**
 * Polls `GET /desearch/monitors/{monitor_id}/runs/{run_id}` every `pollSeconds` until the
 * run has ended, and returns it with its items. Fails when the run failed or was cancelled,
 * or is still queued or running after `timeoutSeconds`.
 */
export async function waitForMonitorRun(
	this: IExecuteFunctions,
	itemIndex: number,
	monitorId: string,
	runId: string,
	timeoutSeconds: number,
	pollSeconds: number,
): Promise<IDataObject> {
	const node = this.getNode();
	const timeout = Math.max(0, Number(timeoutSeconds) || 0);
	const pollMilliseconds = Math.max(1, Number(pollSeconds) || 10) * 1000;
	const deadline = Date.now() + timeout * 1000;
	const cancelSignal = this.getExecutionCancelSignal?.();

	for (;;) {
		if (cancelSignal?.aborted) {
			throw new NodeOperationError(node, 'The execution was cancelled while waiting for the run', {
				itemIndex,
			});
		}

		const run = await peopleApiRequest.call(
			this,
			itemIndex,
			'GET',
			monitorRunPath(monitorId, runId),
		);
		const status = String(run.status ?? '');
		if (status === 'completed') {
			return run;
		}
		if (RUN_ENDED_STATUSES.has(status)) {
			throw new NodeOperationError(
				node,
				`The monitor run ${status === 'failed' ? 'failed' : 'was cancelled'}`,
				{
					itemIndex,
					description: `Run ${runId}${run.fail_reason ? `: ${String(run.fail_reason)}` : ''}. A run is billed only for what it used.`,
				},
			);
		}

		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			throw new NodeOperationError(
				node,
				`The monitor run did not finish within ${timeout} seconds`,
				{
					itemIndex,
					description: `Run ${runId} is ${status || 'still running'}. It keeps running in the background: get it again later with this run ID, or raise Timeout.`,
				},
			);
		}

		await sleep(Math.min(pollMilliseconds, remaining));
	}
}
