import { NodeOperationError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import {
	COMPANY_REQUIREMENTS,
	COMPANY_ROLES,
	buildListCompanyTasksQuery,
	buildStartCompanyEnrichRequest,
	buildStartCompanySearchRequest,
	companyTaskPath,
	isCompanyTaskType,
	metadataLabels,
} from '../nodes/DesearchCompanySearch/GenericFunctions';
import { companyNode, node } from './helpers';

describe('companyTaskPath', () => {
	it('encodes the task ID', () => {
		expect(companyTaskPath('0c9f3a52-7d1e-4f0a-9a3b-2b8e6f1d4c77', '/cancel')).toBe(
			'/desearch/companies/tasks/0c9f3a52-7d1e-4f0a-9a3b-2b8e6f1d4c77/cancel',
		);
		expect(companyTaskPath('a/../b?c')).toBe('/desearch/companies/tasks/a%2F..%2Fb%3Fc');
	});
});

describe('isCompanyTaskType', () => {
	it('accepts only search and enrich', () => {
		expect(isCompanyTaskType('search')).toBe(true);
		expect(isCompanyTaskType('enrich')).toBe(true);
		expect(isCompanyTaskType('profile')).toBe(false);
	});
});

describe('metadataLabels', () => {
	it('builds an object from the fixed collection, trimming keys and skipping empty ones', () => {
		expect(
			metadataLabels({
				label: [
					{ key: ' campaign ', value: 'q4' },
					{ key: '', value: 'x' },
					{ key: 'owner', value: 7 },
				],
			}),
		).toEqual({ campaign: 'q4', owner: '7' });
	});

	it('is undefined when there are no labels', () => {
		expect(metadataLabels(undefined)).toBeUndefined();
		expect(metadataLabels({})).toBeUndefined();
		expect(metadataLabels({ label: [{ key: ' ', value: 'x' }] })).toBeUndefined();
	});
});

describe('buildStartCompanySearchRequest', () => {
	it('dedupes require and roles and leaves out unset options', () => {
		const { path, body, headers } = buildStartCompanySearchRequest({
			query: 'Fintech startups',
			count: 10,
			searchFilters: { countries: '', require: ['email', 'email'] },
			searchOptions: { roles: ['ceo', 'ceo'], minScore: '' },
		});

		expect(path).toBe('/desearch/companies/search');
		expect(body).toEqual({
			query: 'Fintech startups',
			count: 10,
			filters: { require: ['email'] },
			roles: ['ceo'],
		});
		expect(headers).toEqual({});
	});

	it('keeps min_score 0', () => {
		const { body } = buildStartCompanySearchRequest({
			query: 'Fintech startups',
			count: 10,
			searchFilters: {},
			searchOptions: { minScore: 0 },
		});

		expect(body.min_score).toBe(0);
	});
});

describe('buildStartCompanyEnrichRequest', () => {
	it('accepts an array of domains', () => {
		const { path, body } = buildStartCompanyEnrichRequest(node, 0, {
			domains: [' acme.com ', '', 'beta.io'],
			enrichOptions: { inferEmails: true },
		});

		expect(path).toBe('/desearch/companies/enrich');
		expect(body).toEqual({ domains: ['acme.com', 'beta.io'], infer_emails: true });
	});

	it('throws a NodeOperationError for no domains', () => {
		expect(() =>
			buildStartCompanyEnrichRequest(node, 0, { domains: '', enrichOptions: {} }),
		).toThrow(NodeOperationError);
	});
});

describe('buildListCompanyTasksQuery', () => {
	it('always sends the type', () => {
		expect(buildListCompanyTasksQuery(node, 0, 'search', {})).toEqual({ type: 'search' });
	});
});

describe('node options match the API values', () => {
	const options = (parent: string, name: string) => {
		const collection = companyNode.description.properties.find((p) => p.name === parent);
		const property = (collection?.options as Array<{ name: string; options?: unknown }>).find(
			(p) => p.name === name,
		);
		return (property?.options as Array<{ value: string }>).map((o) => o.value).sort();
	};

	it('offers every role and requirement the API accepts', () => {
		expect(options('searchOptions', 'roles')).toEqual([...COMPANY_ROLES].sort());
		expect(options('enrichOptions', 'roles')).toEqual([...COMPANY_ROLES].sort());
		expect(options('searchFilters', 'require')).toEqual([...COMPANY_REQUIREMENTS].sort());
	});
});
