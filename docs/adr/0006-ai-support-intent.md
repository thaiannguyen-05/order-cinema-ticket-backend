# 0006 — AiSupport intent router + direct smalltalk + soft refusal

Support-only RAG returned a hard "Không tìm thấy chunk nào liên quan" for normal messages (hello, who are you) because selectSource only knew structured/vector/both and response() refused on zero chunks with no history.

Decision: single LLM classifier into smalltalk | identity | structured | vector | both | outofscope (rule fallback offline); SmallTalk/Identity bypass retrieval with a direct Vietnamese answer and capability intro (offline template when no key); Support keeps structured+vector RAG with last-6 history injected and ONLY-from-chunks for TransactionalFact while CatalogFact (synopsis/cast/genre) may use general LLM knowledge with a disclaimer; zero-chunk and out-of-scope use a soft refusal with sample follow-ups; every path keeps input/output injection guards; contract adds intent, sourceKind none for non-support, toolCalls classify:X + response:direct|rag|refusal|general.

Considered Options: separate router step before selectSource (rejected: costs 2 LLM calls); free general knowledge for all missing chunks (rejected: hallucinates prices/showtimes/orders); stateless no-history (rejected: pronouns like "nó/ở đó" break multi-turn).

Consequences: ChatResult gains intent; old selectSource kept for compatibility; frontend must accept sourceKind none and new toolCalls suffixes.

Update: POST /chat defaults to a clean `{answer, conversationId}` (chat-like, no logs); pass `verbose: true` for the full debug trace. SSE mirrors this (verbose-only tool/sources events).
