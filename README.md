# Ninad Patil Portfolio

Run `npm install` and `npm run dev` to start the portfolio. The assistant is at `/assistant`.

## Ninad AI

Use Node.js 22.13 or later. Copy `.env.example` to `.env.local` and set `NINAD_AI_API_KEY` to your Gemini API key. The assistant uses `gemini-3.5-flash-lite` through Gemini’s OpenAI-compatible streaming endpoint.

The server resolves references from at most two recent turns and runs scope checks, query matching, and retrieval locally. Direct facts and refusals need zero Gemini calls. When several verified replies fit, Gemini makes at most one streaming selection call. The server renders only approved reply options and citations. Standalone verified selections are cached for six hours. The cache holds hashed keys and option IDs. Contextual questions, mixed-scope questions, and outage fallbacks are never cached.

The `[ninad-ai]` log records an outcome, the number of Gemini calls, and provider token counts when available per `X-Request-ID`. It also records rate-limit and cooldown events. Question text, IP addresses, and credentials stay out of logs.

Visitors get 15 questions per rolling hour, including cache hits. The assistant honors provider retry delays and serves matched portfolio evidence during a provider outage, with a manual Retry button. It uses a 14-second Gemini deadline. Set `NINAD_AI_GEMINI_CALLS_PER_MINUTE` and `NINAD_AI_GEMINI_CALLS_PER_DAY` below the project’s model quotas. The defaults are five calls per rolling minute and 40 per rolling day.

### Deployment storage

- For serverless or multiple instances, configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for the same Redis database on every instance. An Upstash free database can be used. [Upstash Redis REST documentation](https://upstash.com/docs/redis/features/restapi)
- For one long-lived Node.js server, set `NINAD_AI_SQLITE_PATH` to a private path on a durable local disk. A loopback-only local run uses `data/runtime/assistant.sqlite` by default. SQLite’s counters and cache survive restarts.
- Set `NINAD_AI_CLIENT_IP_HEADER` to the single IP header your trusted proxy overwrites on every request. Keep `NINAD_AI_VISITOR_SECRET` identical across instances and restarts. Use a random secret of at least 32 bytes. The limiter hashes IPv4 addresses and IPv6 /64 networks. People sharing a public IP can share a quota. The API returns HTTP 503 if it cannot verify visitor identity or reach persistent rate-limit storage.

Run `npm run evaluate:assistant` for the local question, stream, rate-limit, cache, and fallback checks. To sample the deployed response path, run `npm run evaluate:assistant -- --live http://localhost:3000/api/assistant frontend coding hire-join ai`.

### Maintaining the knowledge base

1. Place the separate source files in `data/knowledge/private/` using the filenames in `data/knowledge/reviewed.json`. This directory is ignored by Git. It can contain PDF, Markdown, and TXT originals.
2. Add or edit professional claims in `reviewed.json`. For each claim, add source IDs and short matching anchors, the relevant entities and relationships, and a date when known. Keep the approved statement accurate even if a resume describes a result more broadly. Leave personal contacts, credentials, and internal work details out of approved claims.
3. Add incompatible values and their sources to `conflicts`. Record whether a discrepancy can be reconciled or remains unresolved. Update the associated claim to communicate the same decision. Dates and performance measurements on resumes remain self-reported unless separate approved evidence confirms them.
4. Install `pypdf` in your local Python environment if needed, then run `python scripts/build-knowledge.py`. The script reports missing files, validates reviewed anchors, rejects duplicate statements, and regenerates `data/knowledge/graph.json`. Unchanged files reuse a local hash-based extraction cache. Run `python scripts/build-knowledge.py --check` to detect a stale graph.
5. Review the generated graph and commit the reviewed manifest and graph with the assistant changes. A deployment needs the graph snapshot and your Gemini variables. The original files, extraction cache, and private passages are only needed to rebuild the snapshot.

The portfolio's project descriptions and approved public README facts are indexed separately in `src/lib/assistant/knowledge.ts`. They supply repository, demo, and Story links alongside the source labels for the private originals.

Gemini receives a short local query and approved reply options for ambiguous requests. The browser stores the conversation and sends the two most recent turns to the local backend for reference resolution.
