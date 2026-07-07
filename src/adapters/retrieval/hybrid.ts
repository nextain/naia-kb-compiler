/** @spec SPEC-007 — Hybrid Retrieval: 여러 RetrievalPort를 RRF(Reciprocal Rank Fusion)로 융합. 키워드(BM25)+dense 결합 = 단일 대비 향상. */
import type { RetrievalPort } from "../../domain/ports.js";
import type { Kb, ServiceCard } from "../../domain/types.js";

export class HybridRetrievalAdapter implements RetrievalPort {
  /** @param ports 융합할 리트리버들 @param rrfK RRF 상수(기본 60) @param pool 각 리트리버에서 가져올 후보 수 */
  constructor(private ports: RetrievalPort[], private rrfK = 60, private pool = 30) {}

  async index(kb: Kb): Promise<void> {
    for (const p of this.ports) await p.index(kb);
  }

  async search(query: string, k = 5): Promise<ServiceCard[]> {
    const lists = await Promise.all(this.ports.map((p) => p.search(query, this.pool)));
    const score = new Map<string, number>();
    const byId = new Map<string, ServiceCard>();
    for (const list of lists) {
      list.forEach((c, rank) => {
        score.set(c.id, (score.get(c.id) ?? 0) + 1 / (this.rrfK + rank + 1));
        byId.set(c.id, c);
      });
    }
    return [...score.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([id]) => byId.get(id)!);
  }
}
