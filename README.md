# n8n-nodes-desearch

AI search, X search and web search for AI agents.

This is an n8n community node for the [Desearch API](https://desearch.ai). It calls the Desearch REST API directly and has no runtime dependencies.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-desearch`.

## Operations

- **AI Search**: search web, X, arXiv, Wikipedia, Hacker News and Reddit and get links with a summary (`POST /desearch/ai/search`).
- **Web Search**: web results for a query (`GET /web`).
- **X Search**: posts on X for a query (`GET /twitter`).

The node can also be used as a tool by AI Agent nodes.

## Credentials

Create an API key in the [Desearch console](https://console.desearch.ai) and add it to a **Desearch API** credential. The key is sent in the `Authorization` header.

## Resources

- [Desearch API docs](https://desearch.ai/docs)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## License

MIT
