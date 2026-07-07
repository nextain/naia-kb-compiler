/** @spec SPEC-007 — Retrieval 어댑터(in-memory): IDF 가중 + 제목 부스트. index 시 토큰 캐시(검색마다 재토큰화 금지). 교체 가능. */
import type { RetrievalPort } from "../../domain/ports.js";
import type { Kb, ServiceCard } from "../../domain/types.js";
import { tokens, stem } from "../../core/text.js";

const stemSet = (s: string) => new Set(tokens(s).map(stem));

interface Doc { card: ServiceCard; hay: Set<string>; title: Set<string>; }

export class MemoryRetrievalAdapter implements RetrievalPort {
  private docs: Doc[] = [];
  private df = new Map<string, number>();
  private n = 0;

  async index(kb: Kb): Promise<void> {
    this.n = kb.cards.length;
    this.df.clear();
    this.docs = kb.cards.map((card) => {
      const hay = stemSet([card.title, ...Object.values(card.fields)].join(" "));
      for (const t of hay) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      return { card, hay, title: stemSet(card.title) };
    });
  }

  private idf(t: string): number {
    return Math.log((this.n + 1) / ((this.df.get(t) ?? 0) + 0.5));
  }

  async search(query: string, k = 5): Promise<ServiceCard[]> {
    const qToks = [...stemSet(query)];
    const scored = this.docs
      .map((d) => {
        let s = 0;
        for (const t of qToks) if (d.hay.has(t)) s += this.idf(t) * (d.title.has(t) ? 2 : 1);
        return { c: d.card, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, k).map((x) => x.c);
  }
}
