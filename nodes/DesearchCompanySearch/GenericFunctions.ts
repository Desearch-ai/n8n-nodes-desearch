import {
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type INode,
} from 'n8n-workflow';

import { peopleApiRequest, splitList } from '../DesearchPeopleSearch/GenericFunctions';

/**
 * Company Search and Company Enrich (`/desearch/companies/*`) run on the People
 * Search engine: same credential, errors, pagination, statuses and pause / resume /
 * cancel. A People Search task ID is a 404 on these routes and the other way round.
 */

export type CompanyTaskType = 'search' | 'enrich';

/** Leaders a task looks for (`roles`). The API default is ceo, founder, cto, cfo. */
export const COMPANY_ROLES = [
	'ceo',
	'founder',
	'cto',
	'cfo',
	'coo',
	'cmo',
	'president',
	'owner',
	'managing_director',
] as const;

/** `filters.require`: a company without all of these is not delivered or billed. */
export const COMPANY_REQUIREMENTS = [
	'email',
	'phone',
	'linkedin',
	'leader',
	'leader_email',
] as const;

/** Most domains one Company Enrich task takes. */
export const COMPANY_DOMAINS_MAX = 200;

/** Most `metadata.<key>` filters the task list takes. */
export const METADATA_FILTERS_MAX = 3;

/** Statuses after which a task does not change again and its results can be read. */
const FINISHED_STATUSES = new Set(['completed', 'partial', 'cancelled']);

const START_PATHS: Record<CompanyTaskType, string> = {
	search: '/desearch/companies/search',
	enrich: '/desearch/companies/enrich',
};

/** What a task is called in error messages. */
const TASK_LABELS: Record<CompanyTaskType, string> = {
	search: 'Company Search',
	enrich: 'Company Enrich',
};

export function isCompanyTaskType(value: unknown): value is CompanyTaskType {
	return value === 'search' || value === 'enrich';
}

/** Path of one company task, e.g. companyTaskPath(id, '/pause'). */
export function companyTaskPath(taskId: string, suffix = ''): string {
	return `/desearch/companies/tasks/${encodeURIComponent(taskId)}${suffix}`;
}

function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

/**
 * Labels from a Metadata fixed collection (`{ label: [{ key, value }] }`), or
 * undefined when there are none. Empty keys are left out.
 */
export function metadataLabels(value: unknown): IDataObject | undefined {
	const entries = ((value ?? {}) as IDataObject).label;
	const labels: IDataObject = {};
	for (const entry of Array.isArray(entries) ? entries : []) {
		const { key, value: labelValue } = (entry ?? {}) as IDataObject;
		const name = String(key ?? '').trim();
		if (name !== '') {
			labels[name] = String(labelValue ?? '');
		}
	}
	return Object.keys(labels).length > 0 ? labels : undefined;
}

/** Roles, email inference, email checks, metadata and Idempotency-Key, shared by both Start operations. */
function taskOptions(options: IDataObject, body: IDataObject): IDataObject {
	const roles = splitList(options.roles);
	if (roles.length > 0) {
		body.roles = [...new Set(roles)];
	}
	if (typeof options.inferEmails === 'boolean') {
		body.infer_emails = options.inferEmails;
	}
	if (typeof options.verifyEmails === 'boolean') {
		body.verify_emails = options.verifyEmails;
	}
	const metadata = metadataLabels(options.metadata);
	if (metadata !== undefined) {
		body.metadata = metadata;
	}

	const headers: IDataObject = {};
	const idempotencyKey = String(options.idempotencyKey ?? '').trim();
	if (idempotencyKey !== '') {
		headers['Idempotency-Key'] = idempotencyKey;
	}
	return headers;
}

/** Body and headers of `POST /desearch/companies/search`. */
export function buildStartCompanySearchRequest({
	query,
	count,
	searchFilters,
	searchOptions,
}: {
	query: unknown;
	count: unknown;
	searchFilters: IDataObject;
	searchOptions: IDataObject;
}): { path: string; body: IDataObject; headers: IDataObject } {
	const body: IDataObject = { query: String(query ?? '').trim(), count: count as number };

	if (isSet(searchOptions.minScore)) {
		body.min_score = Number(searchOptions.minScore);
	}
	const exclude = splitList(searchOptions.exclude);
	if (exclude.length > 0) {
		body.exclude = exclude;
	}

	const filters: IDataObject = {};
	const countries = splitList(searchFilters.countries);
	if (countries.length > 0) {
		filters.countries = countries;
	}
	const require = splitList(searchFilters.require);
	if (require.length > 0) {
		filters.require = [...new Set(require)];
	}
	if (Object.keys(filters).length > 0) {
		body.filters = filters;
	}

	const headers = taskOptions(searchOptions, body);
	return { path: START_PATHS.search, body, headers };
}

/** Body and headers of `POST /desearch/companies/enrich`. */
export function buildStartCompanyEnrichRequest(
	node: INode,
	itemIndex: number,
	{ domains, enrichOptions }: { domains: unknown; enrichOptions: IDataObject },
): { path: string; body: IDataObject; headers: IDataObject } {
	const list = splitList(domains);
	if (list.length === 0) {
		throw new NodeOperationError(node, 'Domains is empty', {
			itemIndex,
			description: 'Add 1 to 200 company domains or URLs, separated by commas or new lines.',
		});
	}
	if (list.length > COMPANY_DOMAINS_MAX) {
		throw new NodeOperationError(node, `Too many domains (${list.length})`, {
			itemIndex,
			description: `One Company Enrich task takes at most ${COMPANY_DOMAINS_MAX} domains. Split them across items. Nothing was charged.`,
		});
	}
	const body: IDataObject = { domains: list };
	const headers = taskOptions(enrichOptions, body);
	return { path: START_PATHS.enrich, body, headers };
}

/** Query string of `GET /desearch/companies/tasks` for one task type. */
export function buildListCompanyTasksQuery(
	node: INode,
	itemIndex: number,
	type: CompanyTaskType,
	filters: IDataObject,
): IDataObject {
	const qs: IDataObject = { type };
	const statuses = splitList(filters.status);
	if (statuses.length > 0) {
		qs.status = statuses.join(',');
	}
	const metadata = metadataLabels(filters.metadata) ?? {};
	if (Object.keys(metadata).length > METADATA_FILTERS_MAX) {
		throw new NodeOperationError(node, 'Too many metadata filters', {
			itemIndex,
			description: `Filter by at most ${METADATA_FILTERS_MAX} metadata labels.`,
		});
	}
	// The API reads metadata filters as metadata.<key>=<value>, one parameter per pair.
	for (const [key, value] of Object.entries(metadata)) {
		qs[`metadata.${key}`] = value;
	}
	return qs;
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
 * Polls `GET /desearch/companies/tasks/{task_id}` every `pollSeconds` until the task
 * has finished, and returns the finished task. A task stays `running` (stage
 * `enriching`) while later stages fill in companies it already delivered, so waiting
 * for it to finish gives every company in its final version. Fails when the task
 * failed, is paused, expired, or is still running after `timeoutSeconds`.
 */
export async function waitForCompanyTask(
	this: IExecuteFunctions,
	itemIndex: number,
	type: CompanyTaskType,
	taskId: string,
	timeoutSeconds: number,
	pollSeconds: number,
): Promise<IDataObject> {
	const node = this.getNode();
	const label = TASK_LABELS[type];
	const timeout = Math.max(0, Number(timeoutSeconds) || 0);
	const pollMilliseconds = Math.max(1, Number(pollSeconds) || 15) * 1000;
	const deadline = Date.now() + timeout * 1000;
	const cancelSignal = this.getExecutionCancelSignal?.();

	for (;;) {
		if (cancelSignal?.aborted) {
			throw new NodeOperationError(
				node,
				`The execution was cancelled while waiting for the ${label} task`,
				{ itemIndex },
			);
		}

		const task = await peopleApiRequest.call(this, itemIndex, 'GET', companyTaskPath(taskId));
		const status = String(task.status ?? '');
		if (FINISHED_STATUSES.has(status)) {
			return task;
		}

		const delivered = `${task.result_count ?? 0} of ${task.count ?? '?'} companies`;
		if (status === 'failed') {
			throw new NodeOperationError(node, `The ${label} task failed`, {
				itemIndex,
				description:
					describeTaskErrors(task) ??
					`Task ${taskId} failed. A task that delivers no companies is not charged.`,
			});
		}
		if (status === 'expired') {
			throw new NodeOperationError(node, `The ${label} results expired`, {
				itemIndex,
				description: `Task ${taskId}: results are kept for 30 days after a task ends.`,
			});
		}
		if (status === 'paused') {
			throw new NodeOperationError(node, `The ${label} task is paused`, {
				itemIndex,
				description: `Task ${taskId} delivered ${delivered} before it was paused. Resume it, then get its results again.`,
			});
		}

		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			const stage =
				task.stage === 'enriching'
					? ' (every company is delivered; later stages are still filling some in)'
					: '';
			throw new NodeOperationError(
				node,
				`The ${label} task did not finish within ${timeout} seconds`,
				{
					itemIndex,
					description: `Task ${taskId} is ${status || 'still running'}${stage} with ${delivered} delivered so far. It keeps running in the background: get its results again later with this task ID, or raise Timeout.`,
				},
			);
		}

		await sleep(Math.min(pollMilliseconds, remaining));
	}
}
