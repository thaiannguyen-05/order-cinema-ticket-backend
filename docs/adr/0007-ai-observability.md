# 0007 — AiSupport in-house LLM trace + metrics (Langfuse-ready)

Verbose `toolCalls: string[]` shows which step ran but not what the model saw/did (prompt, chunks, latency, tokens). Debugging RAG needs LlmPrompt + LlmParams + RetrievalChunks + StepLatency + TokenUsage per step.

Decision: in-house `AiStepTrace[]` collected in `AiSupportService.chat()` and passed down to `ToolsService` (`classify`, `search_docs`, `search_films/cinemas/order`, `response:rag|general|direct|refusal`), rendered as truncated previews (2000 chars) + `model/maxTokens/temperature` via `LlmService.invokeTemplate()` which preserves `usage_metadata/response_metadata.tokenUsage` (old `StringOutputParser` dropped it). `trace` returned only when `verbose=true` in non-prod (same gate as `sources/toolCalls/eval`), SSE emits `{type:'trace', steps}`. Prometheus gains `app_ai_llm_duration_seconds{step,model}` + `app_ai_llm_tokens_total{step,model}` via `MetricsService.observeAiLlm()` (fire-and-forget, guarded for unit tests). No DB schema change (trace not persisted, only `toolCalls`).

Considered Options: LangSmith auto-tracing (rejected for now: SaaS, order/user data leaves VPC, still needs manual spans because orchestration is heuristic, not agent-loop); Langfuse self-host (deferred: `invokeTemplate()` accepts callbacks-ready config so `withConfig({callbacks:[langfuseHandler]})` can be added without refactor); Helicone proxy (rejected: extra hop, weak RAG lineage).

Consequences: `ChatResult.trace` optional (backward compat); `ToolsService` methods gain optional `trace?` param; `RagEvalService` judges reuse `invokeTemplate`; frontend devtools can render per-step latency/tokens from `verbose=true` or SSE `trace` event; prod gets latency/token histograms without prompt leakage.
