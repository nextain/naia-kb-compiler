/** @spec SPEC-006 — 워크스페이스 KB 로더(읽기 경로, K1a): <dir>/kb.json → {service, kb}.
 *  WorkspaceStoreAdapter.load(가반 envelope) → KnowledgeService.create(서빙은 non-gap).
 *  반환 kb 는 정본 전체(그래프용). service 는 gap 제외 인덱스. 미컴파일=빈 KB → ask 기권. */
import { MemoryRetrievalAdapter } from "../adapters/retrieval/memory.js";
import { WorkspaceStoreAdapter } from "../adapters/store/workspace.js";
import { KnowledgeService, type KnowledgeServiceOptions } from "./serve.js";
import type { Kb } from "../domain/types.js";

export interface WorkspaceKnowledge {
  service: KnowledgeService;
  kb: Kb;
}

export async function openWorkspaceKnowledge(
  dir: string,
  opts: KnowledgeServiceOptions = {},
): Promise<WorkspaceKnowledge> {
  const kb = await new WorkspaceStoreAdapter({ dir }).load();
  const retrieval = new MemoryRetrievalAdapter();
  const service = await KnowledgeService.create(kb, retrieval, opts);
  return { service, kb };
}
