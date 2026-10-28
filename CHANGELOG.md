# Changelog

## 0.3.0

- The **Desearch** node now uses resources: **Search**, **Web Page**, **X**, **TikTok**, **Facebook** and **Instagram**. Existing workflows keep working unchanged: AI Search, Web Search and X Search sit under the default Search resource with the same parameters, and send the same requests (a test replays the 0.2.0 routing to prove it). The node version stays 1.
- Search: **AI Web Links Search** (`POST /desearch/ai/search/links/web`), **AI X Links Search** (`POST /desearch/ai/search/links/twitter`) and **Search API**, ranked pages with the best passage (`POST /search`).
- Web Page: **Extract** (`GET /web/extract`), text or HTML, optionally rendering JavaScript. The deprecated `/web/crawl` is not added.
- X: **Get Post**, **Get Posts by URLs**, **Search User Posts**, **Get Retweeters**, **Get User Posts**, **Get User Replies**, **Get Post Replies** and **Get Trends**. Get Retweeters and Get User Posts take a **Cursor** (`next_cursor`).
- TikTok (7 operations), Facebook (6) and Instagram (6): search, posts, profiles, profile posts, comments, hashtags and TikTok trending. List operations output one item per page, `{ results, nextCursor }`, with the cursor from the `x-desearch-next-cursor` header (null on the last page); put it in **Cursor** to get the next page. Path values are URL-encoded, so an Instagram post URL works as a post ID.
- The Desearch node now runs requests itself instead of through declarative routing, so API errors show the reason the API gives, and **Continue On Fail** outputs `error` and `description`.
- **Desearch People Search**: **Search > Export Results** (`GET /desearch/people/tasks/{task_id}/export`, optionally waiting for the search) and **Profile > Export** (`GET /desearch/people/profiles/export`) return the people as a CSV or JSON Lines file in n8n binary data. Exports are free.
- `scripts/e2e-full-coverage.mts`: smoke test of every new operation against the live API (`npm run e2e`, needs `DESEARCH_API_KEY`).

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
