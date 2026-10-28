# n8n-nodes-desearch

AI search, web search, X, TikTok, Facebook and Instagram data, page extraction and people search for AI agents.

This is an n8n community node for the [Desearch API](https://desearch.ai). It calls the Desearch REST API directly and has no runtime dependencies.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-desearch`.

## Nodes

### Desearch

Pick a **Resource**, then an **Operation**.

**Search** resource (the default):

- **AI Search**: search web, X, arXiv, Wikipedia, Hacker News and Reddit and get links with a summary (`POST /desearch/ai/search`).
- **AI Web Links Search**: web pages that match a prompt, with key excerpts and no summary (`POST /desearch/ai/search/links/web`). Count 10 to 200; options for a date range (UTC), highlights and full page text.
- **AI X Links Search**: X posts that match a prompt, without a summary (`POST /desearch/ai/search/links/twitter`). Count 10 to 200.
- **Search API**: ranked web pages, each with the passage that best matches the query (`POST /search`). Count 10, 15 or 20; options for mode (balanced or fast), a date range, highlights and full page text.
- **Web Search**: web results for a query (`GET /web`).
- **X Search**: posts on X for a query, one item per post (`GET /twitter`).

**Web Page** resource:

- **Extract**: the text or HTML of a public web page (`GET /web/extract`), output as `{ url, format, content }`. Turn on **Render JavaScript** for pages built with JavaScript (billed at a higher rate), optionally with a wait in milliseconds.

**X** resource:

- **Get Post**: a post by ID (`GET /twitter/post`).
- **Get Post Replies**: replies to a post, one item per reply (`GET /twitter/replies/post`).
- **Get Posts by URLs**: posts from a list of URLs, one item per post (`GET /twitter/urls`).
- **Get Retweeters**: users who reposted a post, a page at a time, with `next_cursor` (`GET /twitter/post/retweeters`).
- **Get Trends**: trending topics for a location by WOEID: 1 is worldwide, 23424977 the United States (`GET /twitter/trends`).
- **Get User Posts**: a user's timeline, a page at a time, with `next_cursor` (`GET /twitter/user/posts`).
- **Get User Replies**: posts and replies by a user, one item per post (`GET /twitter/replies`).
- **Search User Posts**: search one user's posts, one item per post (`GET /twitter/post/user`).

For Get Retweeters and Get User Posts, put the `next_cursor` of a page in **Cursor** to get the next page.

**TikTok** resource: **Search** (`POST /desearch/tiktok/search`), **Get Post** (`GET /desearch/tiktok/post/{id}`), **Get Profile** (`GET /desearch/tiktok/profile/{username}`), **Get Profile Posts** (`GET /desearch/tiktok/profile/{username}/posts`), **Get Comments** (`GET /desearch/tiktok/comments/{video_id}`), **Get Hashtag Posts** (`GET /desearch/tiktok/hashtag/{tag}`) and **Get Trending** for a region (`GET /desearch/tiktok/trending`).

**Facebook** resource: **Search Ad Library**, public Meta Ad Library records by keyword (`POST /desearch/facebook/search`), **Get Post** (`GET /desearch/facebook/post/{id}`), **Get Profile** of a profile or page (`GET /desearch/facebook/profile/{profile_id}`), **Get Profile Posts** (`GET /desearch/facebook/profile/{profile_id}/posts`), **Get Comments**, about 10 a page (`GET /desearch/facebook/comments/{post_id}`) and **Get Hashtag Posts**, Ad Library records for a keyword or hashtag (`GET /desearch/facebook/hashtag/{tag}`).

**Instagram** resource: **Search Profiles** (`POST /desearch/instagram/search`), **Get Post** by shortcode, ID or URL (`GET /desearch/instagram/media/{id}`), **Get Profile** (`GET /desearch/instagram/profile/{username}`), **Get Profile Posts** (`GET /desearch/instagram/profile/{username}/posts`), **Get Comments** by post shortcode (`GET /desearch/instagram/comments/{shortcode}`) and **Get Hashtag Posts** (`GET /desearch/instagram/hashtag/{tag}`).

Usernames work with or without the `@`, hashtags with or without the `#`.

#### TikTok, Facebook and Instagram pages

Get Post and Get Profile output the post or profile. Every other TikTok, Facebook and Instagram operation outputs **one item per page**:

```json
{
	"results": [{ "id": "7499229683859426602", "text": "..." }],
	"nextCursor": "eyJ2IjoxLCJyb3V0ZSI6..."
}
```

`results` holds the posts, comments, ad records or profiles of the page (at most **Count**; a page can have fewer). `nextCursor` is the cursor of the next page, or `null` on the last page. To get the next page, run the same operation with the same parameters and put that cursor in **Cursor**, for example `{{ $json.nextCursor }}`. A cursor is opaque: pass it back unchanged. It is valid for 24 hours and only for the same operation and target (username, hashtag, post or query); any other cursor fails with a 422 and is not charged. TikTok Get Trending and Instagram Search Profiles return a single page (`nextCursor` is always `null`).

To page through a list in a workflow: run the operation, use a **Split Out** node on `results` to get one item per post, and loop back to the operation with **Cursor** set to `{{ $json.nextCursor }}` until it is `null` (an **If** node on `nextCursor` "is not empty").

Workflows built with earlier versions keep working unchanged: AI Search, Web Search and X Search sit under the default **Search** resource with the same parameters and send the same requests.

### Desearch People Search

Find people on X, YouTube, LinkedIn and TikTok by describing them in plain language, for example "Indie hackers building in public who share their MRR". You get profiles, not posts: each person with a fit score, the reasons they matched, their audience, links and any public contact details. See the [People Search guide](https://www.desearch.ai/docs/guide/apis/people-search).

**Search** resource:

- **Start**: start a search on one platform (`POST /desearch/people/search/{platform}`). Set how many people to find (5 to 200) and, optionally, platform filters (followers or subscribers, countries, keywords, verified accounts, public contact), a minimum fit score and handles to leave out. The search runs in the background, usually for 1 to 5 minutes, and the node returns its task.
- **Get Results**: the people a search found, one item per person (`GET /desearch/people/tasks/{task_id}/results`). With **Wait for Completion** on (the default), the node checks the search every **Poll Interval** seconds until it finishes, then returns everyone it found. It fails if the search is still running after **Timeout** (the search keeps running; get its results again later), failed, or is paused. Turn **Return All** off to get at most **Limit** people.
- **Get**: status, progress and cost of a search (`GET /desearch/people/tasks/{task_id}`).
- **Get Many**: your searches, newest first, filtered by platform and status (`GET /desearch/people/tasks`).
- **Pause**, **Resume**, **Cancel**: control a running search (`POST /desearch/people/tasks/{task_id}/pause`, `/resume`, `/cancel`).
- **Export Results**: everyone a search found as a **CSV** or **JSON Lines** file (`GET /desearch/people/tasks/{task_id}/export`), optionally only people matching the result filters (has email, website or social links, audience, fit score, location, verified on X and TikTok). Like Get Results, it can wait for the search to finish first. The file is output as binary data in the field **Put Output File in Field** (`data` by default), ready for a Write Binary File, Google Drive or email node; the item's JSON has `task_id`, `format`, `fileName` and `fileSize`.

**Profile** resource:

- **Get Many**: everyone your searches on one platform found, one item per person (`GET /desearch/people/profiles`). Filter by what people have (email, website, X, LinkedIn, Instagram, YouTube, TikTok), audience, fit score, location, verified accounts (X and TikTok) or text in the name, handle or bio, and sort by score, most recent or audience.
- **Export**: the same people, with the same filters and sort, as a **CSV** or **JSON Lines** file (`GET /desearch/people/profiles/export`, up to 10,000 people), output as binary data like Export Results.

A typical workflow is **Search > Start**, then **Search > Get Results** with Task ID `{{ $json.task_id }}`. Get Results waits and outputs one item per person for the next node.

**Billing.** Only Start is billed. It reserves `count` people at the platform's price and, when the search ends, charges only for the people it delivered; a search that finds no one is free. Every other People Search operation is free. If you turn on **Retry On Fail** for Start, set an **Idempotency Key** that is unique for each search, for example `{{ $execution.id }}-{{ $itemIndex }}`: a retry with the same key returns the first search instead of starting and charging a new one.

API errors show the reason the API gives, for example "Only queued or running searches can be paused." With **On Error: Continue**, the failed item outputs `error` and `description`.

If your n8n instance limits how long an execution may run, keep the Get Results **Timeout** below that limit.

Both nodes can also be used as tools by AI Agent nodes and use the same **Desearch API** credential.

## Development

```bash
npm ci
npm run lint
npm run build
npm test
```

`scripts/e2e-full-coverage.mts` is a smoke test of every operation added in 0.3.0 against the live API. It runs the built nodes' `execute()` with the same minimal n8n context the unit tests use, makes one small, billed call per operation (count 1 to 3 where the API allows), follows one next page wherever a TikTok, Facebook or Instagram list returns a cursor, prints `PASS`, `FAIL` or `SKIP` per call and exits with 1 when a call fails. It never starts a People Search (a paid job) unless you pass `--with-people`; without it, Export Results uses your latest existing search, if any. It needs Node.js 22.18 or later:

```bash
DESEARCH_API_KEY=... npm run e2e
DESEARCH_API_KEY=... npm run e2e -- --with-people
```

## Credentials

Create an API key in the [Desearch console](https://console.desearch.ai/api-keys) and add it to a **Desearch API** credential. The key is sent as is in the `Authorization` header (no `Bearer` prefix). The credential test checks the key without running a search, so it is not billed.

## Resources

- [Desearch API docs](https://desearch.ai/docs)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Contact

dev@desearch.ai

## License

MIT
