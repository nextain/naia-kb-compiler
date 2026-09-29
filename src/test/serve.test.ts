/** @spec SPEC-008 / TEST-F-008 — KnowledgeService 검색·질의응답 + 기권. */
import { describe, it, expect } from "vitest";
import { KnowledgeService, isServeReady, bestSnippet } from "../core/serve.js";
import { Bm25RetrievalAdapter } from "../adapters/retrieval/bm25.js";
import { MemoryRetrievalAdapter } from "../adapters/retrieval/memory.js";
import { IngestAdapter } from "../adapters/ingest/text.js";
import { MarkdownExtractAdapter } from "../adapters/extract/markdown.js";
import { contentQuery } from "../core/text.js";
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

  it("배포 규칙 카드: bestSnippet, search, ask에 0755가 있다", async () => {
    const card: ServiceCard = {
      id: "c-deploy",
      title: "배포 규칙",
      fields: {
        content: "## 배포 규칙\n\n- 배포는 0755 이후 금요일에 하지 않는다.",
      },
      sourceUris: ["file:///ws/deploy-rule.md"],
      confidence: 1,
      status: "accepted",
    };
    expect(bestSnippet(card, "배포 규칙")).toBe("- 배포는 0755 이후 금요일에 하지 않는다.");

    const deployKb: Kb = { cards: [card], entities: [], relations: [] };
    for (const Adapter of [Bm25RetrievalAdapter, MemoryRetrievalAdapter]) {
      const svc = await KnowledgeService.create(deployKb, new Adapter());
      const hits = await svc.search("배포 규칙");
      expect(hits[0].snippet).toContain("0755");

      const asked = await svc.ask("배포 규칙이 뭐였지?");
      expect(asked.abstained).toBe(false);
      expect(asked.answer).toContain("0755");
    }
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

  it("## 환불 / --- / 문의는 고객센터로.: 질의 환불 → 문의는 고객센터로.(라벨 제목 아래 첫 내용 줄)", () => {
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
    expect(bestSnippet(card, "환불")).toBe("문의는 고객센터로.");
  });

  it("### 0755 이후 금요일 배포 금지 / 자세한 설명은 위 제목을 참고.: 질의 0755 → 제목 줄", () => {
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
    expect(bestSnippet(card, "0755")).toBe("### 0755 이후 금요일 배포 금지");
  });

  it("### 0755 이후 금요일 배포 금지 / 배포 문서는 위키에 있다.: 질의 배포 → 결과에 0755가 있다", () => {
    const card: ServiceCard = {
      id: "c-deploy-h3-wiki",
      title: "배포 금지 안내",
      fields: {
        content: "### 0755 이후 금요일 배포 금지\n배포 문서는 위키에 있다.",
      },
      sourceUris: ["file:///ws/deploy-h3-wiki.md"],
      confidence: 1,
      status: "accepted",
    };
    expect(bestSnippet(card, "배포")).toContain("0755");
  });

  it("## 환불은 7일 이내 / 환불 문의는 고객센터.: ask('환불 알려줘') → 7일", async () => {
    const card: ServiceCard = {
      id: "c-refund-7d",
      title: "환불 안내",
      fields: {
        content: "## 환불은 7일 이내\n환불 문의는 고객센터.",
      },
      sourceUris: ["file:///ws/refund-7d.md"],
      confidence: 1,
      status: "accepted",
    };
    const kbRefund: Kb = { cards: [card], entities: [], relations: [] };
    for (const Adapter of [Bm25RetrievalAdapter, MemoryRetrievalAdapter]) {
      const svc = await KnowledgeService.create(kbRefund, new Adapter());
      const asked = await svc.ask("환불 알려줘");
      expect(asked.abstained).toBe(false);
      expect(asked.answer).toContain("7일");
    }
  });

  it("## 배포 규칙은 0755 이후 금지 / 배포 예외는 없다.: ask('배포 규칙이 뭐야?') → 0755", async () => {
    const card: ServiceCard = {
      id: "c-deploy-0755-noexc",
      title: "배포 규칙",
      fields: {
        content: "## 배포 규칙은 0755 이후 금지\n배포 예외는 없다.",
      },
      sourceUris: ["file:///ws/deploy-rule-noexc.md"],
      confidence: 1,
      status: "accepted",
    };
    const kbDeploy: Kb = { cards: [card], entities: [], relations: [] };
    for (const Adapter of [Bm25RetrievalAdapter, MemoryRetrievalAdapter]) {
      const svc = await KnowledgeService.create(kbDeploy, new Adapter());
      const asked = await svc.ask("배포 규칙이 뭐야?");
      expect(asked.abstained).toBe(false);
      expect(asked.answer).toContain("0755");
    }
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

  it("회사 규모 (직원 15명.) 카드만 있으면 기권하고, 회사명 카드가 함께 있으면 카드 순서와 무관하게 넥스테인을 반환한다", async () => {
    const countCard: ServiceCard = {
      id: "c-count",
      title: "회사 규모",
      fields: { content: "직원 15명." },
      sourceUris: ["file:///ws/count.md"],
      confidence: 1,
      status: "accepted",
    };
    const nameCard: ServiceCard = {
      id: "c-name",
      title: "회사 소개",
      fields: { content: "회사명은 넥스테인이다." },
      sourceUris: ["file:///ws/name.md"],
      confidence: 1,
      status: "accepted",
    };

    // 1. 직원 15명 카드만 있으면 기권
    const kbOnlyCount: Kb = { cards: [countCard], entities: [], relations: [] };
    const svc1 = await KnowledgeService.create(kbOnlyCount, new Bm25RetrievalAdapter());
    expect((await svc1.ask("회사 이름이 뭐야?")).abstained).toBe(true);
    const svcMem1 = await KnowledgeService.create(kbOnlyCount, new MemoryRetrievalAdapter());
    expect((await svcMem1.ask("회사 이름이 뭐야?")).abstained).toBe(true);

    // 2. 직원 15명 카드 + 회사명 카드 (순서 1)
    const kbOrder1: Kb = { cards: [countCard, nameCard], entities: [], relations: [] };
    const svc2 = await KnowledgeService.create(kbOrder1, new Bm25RetrievalAdapter());
    const r2 = await svc2.ask("회사 이름이 뭐야?");
    expect(r2.abstained).toBe(false);
    expect(r2.answer).toContain("넥스테인");
    const svcMem2 = await KnowledgeService.create(kbOrder1, new MemoryRetrievalAdapter());
    const rm2 = await svcMem2.ask("회사 이름이 뭐야?");
    expect(rm2.abstained).toBe(false);
    expect(rm2.answer).toContain("넥스테인");

    // 3. 회사명 카드 + 직원 15명 카드 (순서 2)
    const kbOrder2: Kb = { cards: [nameCard, countCard], entities: [], relations: [] };
    const svc3 = await KnowledgeService.create(kbOrder2, new Bm25RetrievalAdapter());
    const r3 = await svc3.ask("회사 이름이 뭐야?");
    expect(r3.abstained).toBe(false);
    expect(r3.answer).toContain("넥스테인");
    const svcMem3 = await KnowledgeService.create(kbOrder2, new MemoryRetrievalAdapter());
    const rm3 = await svcMem3.ask("회사 이름이 뭐야?");
    expect(rm3.abstained).toBe(false);
    expect(rm3.answer).toContain("넥스테인");
  });

  it("회사 파일명은 readme.md 카드만 있으면 ask('회사 이름이 뭐야?')는 기권한다", async () => {
    const fileKb: Kb = {
      cards: [
        {
          id: "c-file",
          title: "회사 파일",
          fields: { content: "회사 파일명은 readme.md" },
          sourceUris: ["file:///ws/file.md"],
          confidence: 1,
          status: "accepted",
        },
      ],
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(fileKb, new Bm25RetrievalAdapter());
    expect((await svc.ask("회사 이름이 뭐야?")).abstained).toBe(true);

    const svcMem = await KnowledgeService.create(fileKb, new MemoryRetrievalAdapter());
    expect((await svcMem.ask("회사 이름이 뭐야?")).abstained).toBe(true);
  });

  it("여권 카드에서 얼마야/뭐였지/얼마예요는 53000을 담고, 누구지는 민원여권과를 담는다", async () => {
    const passportKb: Kb = {
      cards: [
        {
          id: "c-pass",
          title: "여권 발급",
          fields: { content: "수수료는 53000원.\n담당은 민원여권과." },
          sourceUris: ["file:///ws/pass.md"],
          confidence: 1,
          status: "accepted",
        },
      ],
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(passportKb, new Bm25RetrievalAdapter());

    const r1 = await svc.ask("수수료는 얼마야?");
    expect(r1.abstained).toBe(false);
    expect(r1.answer).toContain("53000");

    const r2 = await svc.ask("수수료가 뭐였지?");
    expect(r2.abstained).toBe(false);
    expect(r2.answer).toContain("53000");

    const r3 = await svc.ask("수수료가 얼마예요?");
    expect(r3.abstained).toBe(false);
    expect(r3.answer).toContain("53000");

    const r4 = await svc.ask("담당 누구지?");
    expect(r4.abstained).toBe(false);
    expect(r4.answer).toContain("민원여권과");
  });

  it("## 환불은 7일 이내 / 규정이 있어서 확인이 필요하다. 카드에서 search 스니펫과 ask answer에 둘 다 7일이 있다", async () => {
    const refundCard: ServiceCard = {
      id: "c-refund-7",
      title: "환불 규정",
      fields: { content: "## 환불은 7일 이내\n규정이 있어서 확인이 필요하다." },
      sourceUris: ["file:///ws/refund7.md"],
      confidence: 1,
      status: "accepted",
    };
    const refundKb: Kb = {
      cards: [refundCard],
      entities: [],
      relations: [],
    };
    const svc = await KnowledgeService.create(refundKb, new Bm25RetrievalAdapter());

    const hits = await svc.search("환불 있어?");
    expect(hits[0].snippet).toContain("7일");

    const asked = await svc.ask("환불 있어?");
    expect(asked.abstained).toBe(false);
    expect(asked.answer).toContain("7일");

    // idempotent 확인: search와 ask의 스니펫이 동일
    expect(bestSnippet(refundCard, "환불 있어?")).toBe("## 환불은 7일 이내");
    expect(bestSnippet(refundCard, "환불 있어?")).toBe(bestSnippet(refundCard, contentQuery("환불 있어?")));
  });

  it("MarkdownExtractAdapter로 만든 회사 소개.md: ask('회사 이름이 뭐야?') → 넥스테인이 있고 2020은 없다", async () => {
    const md = `이 회사는 2020년에 시작했다.

## 회사명
넥스테인

## 위치
서울 강남구
`;
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "회사 소개", text: md }]);
    const extracted = await new MarkdownExtractAdapter().extract(sources);
    const companyKb: Kb = {
      cards: extracted.cards,
      entities: extracted.entities,
      relations: extracted.relations,
    };
    for (const Adapter of [Bm25RetrievalAdapter, MemoryRetrievalAdapter]) {
      const svc = await KnowledgeService.create(companyKb, new Adapter());
      const asked = await svc.ask("회사 이름이 뭐야?");
      expect(asked.abstained).toBe(false);
      expect(asked.answer).toContain("넥스테인");
      expect(asked.answer).not.toContain("2020");
    }
  });

  it("## 나이아 제품 전시 소개 / 본 회사의 첫 데모.: search('default 회사 제품 전시 소개') 스니펫 → 제목 줄", async () => {
    const card: ServiceCard = {
      id: "c-naia-demo",
      title: "제품 전시 소개",
      fields: {
        content: "## 나이아 제품 전시 소개\n본 회사의 첫 데모.",
      },
      sourceUris: ["file:///ws/naia-demo.md"],
      confidence: 1,
      status: "accepted",
    };
    const naiaKb: Kb = { cards: [card], entities: [], relations: [] };
    for (const Adapter of [Bm25RetrievalAdapter, MemoryRetrievalAdapter]) {
      const svc = await KnowledgeService.create(naiaKb, new Adapter());
      const hits = await svc.search("default 회사 제품 전시 소개");
      expect(hits[0].snippet).toBe("## 나이아 제품 전시 소개");
    }
  });

  it("답 유지(f1ceb07이 답하던 것): 위치 카드 어디/어디예요, 여권 카드 얼마죠/누구예요/누구, 배포 카드 배포 가능해", async () => {
    const locCard: ServiceCard = {
      id: "c-loc",
      title: "회사 위치",
      fields: { content: "사무실은 서울 강남구에 있다." },
      sourceUris: ["file:///ws/loc.md"],
      confidence: 1,
      status: "accepted",
    };
    const passCard: ServiceCard = {
      id: "c-pass",
      title: "여권 발급",
      fields: { content: "여권 발급 대상은 국민. 수수료는 53000원. 담당은 민원여권과." },
      sourceUris: ["file:///ws/pass.md"],
      confidence: 1,
      status: "accepted",
    };
    const depCard: ServiceCard = {
      id: "c-dep",
      title: "배포 규칙",
      fields: { content: "## 배포 규칙\n- 배포는 0755 이후 금요일에 하지 않는다." },
      sourceUris: ["file:///ws/dep.md"],
      confidence: 1,
      status: "accepted",
    };

    for (const Adapter of [Bm25RetrievalAdapter, MemoryRetrievalAdapter]) {
      // 위치 카드
      const locSvc = await KnowledgeService.create({ cards: [locCard], entities: [], relations: [] }, new Adapter());
      const rLoc1 = await locSvc.ask("회사 어디?");
      expect(rLoc1.abstained).toBe(false);
      expect(rLoc1.answer).toContain("강남구");

      const rLoc2 = await locSvc.ask("사무실 어디예요?");
      expect(rLoc2.abstained).toBe(false);
      expect(rLoc2.answer).toContain("강남구");

      // 여권 카드
      const passSvc = await KnowledgeService.create({ cards: [passCard], entities: [], relations: [] }, new Adapter());
      const rPass1 = await passSvc.ask("수수료는 얼마죠?");
      expect(rPass1.abstained).toBe(false);
      expect(rPass1.answer).toContain("53000");

      const rPass2 = await passSvc.ask("담당은 누구예요?");
      expect(rPass2.abstained).toBe(false);
      expect(rPass2.answer).toContain("민원여권과");

      const rPass3 = await passSvc.ask("담당 누구?");
      expect(rPass3.abstained).toBe(false);
      expect(rPass3.answer).toContain("민원여권과");

      // 배포 카드
      const depSvc = await KnowledgeService.create({ cards: [depCard], entities: [], relations: [] }, new Adapter());
      const rDep = await depSvc.ask("배포 가능해?");
      expect(rDep.abstained).toBe(false);
    }
  });
});

