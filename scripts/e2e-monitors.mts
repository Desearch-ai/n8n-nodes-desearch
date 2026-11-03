// End-to-end smoke test of the Desearch Monitors node, against a live Desearch API.
//
// It runs the built node's execute() (dist/, so build first) with the same minimal
// IExecuteFunctions the unit tests use (test/context.ts); only HTTP is real here. It estimates a
// monitor, creates one with run_now off, reads, lists, updates (rename, pause, a per-source option,
// webhook events), lists its runs and items, sends a test webhook event, rotates the secret and
// deletes it, then checks that the deleted monitor is a 404. A second monitor watches accounts on
// X, Reddit, YouTube and TikTok: it checks that the API returns their names cleaned, that an Update
// keeps the accounts it does not change, that an empty field stops watching, and that a bad name is
// a 422. On an API without the TikTok source and watched accounts, that part prints SKIP. One line
// per call: `PASS name`, `FAIL name: error` or `SKIP name: reason`. The script exits with 1 when any
// call fails, and always deletes the monitors it created.
//
// Free: every Monitors route is free, and the monitor never runs (run_now off, paused, and Trigger
// Run is not called). The test webhook goes to https://example.com, which does not answer it with
// a 2xx, so only the shape of the result is checked.
//
// The key is read from the environment variable --key-env names (default DESEARCH_API_KEY), or from
// ~/.config/desearch/e2e.env when the environment does not set it. It is never printed. The node
// always calls https://api.desearch.ai; --base-url sends those requests to another deployment.
//
// Usage (Node.js 22.18 or later, which runs TypeScript directly):
//   npm run build
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e-monitors.mts \
//     [--base-url https://api-dev.desearch.ai] [--key-env DESEARCH_DEV_API_KEY]
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
	IDataObject,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
	INodeParameters,
	INodeType,
} from 'n8n-workflow';

import { createNodeExecuteContext } from '../test/context.ts';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url);
const NODE_API_URL = 'https://api.desearch.ai';

function option(name: string, fallback: string): string {
	const index = process.argv.indexOf(name);
	return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const baseUrl = option('--base-url', NODE_API_URL).replace(/\/+$/, '');
const keyEnv = option('--key-env', 'DESEARCH_API_KEY');

function loadEnvFile() {
	const path = join(homedir(), '.config', 'desearch', 'e2e.env');
	if (!existsSync(path)) return;
	for (const raw of readFileSync(path, 'utf8').split('\n')) {
		const entry = raw.trim();
		if (!entry || entry.startsWith('#') || !entry.includes('=')) continue;
		const [key, ...rest] = entry.split('=');
		const value = rest.join('=');
		if (value && !process.env[key]) process.env[key] = value;
	}
}

loadEnvFile();
const apiKey = process.env[keyEnv]?.trim();
if (!apiKey) {
	process.stderr.write(`Set ${keyEnv} (or add it to ~/.config/desearch/e2e.env).\n`);
	process.exit(2);
}

const distNode = fileURLToPath(
	new URL('dist/nodes/DesearchMonitors/DesearchMonitors.node.js', root),
);
if (!existsSync(distNode)) {
	process.stderr.write('dist/ is missing: run `npm run build` first.\n');
	process.exit(2);
}

// The CommonJS build, as n8n loads it.
const { NodeHelpers } = require('n8n-workflow') as typeof import('n8n-workflow');
const { DesearchMonitors } = require(distNode) as { DesearchMonitors: new () => INodeType };
const monitorsNode = new DesearchMonitors();

const nodeData: INode = {
	id: 'e2e-desearch-monitors',
	name: 'Desearch Monitors',
	type: 'n8n-nodes-desearch.desearchMonitors',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const totals = { pass: 0, fail: 0, skip: 0, requests: 0 };
const line = (text: string) =>
	process.stdout.write(`${text.split(apiKey as string).join('***')}\n`);

/** helpers.httpRequestWithAuthentication for the Desearch API credential, over fetch. */
async function httpRequestWithAuthentication(
	credentialType: string,
	options: IHttpRequestOptions,
): Promise<unknown> {
	if (credentialType !== 'desearchApi') {
		throw new Error(`Unexpected credential type ${credentialType}`);
	}
	if (!options.url.startsWith(NODE_API_URL)) {
		throw new Error(`Unexpected URL ${options.url}`);
	}
	const url = new URL(`${baseUrl}${options.url.slice(NODE_API_URL.length)}`);
	for (const [key, value] of Object.entries(options.qs ?? {})) {
		if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
	}
	const headers = new Headers();
	for (const [key, value] of Object.entries(options.headers ?? {})) {
		headers.set(key, String(value));
	}
	// The credential sends the key as is in the Authorization header.
	headers.set('Authorization', apiKey as string);

	const method = options.method ?? 'GET';
	const init: RequestInit = { method, headers, signal: AbortSignal.timeout(60_000) };
	if (options.body !== undefined && method !== 'GET') {
		init.body = JSON.stringify(options.body);
	}

	const reply = await fetch(url, init);
	totals.requests++;
	const replyHeaders: IDataObject = {};
	reply.headers.forEach((value, key) => {
		replyHeaders[key] = value;
	});
	const text = await reply.text();
	let body: unknown;
	try {
		body = text === '' ? undefined : JSON.parse(text);
	} catch {
		body = text;
	}
	return { body, headers: replyHeaders, statusCode: reply.status, statusMessage: reply.statusText };
}

function describeError(error: unknown): string {
	const { message, description, httpCode } = (error ?? {}) as {
		message?: string;
		description?: string;
		httpCode?: string;
	};
	const text = message ?? String(error);
	const parts = [httpCode ? `HTTP ${httpCode}` : '', text, description !== text ? description : ''];
	return parts.filter(Boolean).join(': ');
}

/** Runs one operation through execute(), with defaults filled in as n8n does. */
async function execute(parameters: INodeParameters): Promise<INodeExecutionData[]> {
	const { description } = monitorsNode;
	const resolved =
		NodeHelpers.getNodeParameters(
			description.properties,
			parameters,
			true,
			false,
			null,
			description,
		) ?? {};
	const context = createNodeExecuteContext({
		node: nodeData,
		parameters: [resolved],
		httpRequestWithAuthentication,
	});
	const [items] = (await monitorsNode.execute!.call(context)) as INodeExecutionData[][];
	return items;
}

type Check = (items: IDataObject[]) => string | undefined;

/** Runs one operation and prints PASS or FAIL. Returns the output JSON, or undefined on failure. */
async function call(
	name: string,
	parameters: INodeParameters,
	check: Check,
	detail: (items: IDataObject[]) => string = () => '',
): Promise<IDataObject[] | undefined> {
	try {
		const items = (await execute(parameters)).map((item) => item.json);
		const problem = check(items);
		if (problem) {
			totals.fail++;
			line(`FAIL ${name}: ${problem}`);
			return undefined;
		}
		totals.pass++;
		const extra = detail(items);
		line(`PASS ${name}${extra ? ` (${extra})` : ''}`);
		return items;
	} catch (error) {
		totals.fail++;
		line(`FAIL ${name}: ${describeError(error)}`);
		return undefined;
	}
}

/** Runs one operation that must fail with HTTP `httpCode`; prints PASS or FAIL. */
async function expectHttpError(name: string, parameters: INodeParameters, httpCode: string) {
	try {
		await execute(parameters);
	} catch (error) {
		if ((error as { httpCode?: string }).httpCode === httpCode) {
			totals.pass++;
			line(`PASS ${name}`);
		} else {
			totals.fail++;
			line(`FAIL ${name}: ${describeError(error)}`);
		}
		return;
	}
	totals.fail++;
	line(`FAIL ${name}: expected HTTP ${httpCode}, got a success`);
}

/** One output item for which `test` returns no problem. */
const one =
	(test: (item: IDataObject) => string | undefined): Check =>
	(items) =>
		items.length === 1 ? test(items[0]) : `expected 1 item, got ${items.length}`;

const WEBHOOK_URL = 'https://example.com/desearch-e2e';

async function run(): Promise<void> {
	await call(
		'monitor.estimate',
		{ operation: 'estimate', sources: ['x'], interval: '7d', estimateOptions: { xCount: 20 } },
		one((item) =>
			typeof item.max_run_cost_usd === 'number' && typeof item.runs_per_month === 'number'
				? undefined
				: 'no max_run_cost_usd or runs_per_month',
		),
		(items) => `max $${items[0].max_run_cost_usd} a run, ${items[0].runs_per_month} runs a month`,
	);

	const created = await call(
		'monitor.create',
		{
			operation: 'create',
			query: 'Bittensor subnet launches and updates',
			sources: ['x'],
			interval: '7d',
			createOptions: {
				name: `n8n e2e ${new Date().toISOString()}`,
				criteria: 'Announces a new subnet, release or partnership',
				xLang: 'en',
				webhookUrl: WEBHOOK_URL,
				metadata: { label: [{ key: 'e2e', value: 'n8n' }] },
				runNow: false,
			},
		},
		one((item) => {
			if (typeof item.monitor_id !== 'string') return 'no monitor_id';
			if (!String(item.webhook_secret ?? '').startsWith('whsec_')) return 'no webhook_secret';
			return item.next_run_at === undefined ? 'no next_run_at' : undefined;
		}),
		(items) => String(items[0].monitor_id),
	);
	if (!created) return;
	const monitorId = String(created[0].monitor_id);
	const firstSecret = String(created[0].webhook_secret);
	const monitor = (parameters: INodeParameters) => ({ monitorId, ...parameters });

	try {
		await call(
			'monitor.get',
			monitor({ operation: 'get' }),
			one((item) =>
				item.monitor_id === monitorId &&
				item.status === 'active' &&
				item.webhook_secret === undefined
					? undefined
					: `unexpected monitor ${JSON.stringify(item).slice(0, 200)}`,
			),
		);
		await call(
			'monitor.getAll',
			{ operation: 'getAll', returnAll: true },
			(items) =>
				items.some((item) => item.monitor_id === monitorId)
					? undefined
					: 'the new monitor is missing',
			(items) => `${items.length} monitors`,
		);
		await call(
			'monitor.update (rename, pause)',
			monitor({ operation: 'update', updateFields: { name: 'n8n e2e renamed', status: 'paused' } }),
			one((item) =>
				item.name === 'n8n e2e renamed' && item.status === 'paused' && item.paused_reason === 'user'
					? undefined
					: `got name ${String(item.name)}, status ${String(item.status)}, paused_reason ${String(item.paused_reason)}`,
			),
		);
		await call(
			'monitor.getAll (status paused)',
			{ operation: 'getAll', returnAll: true, monitorFilters: { status: ['paused'] } },
			(items) =>
				items.every((item) => item.status === 'paused') &&
				items.some((item) => item.monitor_id === monitorId)
					? undefined
					: 'the filter returned an active monitor or missed this one',
			(items) => `${items.length} paused`,
		);
		await call(
			'monitor.update (X posts per run keeps X language)',
			monitor({ operation: 'update', updateFields: { xCount: 30 } }),
			one((item) => {
				const x = ((item.options ?? {}) as IDataObject).x as IDataObject | undefined;
				return x?.count === 30 && x?.lang === 'en'
					? undefined
					: `options.x is ${JSON.stringify(x)}`;
			}),
		);
		await call(
			'monitor.update (webhook events keep the URL and secret)',
			monitor({
				operation: 'update',
				updateFields: { webhookEvents: ['monitor.run.completed', 'monitor.run.failed'] },
			}),
			one((item) => {
				const webhook = (item.webhook ?? {}) as IDataObject;
				if (webhook.url !== WEBHOOK_URL) return `webhook.url is ${String(webhook.url)}`;
				if (JSON.stringify(webhook.events) !== '["monitor.run.completed","monitor.run.failed"]') {
					return `webhook.events is ${JSON.stringify(webhook.events)}`;
				}
				return item.webhook_secret === undefined ? undefined : 'the secret changed';
			}),
		);
		await call(
			'run.getAll',
			{ resource: 'run', operation: 'getAll', monitorId, returnAll: true },
			() => undefined,
			(items) => `${items.length} runs`,
		);
		await call(
			'item.getAll (source x)',
			{ resource: 'item', operation: 'getAll', monitorId, itemFilters: { source: 'x' } },
			() => undefined,
			(items) => `${items.length} items`,
		);
		await expectHttpError(
			'run.get (unknown run is a 404)',
			{
				resource: 'run',
				operation: 'get',
				monitorId,
				runId: '00000000-0000-4000-8000-000000000000',
			},
			'404',
		);
		await call(
			'monitor.testWebhook',
			monitor({ operation: 'testWebhook' }),
			one((item) =>
				typeof item.delivered === 'boolean' && typeof item.duration_ms === 'number'
					? undefined
					: `unexpected result ${JSON.stringify(item)}`,
			),
			(items) => `delivered ${String(items[0].delivered)}, status ${String(items[0].status_code)}`,
		);
		await call(
			'monitor.rotateWebhookSecret',
			monitor({ operation: 'rotateWebhookSecret' }),
			one((item) => {
				const secret = String(item.webhook_secret ?? '');
				if (!secret.startsWith('whsec_')) return 'no webhook_secret';
				return secret === firstSecret ? 'the secret did not change' : undefined;
			}),
		);
	} finally {
		await call(
			'monitor.delete',
			monitor({ operation: 'delete' }),
			one((item) => (item.deleted === true ? undefined : 'not deleted')),
		);
	}
	await expectHttpError('monitor.get (deleted is a 404)', monitor({ operation: 'get' }), '404');
}

/** Whether `error` says the API does not know the TikTok source or watched accounts (422). */
const withoutAccounts = (error: unknown) => (error as { httpCode?: string }).httpCode === '422';

async function accounts(): Promise<void> {
	const estimate = {
		operation: 'estimate',
		sources: ['x', 'reddit', 'youtube', 'tiktok'],
		interval: '1d',
		estimateOptions: {
			xAccounts: '@OpenAI, AnthropicAI',
			tiktokAccounts: '@openai',
			tiktokCount: 20,
		},
	};
	try {
		const [item] = (await execute(estimate)).map((output) => output.json);
		if (typeof item.max_run_cost_usd !== 'number') throw new Error('no max_run_cost_usd');
		totals.pass++;
		line(`PASS monitor.estimate (TikTok, watched accounts) (max $${item.max_run_cost_usd} a run)`);
	} catch (error) {
		if (withoutAccounts(error)) {
			totals.skip++;
			line(
				`SKIP TikTok and watched accounts: this API does not take them (${describeError(error)})`,
			);
			return;
		}
		totals.fail++;
		line(`FAIL monitor.estimate (TikTok, watched accounts): ${describeError(error)}`);
		return;
	}
	await expectHttpError(
		'monitor.estimate (a bad X username is a 422)',
		{ ...estimate, estimateOptions: { xAccounts: 'not a username!' } },
		'422',
	);

	let monitorId: string | undefined;
	try {
		const [item] = (
			await execute({
				operation: 'create',
				query: 'OpenAI announcements',
				sources: ['x', 'reddit', 'youtube', 'tiktok'],
				interval: '7d',
				createOptions: {
					name: `n8n e2e accounts ${new Date().toISOString()}`,
					minScore: 0,
					xAccounts: '@OpenAI, https://x.com/AnthropicAI',
					xLang: 'en',
					redditSubreddits: 'r/LocalLLaMA',
					youtubeChannels: 'https://www.youtube.com/@OpenAI',
					tiktokAccounts: '@openai',
					tiktokCount: 20,
					runNow: false,
				},
			})
		).map((output) => output.json);
		monitorId = String(item.monitor_id);
		const options = JSON.stringify(item.options);
		const expected = JSON.stringify({
			x: { count: 20, lang: 'en', accounts: ['OpenAI', 'AnthropicAI'] },
			reddit: { subreddits: ['LocalLLaMA'] },
			youtube: { channels: ['@OpenAI'] },
			tiktok: { count: 20, accounts: ['openai'] },
		});
		// Key order is not part of the contract, at any depth (the API returns x as lang, count, accounts).
		const sortKeys = (value: unknown): unknown =>
			value && typeof value === 'object' && !Array.isArray(value)
				? Object.fromEntries(
						Object.entries(value as IDataObject)
							.sort(([a], [b]) => a.localeCompare(b))
							.map(([key, entry]) => [key, sortKeys(entry)]),
					)
				: value;
		const sorted = (text: string) => JSON.stringify(sortKeys(JSON.parse(text)));
		if (sorted(options) !== sorted(expected)) {
			totals.fail++;
			line(`FAIL monitor.create (TikTok, watched accounts): options are ${options}`);
		} else {
			totals.pass++;
			line(`PASS monitor.create (TikTok, watched accounts) (names cleaned: ${options})`);
		}
	} catch (error) {
		totals.skip++;
		line(`SKIP monitor.create (TikTok, watched accounts): ${describeError(error)}`);
		return;
	}

	const monitor = (parameters: INodeParameters) => ({ monitorId, ...parameters });
	try {
		await call(
			'monitor.update (TikTok posts per run keeps every account)',
			monitor({ operation: 'update', updateFields: { tiktokCount: 30 } }),
			one((item) => {
				const options = (item.options ?? {}) as Record<string, IDataObject>;
				if (JSON.stringify(options.tiktok) !== '{"count":30,"accounts":["openai"]}') {
					return `options.tiktok is ${JSON.stringify(options.tiktok)}`;
				}
				return JSON.stringify(options.x?.accounts) === '["OpenAI","AnthropicAI"]'
					? undefined
					: `options.x is ${JSON.stringify(options.x)}`;
			}),
		);
		await call(
			'monitor.update (empty Reddit Subreddits stops watching)',
			monitor({ operation: 'update', updateFields: { redditSubreddits: '' } }),
			one((item) => {
				const reddit = ((item.options ?? {}) as Record<string, IDataObject>).reddit;
				return ((reddit?.subreddits as unknown[] | undefined) ?? []).length === 0
					? undefined
					: `options.reddit is ${JSON.stringify(reddit)}`;
			}),
		);
		await call(
			'item.getAll (source tiktok)',
			{ resource: 'item', operation: 'getAll', monitorId, itemFilters: { source: 'tiktok' } },
			() => undefined,
			(items) => `${items.length} items`,
		);
	} finally {
		await call(
			'monitor.delete (accounts)',
			monitor({ operation: 'delete' }),
			one((item) => (item.deleted === true ? undefined : 'not deleted')),
		);
	}
}

line(`Base URL: ${baseUrl}`);
await run();
await accounts();
line(`${totals.requests} requests (Monitors routes are free)`);
line(`${totals.pass} passed, ${totals.fail} failed, ${totals.skip} skipped`);
process.exit(totals.fail > 0 ? 1 : 0);
