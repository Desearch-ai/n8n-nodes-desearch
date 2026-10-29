import {
	NodeConnectionTypes,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { asNodeError } from '../shared/transport';
import { runDesearchOperation } from './GenericFunctions';
import { searchFields, searchOperations } from './descriptions/SearchDescription';
import {
	facebookOperations,
	instagramOperations,
	socialFields,
	tiktokOperations,
} from './descriptions/SocialDescription';
import { webPageFields, webPageOperations } from './descriptions/WebPageDescription';
import { xFields, xOperations } from './descriptions/XDescription';

/**
 * Workflows saved before 0.3.0 have no `resource`: the default, `search`, holds
 * AI Search, Web Search and X Search with the parameters they had then.
 */
const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Facebook',
			value: 'facebook',
			description: 'Public pages, posts and comments, and Meta Ad Library records',
		},
		{
			name: 'Instagram',
			value: 'instagram',
			description: 'Public profiles, posts and comments',
		},
		{
			name: 'Search',
			value: 'search',
			description: 'Search the web and X for a query or prompt',
		},
		{
			name: 'TikTok',
			value: 'tiktok',
			description: 'Public videos, profiles and comments',
		},
		{
			name: 'Web Page',
			value: 'webPage',
			description: 'The content of a public web page',
		},
		{
			name: 'X',
			value: 'x',
			description: 'Posts, replies, users and trends on X',
		},
	],
	default: 'search',
};

export class Desearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Desearch',
		name: 'desearch',
		icon: { light: 'file:../../icons/desearch.svg', dark: 'file:../../icons/desearch.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'AI search, web search, X, TikTok, Facebook and Instagram data for AI agents',
		defaults: {
			name: 'Desearch',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'desearchApi', required: true }],
		properties: [
			resourceProperty,
			searchOperations,
			webPageOperations,
			xOperations,
			tiktokOperations,
			facebookOperations,
			instagramOperations,
			...searchFields,
			...webPageFields,
			...xFields,
			...socialFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const results = await runDesearchOperation.call(this, resource, operation, itemIndex);
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
