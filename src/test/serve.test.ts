/** @spec SPEC-008 / TEST-F-008 — KnowledgeService 검색·질의응답 + 기권. */
import { describe, it, expect } from "vitest";
import { KnowledgeService, isServeReady } from "../core/serve.js";
import { Bm25RetrievalAdapter } from "../adapters/retrieval/bm25.js";
import type { Kb, ServiceCard } from "../domain/types.js";

const kb: Kb = {
  cards: [
    { id: "c1", title: "여권 발급", fields: { content: "여권 발급 대상은 국민. 수수료는 53000원. 담당은 민원여권과." }, sourceUris: ["u1"], confidence: 1, status: "accepted" },
    { id: "c2", title: "전입신고", fields: { content: "전입신고 필요서류는 신분증. 담당은 주민센터." }, sourceUris: ["u2"], confidence: 1, status: "accepted" },
  ],
  entities: [], relations: [],
};

describe("KnowledgeService", () => {
  it("search: 관련 문서 + 스니펫 + 점수", async () => {
    const svc = await KnowledgeService.create(kb, new Bm25RetrievalAdapter());
    const hits = await svc.search("수수료");
    expect(hits[0].title).toBe("여권 발급");
    expect(hits[0].snippet).toContain("53000"); // 스니펫이 질의 관련 문장(수수료 줄)을 뽑음
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("ask: 근거 있으면 추출형 답변 + 출처", async () => {
    const svc = await KnowledgeService.create(kb, new Bm25RetrievalAdapter());
    const r = await svc.ask("전입신고 필요서류?");
    expect(r.abstained).toBe(false);
    expect(r.answer).toContain("신분증");
    expect(r.sources.length).toBeGreaterThan(0);
  });

  it("ask: 근거 없으면 기권(지어내지 않음)", async () => {
    const svc = await KnowledgeService.create(kb, new Bm25RetrievalAdapter());
    const r = await svc.ask("우주선 발사 비용은?");
    expect(r.abstained).toBe(true);
    expect(r.sources).toHaveLength(0);
  });

  it("isServeReady: draft·accepted 는 서빙, gap 만 제외", () => {
    expect(isServeReady({ status: "draft" })).toBe(true);
    expect(isServeReady({ status: "accepted" })).toBe(true);
    expect(isServeReady({ status: "gap" })).toBe(false);
  });

  it("draft 카드(goldQA 없는 컴파일 산출)는 검색·질의에 나온다", async () => {
    const draftKb: Kb = {
      cards: kb.cards.map((c) => ({ ...c, status: "draft" as const })),
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(draftKb, new Bm25RetrievalAdapter());
    const hits = await svc.search("수수료");
    expect(hits[0].title).toBe("여권 발급");
    const asked = await svc.ask("전입신고 필요서류?");
    expect(asked.abstained).toBe(false);
    expect(asked.answer).toContain("신분증");
  });

  it("gap 카드는 검색에서 빠지고 같은 질의는 기권한다", async () => {
    const gapOnly: Kb = {
      cards: kb.cards.map((c) => ({ ...c, status: "gap" as const })),
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(gapOnly, new Bm25RetrievalAdapter());
    expect(await svc.search("수수료")).toHaveLength(0);
    expect((await svc.ask("전입신고 필요서류?")).abstained).toBe(true);
  });

  it("accepted 와 gap 이 섞이면 accepted 만 서빙한다", async () => {
    const mixed: Kb = {
      cards: [
        kb.cards[0],
        { ...kb.cards[1], status: "gap" } as ServiceCard,
      ],
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(mixed, new Bm25RetrievalAdapter());
    const hits = await svc.search("신분증");
    expect(hits.every((h) => h.title !== "전입신고")).toBe(true);
  });
});
