/** @spec SPEC-008 / TEST-F-008 — KnowledgeService 검색·질의응답 + 기권. */
import { describe, it, expect } from "vitest";
import { KnowledgeService, isServeReady, bestSnippet } from "../core/serve.js";
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

  it("draft 카드에 회사명이 있으면 구어 질문도 기권하지 않는다", async () => {
    const companyKb: Kb = {
      cards: [
        {
          id: "c-co",
          title: "회사 소개",
          fields: { content: "회사명은 넥스테인이다. Nextain Inc." },
          sourceUris: ["file:///ws/company.md"],
          confidence: 1,
          status: "draft",
        },
      ],
      entities: [{ id: "e-co", type: "Concept", name: "넥스테인" }],
      relations: [],
    };
    const svc = await KnowledgeService.create(companyKb, new Bm25RetrievalAdapter());
    const hits = await svc.search("회사 이름이 뭐야?");
    expect(hits[0].title).toBe("회사 소개");
    const asked = await svc.ask("회사 이름이 뭐야?");
    expect(asked.abstained).toBe(false);
    expect(asked.answer).toMatch(/넥스테인|Nextain/);
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

  it("bestSnippet: 마크다운 제목 줄 대신 본문 값 줄을 고른다", () => {
    const card: ServiceCard = {
      id: "c-deploy",
      title: "배포 규칙 - 금요일 배포 제한",
      fields: {
        content: "# 배포 규칙 - 금요일 배포 제한\n\n## 배포 규칙\n\n- 배포는 0755 이후 금요일에 하지 않는다.",
      },
      sourceUris: ["file:///ws/deploy-rule.md"],
      confidence: 1,
      status: "accepted",
    };
    expect(bestSnippet(card, "배포 규칙")).toBe("- 배포는 0755 이후 금요일에 하지 않는다.");
  });

  it("ask: 마크다운 제목 줄을 건너뛰고 본문 값 줄(0755)을 답변으로 반환한다", async () => {
    const deployKb: Kb = {
      cards: [
        {
          id: "c-deploy",
          title: "배포 규칙 - 금요일 배포 제한",
          fields: {
            content: "## 배포 규칙\n\n- 배포는 0755 이후 금요일에 하지 않는다.",
          },
          sourceUris: ["file:///ws/deploy-rule.md"],
          confidence: 1,
          status: "accepted",
        },
      ],
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(deployKb, new Bm25RetrievalAdapter());
    const r = await svc.ask("배포 규칙이 뭐였지?");
    expect(r.abstained).toBe(false);
    expect(r.answer).toContain("0755");
  });

  it("bestSnippet: 제목 줄뿐인 content면 제목 줄을 돌려준다", () => {
    const card: ServiceCard = {
      id: "c-heading-only",
      title: "배포 규칙",
      fields: {
        content: "# 배포 규칙\n## 금요일 배포 제한",
      },
      sourceUris: ["file:///ws/heading-only.md"],
      confidence: 1,
      status: "accepted",
    };
    expect(bestSnippet(card, "배포 규칙")).toMatch(/^#{1,6}\s/);
    expect(bestSnippet(card, "금요일")).toBe("## 금요일 배포 제한");
  });

  it("bestSnippet (a): 비제목 줄 coverage가 0이면 제목 줄을 유지한다", () => {
    const card: ServiceCard = {
      id: "c-refund",
      title: "환불 안내",
      fields: {
        content: "## 환불\n---\n문의는 고객센터로.",
      },
      sourceUris: ["file:///ws/refund.md"],
      confidence: 1,
      status: "accepted",
    };
    expect(bestSnippet(card, "환불")).toBe("## 환불");
  });

  it("bestSnippet (b): 비제목 줄에 질의 토큰이 없으면 제목 줄에서 고른다", () => {
    const card: ServiceCard = {
      id: "c-deploy-h3",
      title: "배포 금지 안내",
      fields: {
        content: "### 0755 이후 금요일 배포 금지\n자세한 설명은 위 제목을 참고.",
      },
      sourceUris: ["file:///ws/deploy-h3.md"],
      confidence: 1,
      status: "accepted",
    };
    expect(bestSnippet(card, "0755")).toContain("0755");
  });

  it("ask (e): 내용 토큰 2개 이상일 때 2개 미만 적중 카드는 기권한다", async () => {
    const locationKb: Kb = {
      cards: [
        {
          id: "c-loc",
          title: "회사 위치",
          fields: {
            content: "사무실은 서울 강남구에 있다.",
          },
          sourceUris: ["file:///ws/location.md"],
          confidence: 1,
          status: "accepted",
        },
      ],
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(locationKb, new Bm25RetrievalAdapter());
    const r = await svc.ask("회사 이름이 뭐야?");
    expect(r.abstained).toBe(true);
  });
});

