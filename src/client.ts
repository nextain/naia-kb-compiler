/** @spec SPEC-006 — 소비자용 in-process 클라이언트 + 기본 어댑터 묶음(stub 기반, 오프라인). */
import type { Adapters, RetrievalPort } from "./domain/ports.js";
import type { CompileInput, CompileResult, Kb } from "./domain/types.js";
import { compile } from "./core/compile.js";
import { IngestAdapter } from "./adapters/ingest/text.js";
import { StubExtractAdapter } from "./adapters/extract/stub.js";
import { MemoryRetrievalAdapter } from "./adapters/retrieval/memory.js";
import { MemoryStoreAdapter } from "./adapters/store/memory.js";
import { Bm25RetrievalAdapter } from "./adapters/retrieval/bm25.js";
import { WorkspaceStoreAdapter } from "./adapters/store/workspace-fs.js";
import { KnowledgeService, type KnowledgeServiceOptions } from "./core/serve.js";

/** 기본 어댑터: 결정론 stub 추출 + in-memory 검색/저장. LLM/네트워크 불필요. */
export function defaultAdapters(): Adapters {
  return {
    ingest: new IngestAdapter(),
    extract: new StubExtractAdapter(),
    retrieval: new MemoryRetrievalAdapter(),
    store: new MemoryStoreAdapter(),
  };
}

export interface KbCompilerClient {
  compile(input: CompileInput): Promise<CompileResult>;
  exportKb(): Promise<string>;
}

/** 어댑터 일부만 오버라이드 가능(나머지는 기본). 코어는 어댑터 종류를 모름. */
export function createClient(overrides: Partial<Adapters> = {}): KbCompilerClient {
  const adapters: Adapters = { ...defaultAdapters(), ...overrides };
  return {
    compile: (input) => compile(input, adapters),
    exportKb: () => adapters.store.export(),
  };
}

/** 워크스페이스 지식(serve) 진입 결과. */
export interface WorkspaceKnowledge {
  /** 검색·질의응답(인용·기권). */
  service: KnowledgeService;
  /** 정본 그래프 데이터(엔티티·관계·카드) — 그래프 투영/시각화용. */
  kb: Kb;
}

export interface OpenWorkspaceKnowledgeOptions extends KnowledgeServiceOptions {
  /** 검색 백엔드(기본 BM25, 오프라인). RetrievalPort 어댑터로 교체 가능(D03 no-lockin). */
  retrieval?: RetrievalPort;
  /** kb.json 파일명(기본 `kb.json`). */
  fileName?: string;
}

/** 워크스페이스 디렉터리(`{dir}/kb.json`)의 정본을 로드해 바로 search/ask 가능한 KnowledgeService 로 연다.
 *  naia-agent 등 **in-process 소비자의 단일 진입점**(통합 K1a). 기본 오프라인·결정론(BM25 + 워크스페이스 파일).
 *  ⚠️ 파일이 없으면 빈 KB 로 열리고 `ask` 는 기권(abstained)한다(지어내지 않음, D05). */
export async function openWorkspaceKnowledge(
  dir: string,
  opts: OpenWorkspaceKnowledgeOptions = {},
): Promise<WorkspaceKnowledge> {
  const store = new WorkspaceStoreAdapter({ dir, fileName: opts.fileName });
  const kb = await store.load();
  const retrieval = opts.retrieval ?? new Bm25RetrievalAdapter();
  const service = await KnowledgeService.create(kb, retrieval, {
    answerThreshold: opts.answerThreshold,
    generate: opts.generate,
  });
  return { service, kb };
}
