/** @spec SPEC-007 — Keyword Retrieval 어댑터: 토큰 매칭 스코어(title 가중). 의존성 0·경량.
 *  Bm25(idf 가중)보다 단순하지만, 위치·연락처 FAQ 같은 짧은 카드 코퍼스에 충분하고 빠르다.
 *  (소비 응용의 검색 휴리스틱을 포트 뒤로 일반화 — 도메인 비종속.) */
import type { RetrievalPort } from "../../domain/ports.js";
import type { Kb, ServiceCard } from "../../domain/types.js";
import { tokens } from "../../core/text.js";

interface IndexedCard {
  card: ServiceCard;
  title: Set<string>;
  body: Set<string>;
}

export class KeywordRetrievalAdapter implements RetrievalPort {
  private idx: IndexedCard[] = [];

  async index(kb: Kb): Promise<void> {
    this.idx = kb.cards.map((c) => {
      const fieldText = Object.values(c.fields).join(" ");
      return {
        card: c,
        title: new Set(tokens(c.title)),
        body: new Set(tokens(`${c.title} ${fieldText}`)),
      };
    });
  }

  async search(query: string, k = 8): Promise<ServiceCard[]> {
    const qt = tokens(query);
    if (!qt.length) return [];
    return this.idx
      .map((e) => {
        let s = 0;
        for (const t of qt) {
          if (e.title.has(t)) s += 2; // 제목 매칭 가중
          else if (e.body.has(t)) s += 1;
        }
        return { card: e.card, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map((x) => x.card);
  }
}
