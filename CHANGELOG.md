# Changelog

## 0.2.0

- People Search resource for X, YouTube, LinkedIn and TikTok (`/desearch/people/*`): Start Search, Get Results, Get Task, Pause Task, Resume Task, Cancel Task, List Tasks and List Profiles.
- Get Results can wait until a search finishes (Timeout, Poll Interval) and returns every page, one item per person. List Tasks and List Profiles support Return All and Limit; List Profiles has the result filters (has email, website or social links, audience, fit score, location, verified) and sorting.
- People Search errors show the reason the API gives, for example not enough credits or why a task cannot be paused.
- The AI Search, Web Search and X Search operations are now under a Search resource. It is the default, so existing workflows keep working unchanged.
- Unit tests with Vitest (`npm test`), run in CI.

## 0.1.1

- Credential test checks the API key without running a billed search.
- Package no longer ships `dist/tsconfig.tsbuildinfo`.
- Node and credential icons use the live Desearch mark (light and dark).
- Publish workflow: tag `v*` runs lint and build, then publishes to npm with provenance through npm trusted publishing (no token).

## 0.1.0

- AI Search, Web Search and X Search operations.
