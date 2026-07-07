/** naia-kb-compiler 공개 표면. 소비자는 여기서 import. */

// 도메인
export type * from "./domain/types.js";
export type * from "./domain/ports.js";

// 코어
export { compile } from "./core/compile.js";
export { verify } from "./core/verify.js";
export { KnowledgeService, bestSnippet, type SearchHit, type AskResult, type KnowledgeServiceOptions } from "./core/serve.js";
export { coverage, normalize, tokens, stem } from "./core/text.js";
export { scanSensitive, redact, applySafety, SafetyBlockedError, type SensitiveFinding, type SafetyMode as SafetyModeT } from "./core/safety.js";

// 클라이언트
export { createClient, defaultAdapters, type KbCompilerClient } from "./client.js";

// API
export { handleCompile, handleSearch, handleAsk, type HandlerResponse } from "./api/handler.js";

// 어댑터
export { IngestAdapter, type Fetcher } from "./adapters/ingest/text.js";
export { StubExtractAdapter } from "./adapters/extract/stub.js";
export { MarkdownExtractAdapter } from "./adapters/extract/markdown.js";
export { GeminiExtractAdapter, type GeminiExtractOptions } from "./adapters/extract/gemini.js";
export { MemoryStoreAdapter } from "./adapters/store/memory.js";
export { WorkspaceStoreAdapter, type WorkspaceStoreOptions } from "./adapters/store/workspace.js";
export { openWorkspaceKnowledge, type WorkspaceKnowledge } from "./core/workspace.js";
export { toGraphData, type GraphData, type GraphNode, type GraphEdge } from "./core/graph.js";
export { MemoryRetrievalAdapter } from "./adapters/retrieval/memory.js";
export { Bm25RetrievalAdapter } from "./adapters/retrieval/bm25.js";
export { DenseRetrievalAdapter } from "./adapters/retrieval/dense.js";
export { HybridRetrievalAdapter } from "./adapters/retrieval/hybrid.js";
export { TransformersEmbedAdapter, type TransformersEmbedOptions } from "./adapters/embed/transformers.js";
