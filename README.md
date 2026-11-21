# Ninad Patil Portfolio

Run `npm install` and `npm run dev` to start the portfolio. The assistant is at `/assistant`.

## Ninad AI

Copy `.env.example` to `.env.local` and set `NINAD_AI_API_KEY` to your Gemini API key. The assistant uses `gemini-3.5-flash-lite` at `https://generativelanguage.googleapis.com/v1beta/openai`. Set the same server-side variables on your deployment and restart the Next.js server after changing them. The model must support streaming and ordinary chat completions.

If the assistant reports an unavailable model or a usage limit, check the `[ninad-ai]` server log. Its request ID matches the response’s `X-Request-ID` header. The log includes the failure type and any upstream status, without request text or credentials.

The assistant uses Gemini to resolve the question against recent conversation and select semantic topics. The server ranks approved evidence using those topics, keyword relevance, and neighboring entities in a local knowledge graph. It checks each paragraph against its cited evidence before streaming. Conversation history stays in the browser tab's session storage and can be cleared in the chat.

### Maintaining the knowledge base

1. Place the separate source files in `data/knowledge/private/` using the filenames in `data/knowledge/reviewed.json`. This directory is ignored by Git. It can contain PDF, Markdown, and TXT originals.
2. Add or edit professional claims in `reviewed.json`. For each claim, add source IDs and short matching anchors, the relevant entities and relationships, and a date when known. A narrow, reviewed attribute such as a start date can also have a `lookup` with a visitor-facing summary. Keep the approved statement accurate even if a resume describes a result more broadly. Leave personal contacts, credentials, and internal work details out of approved claims.
3. Add incompatible values and their sources to `conflicts`. Record whether a discrepancy can be reconciled or remains unresolved. Update the associated claim to communicate the same decision. Dates and performance measurements on resumes remain self-reported unless separate approved evidence confirms them.
4. Install `pypdf` in your local Python environment if needed, then run `python scripts/build-knowledge.py`. The script reports missing files, validates reviewed anchors, rejects duplicate statements, and regenerates `data/knowledge/graph.json`. Unchanged files reuse a local hash-based extraction cache. Run `python scripts/build-knowledge.py --check` to detect a stale graph.
5. Review the generated graph and commit the reviewed manifest and graph with the assistant changes. A deployment needs the graph snapshot and your Gemini variables. The original files, extraction cache, and private passages are only needed to rebuild the snapshot.

The portfolio's project descriptions and approved public README facts are indexed separately in `src/lib/assistant/knowledge.ts`. They supply repository, demo, and Story links alongside the source labels for the private originals.

The server caps question length, history, generation tokens, request time and simultaneous requests. Rate limits are local to each running instance. Set `NINAD_AI_CLIENT_IP_HEADER` only when the deployment proxy overwrites that header with a trusted client address. Without it, visitors share one request bucket. Use a shared limiter at the edge for independent limits across instances.

The configured model provider receives the current question and approved evidence, plus a prior user question when needed for a follow-up. Its data handling follows the provider's terms.
