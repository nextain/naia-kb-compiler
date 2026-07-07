/** @spec SPEC-006 — 워크스페이스 KB 로더(읽기 경로, K1a): <dir>/kb.json → {service, kb}.
 *  WorkspaceStoreAdapter.load(가반 envelope) → MemoryRetrievalAdapter.index → KnowledgeService.create.
 *  미컴파일=빈 KB(cards=0)로 열림 → search/ask 기권(throw 아님). 소비자(naia-agent K1a-2)가 dir 주입. */
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
  await retrieval.index(kb);
  const service = await KnowledgeService.create(kb, retrieval, opts);
  return { service, kb };
}
