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
	MAX_PAGE_SIZE,
	asNodeError,
	buildListProfilesQuery,
	buildListTasksQuery,
	buildStartSearchRequest,
	collectPages,
	peopleApiRequest,
	taskPath,
	waitForTask,
} from './GenericFunctions';
import { peopleSearchProperties } from './PeopleSearchDescription';

/** Max entries to return: Infinity when Return All is on. */
function resultLimit(
	this: IExecuteFunctions,
	itemIndex: number,
	returnAllDefault: boolean,
): number {
	if (this.getNodeParameter('returnAll', itemIndex, returnAllDefault) === true) {
		return Number.POSITIVE_INFINITY;
	}
	return Math.max(1, Number(this.getNodeParameter('limit', itemIndex, 50)) || 50);
}

function taskIdParameter(this: IExecuteFunctions, itemIndex: number): string {
	const taskId = String(this.getNodeParameter('taskId', itemIndex, '')).trim();
	if (taskId === '') {
		throw new NodeOperationError(this.getNode(), 'Task ID is empty', {
			itemIndex,
			description: 'Use the task_id that Start returned.',
		});
	}
	return taskId;
}

async function runOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	if (resource === 'search') {
		switch (operation) {
			case 'start': {
				const { path, body, headers } = buildStartSearchRequest(this.getNode(), itemIndex, {
					platform: this.getNodeParameter('platform', itemIndex),
					query: this.getNodeParameter('query', itemIndex, ''),
					count: this.getNodeParameter('count', itemIndex, 25),
					searchOptions: this.getNodeParameter('searchOptions', itemIndex, {}) as IDataObject,
					searchFilters: this.getNodeParameter('searchFilters', itemIndex, {}) as IDataObject,
				});
				return [await peopleApiRequest.call(this, itemIndex, 'POST', path, { body, headers })];
			}
			case 'get':
				return [
					await peopleApiRequest.call(
						this,
						itemIndex,
						'GET',
						taskPath(taskIdParameter.call(this, itemIndex)),
					),
				];
			case 'pause':
			case 'resume':
			case 'cancel':
				return [
					await peopleApiRequest.call(
						this,
						itemIndex,
						'POST',
						taskPath(taskIdParameter.call(this, itemIndex), `/${operation}`),
					),
				];
			case 'getResults': {
				const taskId = taskIdParameter.call(this, itemIndex);
				if (this.getNodeParameter('waitForCompletion', itemIndex, true) === true) {
					await waitForTask.call(
						this,
						itemIndex,
						taskId,
						this.getNodeParameter('timeout', itemIndex, 600) as number,
						this.getNodeParameter('pollInterval', itemIndex, 15) as number,
					);
				}
				return await collectPages.call(
					this,
					itemIndex,
					taskPath(taskId, '/results'),
					{},
					{
						listProperty: 'results',
						maxPageSize: MAX_PAGE_SIZE.results,
						limit: resultLimit.call(this, itemIndex, true),
						hasMorePages: (page) => page.has_more === true,
					},
				);
			}
			case 'getAll':
				return await collectPages.call(
					this,
					itemIndex,
					'/desearch/people/tasks',
					buildListTasksQuery(this.getNodeParameter('taskFilters', itemIndex, {}) as IDataObject),
					{
						listProperty: 'tasks',
						maxPageSize: MAX_PAGE_SIZE.tasks,
						limit: resultLimit.call(this, itemIndex, false),
						hasMorePages: () => true,
					},
				);
		}
	}

	if (resource === 'profile' && operation === 'getAll') {
		return await collectPages.call(
			this,
			itemIndex,
			'/desearch/people/profiles',
			buildListProfilesQuery(
				this.getNodeParameter('platform', itemIndex) as string,
				this.getNodeParameter('sortBy', itemIndex, 'score') as string,
				this.getNodeParameter('profileFilters', itemIndex, {}) as IDataObject,
			),
			{
				listProperty: 'profiles',
				maxPageSize: MAX_PAGE_SIZE.profiles,
				limit: resultLimit.call(this, itemIndex, false),
				hasMorePages: () => true,
			},
		);
	}

	throw new NodeOperationError(
		this.getNode(),
		`The operation "${operation}" is not supported for "${resource}"`,
		{ itemIndex },
	);
}

export class DesearchPeopleSearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Desearch People Search',
		name: 'desearchPeopleSearch',
		icon: { light: 'file:../../icons/desearch.svg', dark: 'file:../../icons/desearch.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Find people on X, YouTube, LinkedIn and TikTok by describing them',
		defaults: {
			name: 'Desearch People Search',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'desearchApi', required: true }],
		properties: peopleSearchProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const results = await runOperation.call(this, resource, operation, itemIndex);
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
