# Changelog

## 0.6.0

- New **Desearch Monitors** node (`/desearch/monitors/*`), with the same Desearch API credential. A monitor reruns a search over the web, X, Reddit, YouTube, Threads, TikTok, Instagram, Facebook and the Meta Ad Library every 1 hour to 7 days and keeps only new items that pass relevance screening. Every route is free; each run is billed for its searches, screening and optional summary.
- **Monitor** resource: Create, Estimate Cost, Get, Get Many (status filter), Update (any field, pause and resume, remove the webhook), Delete, Trigger Run, Test Webhook and Rotate Webhook Secret. Create takes the query, sources, interval, criteria (one per line, up to 5), min score, summary, per-source options (web pages per run; X posts per run, language and minimum likes), webhook URL and events, metadata labels and Run Now.
- Update keeps what it does not change: the API replaces the per-source options and the webhook as a whole, so changing one option, only the webhook URL or only its events reads the monitor first and sends the rest unchanged.
- **Run** resource: Get (optionally waiting until the run ends, and outputting one item per kept item) and Get Many. **Item** resource: Get Many, optionally from one source. Lists follow `next_cursor` with Return All and Limit.
- **TikTok** source and **watched accounts**: Sources and the Item source filter have TikTok, with TikTok Posts per Run (10, 20 or 30). X Accounts, Reddit Subreddits, YouTube Channels and TikTok Accounts (up to 10 each) make a source read those accounts' newest posts instead of searching; the query and criteria still decide what is kept. Names are sent as typed; the API cleans them. Estimate Cost takes the accounts too, and Update merges them into the monitor's options like the other per-source fields (set but empty stops watching). TikTok search has no working date filter and ranks by relevance, so a TikTok keyword monitor finds a new video only when it reaches TikTok's top results; to follow creators, watch their accounts.
- **Instagram**, **Facebook** and **Meta Ads** sources, and **Threads Accounts**: Sources and the Item source filter have Instagram, Facebook and Meta Ads. Instagram and Facebook only watch accounts, with **Instagram Accounts** and **Facebook Pages** (1 to 10 each); the API refuses either source without them (422, on Create and on Update). **Meta Ads** searches the Meta Ad Library by keyword, with **Meta Ads per Run** (10, 20 or 30); its query should be keywords such as a brand or product. **Threads Accounts** (up to 10) makes Threads read those accounts instead of its loosely matched keyword search. Estimate Cost takes them all, and Update merges them into the monitor's options like the other per-source fields. The field hints give the prices: $0.02484 an Instagram account, $0.0207 a Facebook page, $0.00207 a Threads account, $0.0207 for 10 Meta ads and $0.0621 for 30.
- Monitor output passes the webhook's delivery status through: `webhook.consecutive_failures` and `webhook.last_delivery` (null before the first delivery; `pending`, `delivered` or `failed` with attempts, status code, error and next attempt). Update sends only the webhook's URL and events back.
- `scripts/e2e-monitors.mts` (`npm run e2e:monitors`): free smoke test of every operation but Trigger Run against a live API, with `--base-url` and `--key-env`. Its TikTok and watched-accounts part, and its Instagram, Facebook, Meta Ads and Threads part (estimate breakdown, cleaned names, `last_delivery` null on a fresh webhook, the 422s without accounts on Create and Update, the item filter), print SKIP on an API without them. It deletes every monitor it creates, also when a check of the Create fails.

### Desearch node

- Facebook **Search Ad Library** has **Options > Sort** (`sort`): Impressions (most seen first, the API's default) or Recent (recently started ads first).

## 0.4.0

Full API coverage in the **Desearch** node, plus YouTube, Reddit and Threads. Company Search (0.3.0) is unchanged.

### Full API coverage

- The **Desearch** node now uses resources: **Search**, **Web Page**, **X**, **TikTok**, **Facebook** and **Instagram**. Existing workflows keep working unchanged: AI Search, Web Search and X Search sit under the default Search resource with the same parameters, and send the same requests (a test replays the 0.2.0 routing to prove it). The node version stays 1.
- Search: **AI Web Links Search** (`POST /desearch/ai/search/links/web`), **AI X Links Search** (`POST /desearch/ai/search/links/twitter`) and **Search API**, ranked pages with the best passage (`POST /search`).
- Web Page: **Extract** (`GET /web/extract`), text or HTML, optionally rendering JavaScript. The deprecated `/web/crawl` is not added.
- X: **Get Post**, **Get Posts by URLs**, **Search User Posts**, **Get Retweeters**, **Get User Posts**, **Get User Replies**, **Get Post Replies** and **Get Trends**. Get Retweeters and Get User Posts take a **Cursor** (`next_cursor`).
- TikTok (7 operations), Facebook (6) and Instagram (6): search, posts, profiles, profile posts, comments, hashtags and TikTok trending. List operations output one item per page, `{ results, nextCursor }`, with the cursor from the `x-desearch-next-cursor` header (null on the last page); put it in **Cursor** to get the next page. Path values are URL-encoded, so an Instagram post URL works as a post ID.
- The Desearch node now runs requests itself instead of through declarative routing, so API errors show the reason the API gives, and **Continue On Fail** outputs `error` and `description`.
- **Desearch People Search**: **Search > Export Results** (`GET /desearch/people/tasks/{task_id}/export`, optionally waiting for the search) and **Profile > Export** (`GET /desearch/people/profiles/export`) return the people as a CSV or JSON Lines file in n8n binary data. Exports are free.
- `scripts/e2e-full-coverage.mts`: smoke test of every operation added for full API coverage against the live API (`npm run e2e`, needs `DESEARCH_API_KEY`).

### YouTube, Reddit and Threads

- The **Desearch** node has three more resources: **YouTube** (Search, Get Video, Get Transcript, Get Comments, Get Channel, Get Channel Videos), **Reddit** (Search, Get Subreddit, Get Subreddit Posts, Get Post, Get Comments) and **Threads** (Search, Search Users, Get Profile, Get Profile Posts, Get Post): the 16 `/desearch/youtube`, `/desearch/reddit` and `/desearch/threads` routes.
- List operations output one item per page, `{ results, nextCursor }`, like TikTok, Facebook and Instagram. YouTube Search, Get Comments and Get Channel Videos and Reddit Search, Get Subreddit Posts and Get Comments take a **Cursor**; Threads operations do not page. These operations have no Count.
- Filters are in **Options**: YouTube search type, upload date, sort and duration; comment order; channel video sort; transcript language; Reddit sort and timeframe; Threads start and end dates (sent as UTC days).
- Video, post and channel values are URL-encoded, so a YouTube, Reddit or Threads URL works as an ID; `r/` is dropped from subreddit names.
- `scripts/e2e-youtube-reddit-threads.mts` (`npm run e2e:yrt`): smoke test of the new operations against a live API, with `--base-url` and `--key-env`.

## 0.3.0

- New **Desearch Company Search** node (`/desearch/companies/*`), with the same Desearch API credential. **Company Search** resource finds companies from a plain-language description; **Company Enrich** resource collects the same data for 1 to 200 domains you send. Both have Start, Get Results, Get, Get Many, Pause, Resume and Cancel.
- Start takes the leaders to find (roles), whether to infer and check emails, metadata labels and an Idempotency Key; Company Search also takes Count, countries, Must Have (email, phone, company LinkedIn page, leader, leader with email), Min Score and domains to exclude.
- Get Results can wait until a task finishes, so every company comes back in its final version (Timeout, Poll Interval), and returns every page, one item per company. Get Many lists the resource's task type, filtered by status and metadata labels.
- The Desearch and Desearch People Search nodes are unchanged.

## 0.2.0

- New **Desearch People Search** node for X, YouTube, LinkedIn and TikTok (`/desearch/people/*`), with the same Desearch API credential. Search resource: Start, Get Results, Get, Get Many, Pause, Resume, Cancel. Profile resource: Get Many.
- Get Results can wait until a search finishes (Timeout, Poll Interval) and returns every page, one item per person. Get Many supports Return All and Limit; Profile > Get Many has the result filters (has email, website or social links, audience, fit score, location, verified) and sorting.
- People Search errors show the reason the API gives, for example not enough credits or why a search cannot be paused.
- The Desearch node (AI Search, Web Search, X Search) is unchanged.
- Unit tests with Vitest (`npm test`), run in CI.

## 0.1.1

- Credential test checks the API key without running a billed search.
- Package no longer ships `dist/tsconfig.tsbuildinfo`.
- Node and credential icons use the live Desearch mark (light and dark).
- Publish workflow: tag `v*` runs lint and build, then publishes to npm with provenance through npm trusted publishing (no token).

## 0.1.0

- AI Search, Web Search and X Search operations.
