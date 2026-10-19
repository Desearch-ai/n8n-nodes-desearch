# Changelog

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
