import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import {
	asNodeError,
	collectPages,
	peopleApiRequest,
} from '../DesearchPeopleSearch/GenericFunctions';
import { monitorsProperties } from './MonitorsDescription';
import {
	MONITOR_PAGE_SIZE,
	buildCreateMonitorBody,
	buildEstimateBody,
	buildListMonitorsQuery,
	buildUpdateMonitorBody,
	monitorPath,
	monitorRunPath,
	updateNeedsCurrent,
	waitForMonitorRun,
} from './GenericFunctions';

/** Max entries to return: Infinity when Return All is on. */
function resultLimit(this: IExecuteFunctions, itemIndex: number): number {
	if (this.getNodeParameter('returnAll', itemIndex, false) === true) {
		return Number.POSITIVE_INFINITY;
	}
	return Math.max(1, Number(this.getNodeParameter('limit', itemIndex, 50)) || 50);
}

function idParameter(
	this: IExecuteFunctions,
	itemIndex: number,
	name: 'monitorId' | 'runId',
): string {
	const id = String(this.getNodeParameter(name, itemIndex, '')).trim();
	if (id === '') {
		const label = name === 'monitorId' ? 'Monitor ID' : 'Run ID';
		throw new NodeOperationError(this.getNode(), `${label} is empty`, {
			itemIndex,
			description:
				name === 'monitorId'
					? 'Use the monitor_id that Create returned.'
					: 'Use a run_id from Trigger Run or Run > Get Many.',
		});
	}
	return id;
}

async function monitorOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject[] | undefined> {
	switch (operation) {
		case 'create': {
			const body = buildCreateMonitorBody(this.getNode(), itemIndex, {
				query: this.getNodeParameter('query', itemIndex, ''),
				sources: this.getNodeParameter('sources', itemIndex, []),
				interval: this.getNodeParameter('interval', itemIndex, '1d'),
				createOptions: this.getNodeParameter('createOptions', itemIndex, {}) as IDataObject,
			});
			return [await peopleApiRequest.call(this, itemIndex, 'POST', '/desearch/monitors', { body })];
		}
		case 'estimate': {
			const body = buildEstimateBody(this.getNode(), itemIndex, {
				sources: this.getNodeParameter('sources', itemIndex, []),
				interval: this.getNodeParameter('interval', itemIndex, '1d'),
				estimateOptions: this.getNodeParameter('estimateOptions', itemIndex, {}) as IDataObject,
			});
			return [
				await peopleApiRequest.call(this, itemIndex, 'POST', '/desearch/monitors/estimate', {
					body,
				}),
			];
		}
		case 'getAll':
			return await collectPages.call(
				this,
				itemIndex,
				'/desearch/monitors',
				buildListMonitorsQuery(
					this.getNodeParameter('monitorFilters', itemIndex, {}) as IDataObject,
				),
				{
					listProperty: 'monitors',
					maxPageSize: MONITOR_PAGE_SIZE.monitors,
					limit: resultLimit.call(this, itemIndex),
					hasMorePages: () => true,
				},
			);
		case 'get':
			return [
				await peopleApiRequest.call(
					this,
					itemIndex,
					'GET',
					monitorPath(idParameter.call(this, itemIndex, 'monitorId')),
				),
			];
		case 'update': {
			const monitorId = idParameter.call(this, itemIndex, 'monitorId');
			const fields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
			const current = updateNeedsCurrent(fields)
				? await peopleApiRequest.call(this, itemIndex, 'GET', monitorPath(monitorId))
				: {};
			const body = buildUpdateMonitorBody(this.getNode(), itemIndex, fields, current);
			return [
				await peopleApiRequest.call(this, itemIndex, 'PATCH', monitorPath(monitorId), { body }),
			];
		}
		case 'delete':
		case 'trigger':
		case 'testWebhook':
		case 'rotateWebhookSecret': {
			const monitorId = idParameter.call(this, itemIndex, 'monitorId');
			const route = {
				delete: { method: 'DELETE', suffix: '' },
				trigger: { method: 'POST', suffix: '/trigger' },
				testWebhook: { method: 'POST', suffix: '/webhook/test' },
				rotateWebhookSecret: { method: 'POST', suffix: '/webhook/rotate-secret' },
			}[operation] as { method: 'DELETE' | 'POST'; suffix: string };
			return [
				await peopleApiRequest.call(
					this,
					itemIndex,
					route.method,
					monitorPath(monitorId, route.suffix),
				),
			];
		}
	}
	return undefined;
}

async function runOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject[] | undefined> {
	const monitorId = idParameter.call(this, itemIndex, 'monitorId');
	switch (operation) {
		case 'get': {
			const runId = idParameter.call(this, itemIndex, 'runId');
			const run =
				this.getNodeParameter('waitForCompletion', itemIndex, false) === true
					? await waitForMonitorRun.call(
							this,
							itemIndex,
							monitorId,
							runId,
							this.getNodeParameter('timeout', itemIndex, 300) as number,
							this.getNodeParameter('pollInterval', itemIndex, 10) as number,
						)
					: await peopleApiRequest.call(this, itemIndex, 'GET', monitorRunPath(monitorId, runId));
			if (this.getNodeParameter('output', itemIndex, 'run') === 'items') {
				return Array.isArray(run.items) ? (run.items as IDataObject[]) : [];
			}
			return [run];
		}
		case 'getAll':
			return await collectPages.call(
				this,
				itemIndex,
				monitorPath(monitorId, '/runs'),
				{},
				{
					listProperty: 'runs',
					maxPageSize: MONITOR_PAGE_SIZE.runs,
					limit: resultLimit.call(this, itemIndex),
					hasMorePages: () => true,
				},
			);
	}
	return undefined;
}

async function itemOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<IDataObject[] | undefined> {
	if (operation !== 'getAll') {
		return undefined;
	}
	const monitorId = idParameter.call(this, itemIndex, 'monitorId');
	const filters = this.getNodeParameter('itemFilters', itemIndex, {}) as IDataObject;
	return await collectPages.call(
		this,
		itemIndex,
		monitorPath(monitorId, '/items'),
		{ source: filters.source },
		{
			listProperty: 'items',
			maxPageSize: MONITOR_PAGE_SIZE.items,
			limit: resultLimit.call(this, itemIndex),
			hasMorePages: () => true,
		},
	);
}

const RESOURCE_OPERATIONS: Record<
	string,
	(
		this: IExecuteFunctions,
		operation: string,
		itemIndex: number,
	) => Promise<IDataObject[] | undefined>
> = {
	monitor: monitorOperation,
	run: runOperation,
	item: itemOperation,
};

export class DesearchMonitors implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Desearch Monitors',
		name: 'desearchMonitors',
		icon: { light: 'file:../../icons/desearch.svg', dark: 'file:../../icons/desearch.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Searches over the web, X, Reddit, YouTube, Threads, TikTok, Instagram, Facebook and Meta ads that run on a schedule and keep only what is new',
		defaults: {
			name: 'Desearch Monitors',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'desearchApi', required: true }],
		properties: monitorsProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const results = await RESOURCE_OPERATIONS[resource]?.call(this, operation, itemIndex);
				if (results === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex },
					);
				}
				for (const json of results) {
					returnData.push({ json, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				const nodeError = asNodeError(this.getNode(), error, itemIndex);
				if (this.continueOnFail()) {
					const json: IDataObject = { error: nodeError.message };
					if (nodeError.description) {
						json.description = nodeError.description;
					}
					returnData.push({ json, pairedItem: { item: itemIndex } });
					continue;
				}
				throw nodeError;
			}
		}

		return [returnData];
	}
}
