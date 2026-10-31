# 0005 — AI Support RAG (pgvector + LangChain LCEL + offline injection guard)

Date: 2026-10-31
Status: Accepted

## Context

Need read-only cinema support chatbot: tra cứu Film/Cinema/ShowTime/giá vé/Order của chính user + FAQ/chính sách.
Sequence: Client `Sending prompt` -> Server `Validation Injection prompt` -> `Detect which db` -> branch
`Query on PostgreSQL` (tools + params detected, handle query, tools to response) or
`Query on VectorDB` (got tools, embedding query, dense+sparse, handle query, result+ranking, merge, tools to response).
Reference impl: `AI-RAG_GENERATIVE-AI/simple_agent` (Groq qwen/qwen3.8-27b, FastEmbed paraphrase-multilingual-MiniLM-L12-v2,
chunk 500/50, hybrid dense Chroma + BM25 RRF k=60, tools `search_docs` + `response` few-shot VI).

Constraints: Prisma 7 has no native `vector` type; `postgres:16-alpine` image has no extension;
`@thaiandev/injection-req-res-sdk@0.0.1` ships only express/hono middleware (no Nest guard);
no Azure/external scanner keys (offline only); SSE not websocket.

## Decision

- DB: switch `db`/`db-follower` images to `pgvector/pgvector:pg16`; `CREATE EXTENSION vector + pg_trgm`;
  new `support_documents(content, embedding vector(1024), search_tsv, metadata)` with
  `HNSW cosine (m=16, ef_construction=64) + GIN(search_tsv)`. Prisma keeps `Unsupported`-free metadata model
  (`ai-support.prisma`); all vector I/O via `$queryRawUnsafe` in `VectorStoreService`. DDL idempotent in `prisma/vector-ext.sql`.
- Embeddings (JS): `fastembed` `fast-multilingual-e5-large` (1024 dims, onnx nhẹ, VI-capable) wrapped as LangChain
  `Embeddings`; hash fallback for offline/tests. No OpenAI embeddings key needed.
- Retrieval: dense pgvector + in-memory `BM25Retriever` (rebuilt from corpus) + `tsvector` sparse, fused by RRF
  (`hybrid-retriever.service.ts`, port of `hybrid.py`). `candidate_k=20, rrf_k=60, topK<=10, query<=1000 chars`.
- Tools (no raw SQL from LLM): `analyze_query` -> `select_source` (rule + LLM override) -> structured APIs
  (`FilmService/CinemaService/TicketService/Prisma order` read-only, LIMIT<=20) and/or `search_docs` -> `response`
  (few-shot VI merge/lọc nhiễu/từ chối, LCEL `prompt.pipe(llm).pipe(parser)`, fallback extractive offline).
  Exposed as LangChain `tool()` list for ReAct parity.
- LLM: `ChatGroq qwen/qwen3.8-27b, max_tokens=256, temp=0.5`, lazy init, fail-closed `503` when `GROQ_API_KEY` missing.
- Injection: hand-written `InjectionGuard(scanInput)` + `InjectionOutputInterceptor(scanOutput)` with
  `inputRegex=[ignore previous instructions, jailbreak, ...]`, `outputBlockedWords=[AKIA, sk-]`,
  `outputBlockedCodeFormats=[SQL]`; `shouldDeny -> 400 AI_INJECTION_DETECTED/OUTPUT_BLOCKED` (SDK 446 mapped);
  plus `MAX_QUERY_CHARS + control-char` reject. Jest `moduleNameMapper` pins SDK `dist/index.js` (exports map lacks `require`).
- API: `src/module/ai-support` (`POST /v1/ai-support/chat` JSON, `GET /v1/ai-support/chat/stream?query=` SSE,
  `GET conversations/:id`, `POST ingest` admin). Auth required (ownership check on order). Persist
  `SupportConversation/SupportMessage/SupportDocument`.
- Terms: `SupportConversation` (not `Session` — auth login), `SupportMessage`, `SupportDocument`, `RetrievalTrace`
  (see CONTEXT.md Discovery).

## Consequences

- `prisma db push` must be followed by `prisma/vector-ext.sql` apply (or `pnpm ai:vector:ensure`); `--force-reset` wipes
  vector index — re-run DDL. Follower volume recreated once for pgvector image.
- No Azure `shieldPrompt/contentSafety` until keys exist; offline regex is best-effort.
- Ingest is manual (`pnpm ai:ingest`): Film/Cinema + `docs/support/*.md`, chunk 500/50.
