# n8n-nodes-desearch

AI search, X search, web search, people search and company search for AI agents.

This is an n8n community node for the [Desearch API](https://desearch.ai). It calls the Desearch REST API directly and has no runtime dependencies.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-desearch`.

## Nodes

### Desearch

- **AI Search**: search web, X, arXiv, Wikipedia, Hacker News and Reddit and get links with a summary (`POST /desearch/ai/search`).
- **Web Search**: web results for a query (`GET /web`).
- **X Search**: posts on X for a query (`GET /twitter`).

### Desearch People Search

Find people on X, YouTube, LinkedIn and TikTok by describing them in plain language, for example "Indie hackers building in public who share their MRR". You get profiles, not posts: each person with a fit score, the reasons they matched, their audience, links and any public contact details. See the [People Search guide](https://www.desearch.ai/docs/guide/apis/people-search).

**Search** resource:

- **Start**: start a search on one platform (`POST /desearch/people/search/{platform}`). Set how many people to find (5 to 200) and, optionally, platform filters (followers or subscribers, countries, keywords, verified accounts, public contact), a minimum fit score and handles to leave out. The search runs in the background, usually for 1 to 5 minutes, and the node returns its task.
- **Get Results**: the people a search found, one item per person (`GET /desearch/people/tasks/{task_id}/results`). With **Wait for Completion** on (the default), the node checks the search every **Poll Interval** seconds until it finishes, then returns everyone it found. It fails if the search is still running after **Timeout** (the search keeps running; get its results again later), failed, or is paused. Turn **Return All** off to get at most **Limit** people.
- **Get**: status, progress and cost of a search (`GET /desearch/people/tasks/{task_id}`).
- **Get Many**: your searches, newest first, filtered by platform and status (`GET /desearch/people/tasks`).
- **Pause**, **Resume**, **Cancel**: control a running search (`POST /desearch/people/tasks/{task_id}/pause`, `/resume`, `/cancel`).

**Profile** resource:

- **Get Many**: everyone your searches on one platform found, one item per person (`GET /desearch/people/profiles`). Filter by what people have (email, website, X, LinkedIn, Instagram, YouTube, TikTok), audience, fit score, location, verified accounts (X and TikTok) or text in the name, handle or bio, and sort by score, most recent or audience.

A typical workflow is **Search > Start**, then **Search > Get Results** with Task ID `{{ $json.task_id }}`. Get Results waits and outputs one item per person for the next node.

**Billing.** Only Start is billed. It reserves `count` people at the platform's price and, when the search ends, charges only for the people it delivered; a search that finds no one is free. Every other People Search operation is free. If you turn on **Retry On Fail** for Start, set an **Idempotency Key** that is unique for each search, for example `{{ $execution.id }}-{{ $itemIndex }}`: a retry with the same key returns the first search instead of starting and charging a new one.

API errors show the reason the API gives, for example "Only queued or running searches can be paused." With **On Error: Continue**, the failed item outputs `error` and `description`.

If your n8n instance limits how long an execution may run, keep the Get Results **Timeout** below that limit.

### Desearch Company Search

Find companies by describing them in plain language, for example "Series A fintech startups in Berlin building payment infrastructure", or start from the domains you already have. Each company comes with its public emails, phones and social profiles, its leaders (CEO, founders, CTO and CFO by default) with their LinkedIn profiles and emails, and the page each contact came from. See the [Company Search guide](https://www.desearch.ai/docs/guide/apis/company-search).

**Company Search** resource:

- **Start**: start a search from a description (`POST /desearch/companies/search`). Set how many companies to deliver (5 to 200) and, optionally, countries, what every company must have (email, phone, company LinkedIn page, a leader, a leader with an email), a minimum fit score, domains to leave out, which leaders to find, whether to infer and check emails, and metadata labels. The task runs in the background and the node returns it.

**Company Enrich** resource:

- **Start**: collect the same data for 1 to 200 domains or URLs you already have, separated by commas or new lines (`POST /desearch/companies/enrich`). You get one company per domain, without a fit score. Same leader, email and metadata options as Company Search.

Both resources also have:

- **Get Results**: the companies a task delivered, one item per company (`GET /desearch/companies/tasks/{task_id}/results`). Companies arrive while the task runs and later stages (leaders, inferred emails, email checks) fill them in, so with **Wait for Completion** on (the default) the node checks the task every **Poll Interval** seconds until it finishes, then returns every company in its final version. It fails if the task is still running after **Timeout** (the task keeps running; get its results again later), failed, or is paused. Turn **Return All** off to get at most **Limit** companies.
- **Get**: status, progress, cost, why the task stopped (`completion_reason`, `coverage_limited`) and `warnings` (`GET /desearch/companies/tasks/{task_id}`).
- **Get Many**: your Company Search or Company Enrich tasks, newest first, filtered by status and metadata labels (`GET /desearch/companies/tasks?type=search|enrich`).
- **Pause**, **Resume**, **Cancel**: control a running task (`POST /desearch/companies/tasks/{task_id}/pause`, `/resume`, `/cancel`).

A typical workflow is **Company Search > Start**, then **Company Search > Get Results** with Task ID `{{ $json.task_id }}`. A People Search task ID does not work on this node, and a company task ID does not work on Desearch People Search.

**Billing.** Only Start is billed. Company Search reserves `count` companies and Company Enrich one company per domain, at the route's per-company price ([prices](https://desearch.ai/pricing)). When the task ends you pay only for the companies it delivered, with a minimum of 2 (Company Search) or 1 (Company Enrich) when it delivers any; a task that delivers none is free, and a company left out by Min Score or Must Have is not billed. Every other operation is free. As with People Search, set an **Idempotency Key** when you turn on **Retry On Fail** for Start.

All three nodes can also be used as tools by AI Agent nodes and use the same **Desearch API** credential.

## Credentials

Create an API key in the [Desearch console](https://console.desearch.ai/api-keys) and add it to a **Desearch API** credential. The key is sent as is in the `Authorization` header (no `Bearer` prefix). The credential test checks the key without running a search, so it is not billed.

## Resources

- [Desearch API docs](https://desearch.ai/docs)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Contact

dev@desearch.ai

## License

MIT
