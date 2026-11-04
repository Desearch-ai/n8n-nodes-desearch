# n8n-nodes-desearch

AI search, web search, X, TikTok, Facebook, Instagram, YouTube, Reddit and Threads data, page extraction, people search, company search and monitors for AI agents.

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

**Facebook** resource: **Search Ad Library**, public Meta Ad Library records by keyword (`POST /desearch/facebook/search`; **Options > Sort** is Impressions, most seen first and the default, or Recent, which puts recently started ads first), **Get Post** (`GET /desearch/facebook/post/{id}`), **Get Profile** of a profile or page (`GET /desearch/facebook/profile/{profile_id}`), **Get Profile Posts** (`GET /desearch/facebook/profile/{profile_id}/posts`), **Get Comments**, about 10 a page (`GET /desearch/facebook/comments/{post_id}`) and **Get Hashtag Posts**, Ad Library records for a keyword or hashtag (`GET /desearch/facebook/hashtag/{tag}`).

**Instagram** resource: **Search Profiles** (`POST /desearch/instagram/search`), **Get Post** by shortcode, ID or URL (`GET /desearch/instagram/media/{id}`), **Get Profile** (`GET /desearch/instagram/profile/{username}`), **Get Profile Posts** (`GET /desearch/instagram/profile/{username}/posts`), **Get Comments** by post shortcode (`GET /desearch/instagram/comments/{shortcode}`) and **Get Hashtag Posts** (`GET /desearch/instagram/hashtag/{tag}`).

**YouTube** resource: **Search** videos, Shorts, live streams, channels and playlists, with options for type, upload date, sort and duration (`POST /desearch/youtube/search`), **Get Video** by ID or URL (`GET /desearch/youtube/video/{id}`), **Get Transcript**, optionally in a caption language (`GET /desearch/youtube/transcript/{video_id}`), **Get Comments**, top or newest (`GET /desearch/youtube/comments/{video_id}`), **Get Channel** by handle or channel ID (`GET /desearch/youtube/channel/{handle}`) and **Get Channel Videos**, latest or popular (`GET /desearch/youtube/channel/{handle}/videos`).

**Reddit** resource: **Search** posts across all subreddits, with sort and timeframe (`POST /desearch/reddit/search`), **Get Subreddit** (`GET /desearch/reddit/subreddit/{name}`; the name is case-sensitive), **Get Subreddit Posts** with sort and timeframe (`GET /desearch/reddit/subreddit/{name}/posts`), **Get Post** by ID or URL (`GET /desearch/reddit/post/{id}`) and **Get Comments**, a comment tree with the replies Reddit loaded (`GET /desearch/reddit/comments/{post_id}`).

**Threads** resource: **Search** posts, optionally between two dates (`POST /desearch/threads/search`), **Search Users** (`POST /desearch/threads/search/users`), **Get Profile** (`GET /desearch/threads/profile/{username}`), **Get Profile Posts**, the latest 20 to 30 (`GET /desearch/threads/profile/{username}/posts`) and **Get Post** by URL or shortcode, with its replies and thread posts (`GET /desearch/threads/post/{id}`).

YouTube, Reddit and Threads operations have no **Count**: each call returns one page as the platform serves it. Every call is billed as one request, including an empty page; a 404 (for example a video without captions) and a 422 are not charged.

Usernames work with or without the `@`, hashtags with or without the `#`, subreddits with or without `r/`. Video, post and comment IDs can be URLs.

#### Social pages

Get Post, Get Profile, Get Video, Get Transcript, Get Channel and Get Subreddit output that one object. Every other TikTok, Facebook, Instagram, YouTube, Reddit and Threads operation outputs **one item per page**:

```json
{
	"results": [{ "id": "7499229683859426602", "text": "..." }],
	"nextCursor": "eyJ2IjoxLCJyb3V0ZSI6..."
}
```

`results` holds the posts, videos, comments, ad records or profiles of the page (at most **Count** where there is one; a page can have fewer). `nextCursor` is the cursor of the next page, or `null` on the last page. To get the next page, run the same operation with the same parameters and put that cursor in **Cursor**, for example `{{ $json.nextCursor }}`. A cursor is opaque: pass it back unchanged. It is valid for 24 hours and only for the same operation and target (username, hashtag, post or query); any other cursor fails with a 422 and is not charged. TikTok Get Trending, Instagram Search Profiles and every Threads operation return a single page (`nextCursor` is always `null`).

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

### Desearch Monitors

A monitor is a search that runs on a schedule (every hour to every week) over the web, X, Reddit, YouTube, Threads, TikTok, Instagram, Facebook and the Meta Ad Library and keeps only what is new: each run searches from where the previous run ended, drops everything the monitor has already seen and screens the rest for relevance with an AI classifier, so you get new posts, pages and videos about what you watch, for example "Bittensor subnet launches and updates". New items go to your webhook and stay readable here. See the [Monitors guide](https://www.desearch.ai/docs/guide/apis/monitors).

**Monitor** resource:

- **Create**: create a monitor (`POST /desearch/monitors`) from a **Query**, its **Sources** and **Interval** (1h, 3h, 6h, 12h, 1d or 7d). Options: a name, up to 5 **Criteria** (one per line) an item must meet, **Min Score** (0 to 100, default 60), a **Summary** of each run, pages per run from the web (10, 15 or 20), X posts per run (1 to 100), X language and minimum likes, TikTok posts per run (10, 20 or 30), Meta ads per run (10, 20 or 30), watched accounts (below), a **Webhook URL** and its events, metadata labels, and **Run Now** (on by default: the first run is queued at once). With a webhook, the output has `webhook_secret`, returned only here: keep it to check the `Desearch-Signature` header of each delivery.
- **Estimate Cost**: the most one run and one month of runs can cost for given sources, interval and options (`POST /desearch/monitors/estimate`).
- **Get**: settings, status, last run and totals (`GET /desearch/monitors/{monitor_id}`). `webhook` (null without one) also has `consecutive_failures` and `last_delivery`, the newest delivery: `null` before the first, else its `event`, `status` (`pending` while it waits for its first or next attempt at `next_attempt_at`, `delivered`, or `failed` after every retry), `attempts`, the endpoint's last `status_code` or `error`, `created_at` and `delivered_at`. A failed delivery is retried after 1, 5, 30, 120 and 360 minutes, and 5 failed deliveries in a row pause the monitor (`paused_reason` `webhook_failing`).
- **Get Many**: your monitors, newest first, filtered by status (`GET /desearch/monitors`).
- **Update**: change any setting, or set **Status** to Paused or Active (`PATCH /desearch/monitors/{monitor_id}`). The API replaces the per-source options and the webhook as a whole, so when you change one of them the node reads the monitor first and keeps the rest. A new webhook URL gets a new `webhook_secret`; **Remove Webhook** removes it.
- **Delete**: stop a monitor for good (`DELETE /desearch/monitors/{monitor_id}`).
- **Trigger Run**: queue a run now, outside the schedule (`POST /desearch/monitors/{monitor_id}/trigger`). It fails with 409 while a run is queued or running.
- **Test Webhook**: send a signed `monitor.test` event to the webhook and see what your endpoint answered (`POST /desearch/monitors/{monitor_id}/webhook/test`).
- **Rotate Webhook Secret**: a new signing secret, returned once (`POST /desearch/monitors/{monitor_id}/webhook/rotate-secret`).

**Watched accounts.** Instead of searching by keyword, a source can watch up to 10 accounts, separated by commas or new lines: **X Accounts** (`OpenAI`, `@OpenAI` or an x.com URL; X usernames are at most 15 characters), **Reddit Subreddits** (`LocalLLaMA`, `r/LocalLLaMA` or a URL), **YouTube Channels** (`@handle`, a `UC…` channel ID or a channel URL), **TikTok Accounts** (`openai`, `@openai` or a profile URL), **Threads Accounts** (`zuck`, `@zuck` or a profile URL), **Instagram Accounts** (`openai`, `@openai` or a profile URL) and **Facebook Pages** (`NASA`, a numeric page ID or a page URL; `profile.php?id=…` and `/pages/Name/123…` links become the ID). Each run then reads every account's newest posts, and the query and criteria still decide which are kept; set **Min Score** to 0 to keep every new post. With X accounts, X Posts per Run is not used (a timeline is 20 posts) and X Language and X Min Likes still filter; with TikTok accounts, TikTok Posts per Run is read from each account. TikTok search has no working date filter and ranks by relevance, so a TikTok keyword monitor finds a new video only when it reaches TikTok's top results; to follow creators, watch their accounts (TikTok Accounts). Threads keyword search returns loosely matched posts, so Threads Accounts work better there too. The API returns the names cleaned (`OpenAI`, `LocalLLaMA`, `@OpenAI` or `UC…`, `openai`, `zuck`, `NASA` or `100064869009429`) and fails with a 422 on a name it cannot read.

**Watched hashtags.** TikTok and Instagram can also watch up to 10 hashtags each, separated by commas or new lines: **TikTok Hashtags** and **Instagram Hashtags**, in any script (`aversi`, `#ავერსი`, or a tag URL such as `https://www.tiktok.com/tag/aversi` or `https://www.instagram.com/explore/tags/aversi/`). A hashtag feed lists popular as well as recent posts from any account, so a monitor finds posts outside the accounts it watches; with accounts or hashtags, a source reads those feeds instead of searching by keyword. Each run reads TikTok Posts per Run posts of each TikTok hashtag and up to 12 of each Instagram hashtag. The API returns hashtags without `#` and fails with a 422 on one it cannot read. An item read from a hashtag has `data.hashtag`, and a hashtag that could not be read in a run is listed in its `stats.sources.<source>.hashtags_failed`. Facebook has no organic hashtag feed; for ads by keyword, use Meta Ads.

**Instagram, Facebook and Meta Ads.** Instagram and Facebook have no keyword search here, so those sources only watch accounts: a monitor with Instagram needs **Instagram Accounts** or **Instagram Hashtags** and one with Facebook needs **Facebook Pages**. Create and Update fail with a 422 without them (for example "Instagram watches accounts or hashtags: add at least one in options.instagram.accounts or options.instagram.hashtags"); Update checks the monitor as updated, so to stop watching them, take the source out of **Sources** in the same update. Estimate Cost does not check this. **Meta Ads** searches the Meta Ad Library by keyword (**Meta Ads per Run**: 10, 20 or 30), so its query should be keywords, a brand, product or short phrase such as `ChatGPT`: a sentence finds nothing. An ad is new the first time a run sees it, if it started within the last 30 days, and ads are screened with their own relevance question and no `new_info`. For ads by keyword, use Meta Ads, not Facebook. In Update, a watched-accounts or watched-hashtags field that is set but empty stops watching that source's accounts or hashtags. An item read from a watched account has `data.account`, and an account that could not be read in a run is listed in its `stats.sources.<source>.accounts_failed`.

Item `data` holds the source's fields: X `likes`, `reposts`, `replies`, `views`; Reddit `subreddit`, `score`, `comments`; YouTube `channel`, `views`, `thumbnail`; TikTok `views`, `likes`, `comments`, `shares`, `saves`, `duration_s`; Threads `likes`; Instagram `likes`, `comments`, `views`, `media_type`; Facebook `reactions`, `comments`, `shares`, `views`; Meta ads `page`, `active`, `cta`, `link` (the ad's landing page), `platforms`, `thumbnail`, with the ad headline as the item's `title` and the Ad Library record as its `url`; web `highlights`, `domain`. TikTok, Instagram and Facebook items also have `post_id` (the ID the API's `GET /desearch/social/post` gives the same post; an Instagram shortcode), `type` (`video`, `image`, `carousel`, `reel`, …), `hashtags`, `mentions` (TikTok and Instagram), `media` (links to the post's videos and pictures) and `thumbnail`; media and thumbnail links expire after a few days. The metrics are the post's when the run found it; `GET /desearch/social/post?url=<link>` reads them again (`author=true` adds the author's followers). An item read from a watched account also has `account`, and one read from a watched hashtag `hashtag`. `signals` has `relevant` and `new_info`, and `criteria` (the lowest answer across the criteria) when the monitor has criteria.

**Run** resource:

- **Get**: one run with the items it kept, most relevant first (`GET /desearch/monitors/{monitor_id}/runs/{run_id}`). With **Wait for Completion** on, the node checks the run every **Poll Interval** seconds until it ends, and fails if it failed or is still going after **Timeout**. Set **Output** to Kept Items to get one output item per kept item.
- **Get Many**: a monitor's runs, newest first, with what each source returned and the cost (`GET /desearch/monitors/{monitor_id}/runs`).

**Item** resource:

- **Get Many**: everything a monitor kept, newest first, optionally from one source, including Instagram, Facebook and Meta Ads (`GET /desearch/monitors/{monitor_id}/items`).

A typical workflow is **Monitor > Create** once, then a Webhook node that receives its deliveries. To try a monitor right away, use **Monitor > Trigger Run**, then **Run > Get** with Monitor ID `{{ $json.monitor_id }}`, Run ID `{{ $json.run_id }}` and Wait for Completion on.

**Billing.** Every Monitors operation is free. Each run is billed for what it used: its searches at their list price, AI screening per item and, with Summary on, the LLM usage plus 50% ([prices](https://desearch.ai/pricing)). A watched account is one feed read per run: an X timeline is about $0.003 (20 posts), a subreddit, YouTube channel or Threads account $0.00207, TikTok $0.00207 a post (search, account or hashtag), an Instagram account or hashtag $0.02484 (up to 12 posts) and a Facebook page $0.0207 (up to 10 posts). Meta ads are billed at the Ad Library price: $0.0207 for 10 a run, $0.0621 for 30. A run with no new items still pays for its searches. While a run is going, its maximum cost (`max_run_cost_usd`) is held on your balance; a monitor whose run cannot be held pauses with `paused_reason` `insufficient_credits`.

All four nodes can also be used as tools by AI Agent nodes and use the same **Desearch API** credential.

## Development

```bash
npm ci
npm run lint
npm run build
npm test
```

`scripts/e2e-full-coverage.mts` is a smoke test of every operation added for full API coverage in 0.4.0 against the live API. It runs the built nodes' `execute()` with the same minimal n8n context the unit tests use, makes one small, billed call per operation (count 1 to 3 where the API allows), follows one next page wherever a TikTok, Facebook or Instagram list returns a cursor, prints `PASS`, `FAIL` or `SKIP` per call and exits with 1 when a call fails. It never starts a People Search (a paid job) unless you pass `--with-people`; without it, Export Results uses your latest existing search, if any. It needs Node.js 22.18 or later:

```bash
DESEARCH_API_KEY=... npm run e2e
DESEARCH_API_KEY=... npm run e2e -- --with-people
```

`scripts/e2e-youtube-reddit-threads.mts` does the same for the YouTube, Reddit and Threads operations: every operation once, the next page of each list that returns a cursor, and a tampered cursor that must fail with a 422 (about $0.05 a run). It reads the key from `DESEARCH_API_KEY` (or the variable `--key-env` names, or `~/.config/desearch/e2e.env`), and `--base-url` sends the node's requests to another deployment:

```bash
DESEARCH_API_KEY=... npm run e2e:yrt
npm run e2e:yrt -- --base-url https://api-dev.desearch.ai --key-env DESEARCH_DEV_API_KEY
```

`scripts/e2e-monitors.mts` (`npm run e2e:monitors`) runs every Desearch Monitors operation but Trigger Run against a live API: it estimates, creates a monitor that never runs (Run Now off, then paused), reads, lists, updates, sends a test webhook event, rotates the secret and deletes the monitor. Two more monitors that never run check watched accounts on X, Reddit, YouTube and TikTok, then Instagram, Facebook, Meta Ads and Threads: the cleaned names, the estimate's breakdown at the listed prices, `webhook.last_delivery` null on a fresh monitor, the 422 for Instagram or Facebook without accounts on Create and Update, and the item filter for the new sources. It is free, takes the same `--base-url` and `--key-env`, and always deletes what it created:

```bash
npm run e2e:monitors -- --base-url https://api-dev.desearch.ai --key-env DESEARCH_DEV_API_KEY
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
