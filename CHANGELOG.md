# Changelog

## 0.5.0

- **Desearch Company Search > Company Search > Start** has two new options (Desearch-ai/desearch-public-api#624):
  - **Search Budget (USD)** (`max_cost_usd`, up to 100, at least Count times the price). It reserves the whole budget, and the search keeps going until it delivers Count or spends the budget instead of stopping at `cost_limit`. Its search effort is charged where the companies delivered do not cover it, even when it finds few companies or none.
  - **Continue From Task ID** (`continue_from`): the ID of an ended Company Search. The new search leaves out every company that one excluded, delivered or held for review, so it only finds new ones.
  - Both are sent only when set.
- The Query description shows how to restrict a search to named companies with their websites ("Restrict this search to Acme (acme.com.au) and Beta (beta.co.uk). Return only those."). The Count and Cancel descriptions mention the budget's effort charge.

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
