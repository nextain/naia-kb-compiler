/** @spec SPEC-007(보강) — KeywordRetrievalAdapter + categoryGraph. hermetic(모델·네트워크 0). */
import { describe, it, expect } from "vitest";
import { KeywordRetrievalAdapter } from "../adapters/retrieval/keyword.js";
import { categoryGraph } from "../core/graph.js";
import type { Kb, ServiceCard } from "../domain/types.js";

const card = (id: string, title: string, fields: Record<string, string> = {}): ServiceCard => ({
  id, title, fields, sourceUris: [], confidence: 1, status: "accepted",
});

describe("KeywordRetrievalAdapter", () => {
  it("제목 매칭이 본문 매칭보다 우선(가중 2 vs 1)", async () => {
    const kb: Kb = {
      cards: [
        card("a", "여권 발급", { content: "본관 1층 민원여권과" }),
        card("b", "주민등록등본", { content: "여권 얘기도 잠깐 나옴" }),
      ],
      entities: [], relations: [],
    };
    const r = new KeywordRetrievalAdapter();
    await r.index(kb);
    const hits = await r.search("여권", 5);
    expect(hits[0].id).toBe("a"); // 제목에 "여권" → 우선
  });

  it("매칭 없으면 빈 결과", async () => {
    const r = new KeywordRetrievalAdapter();
    await r.index({ cards: [card("a", "여권 발급")], entities: [], relations: [] });
    expect(await r.search("자동차")).toHaveLength(0);
    expect(await r.search("")).toHaveLength(0);
  });
});

describe("categoryGraph", () => {
  it("루트→카테고리→항목 허브-스포크로 투영", () => {
    const items = [
      { id: "1", title: "역삼1동 주민센터", cat: "동주민센터" },
      { id: "2", title: "삼성1동 주민센터", cat: "동주민센터" },
      { id: "3", title: "도곡도서관", cat: "도서관" },
    ];
    const g = categoryGraph(items, (it) => it.cat, { rootId: "org", rootLabel: "강남구" });
    expect(g.entities).toHaveLength(6); // 루트1 + 카테고리2 + 항목3
    expect(g.relations).toHaveLength(5); // 루트→카테고리2 + 카테고리→항목3
    expect(g.relations.filter((r) => r.from === "org")).toHaveLength(2); // 카테고리 2개
    expect(g.entities.find((e) => e.id === "org")?.name).toBe("강남구");
  });

  it("도메인 분류 함수는 주입 — 코어는 카테고리를 모름", () => {
    const g = categoryGraph(
      [{ id: "x", name: "무엇이든" }],
      () => "임의분류",
    );
    expect(g.entities.map((e) => e.type)).toEqual(["root", "category", "임의분류"]);
  });
});
