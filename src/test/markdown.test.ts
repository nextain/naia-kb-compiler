/** @spec SPEC-003 / TEST-F-003(보강) — Markdown 추출: 섹션 카드 + 엔티티·관계 그래프. */
import { describe, it, expect } from "vitest";
import { IngestAdapter } from "../adapters/ingest/text.js";
import { MarkdownExtractAdapter } from "../adapters/extract/markdown.js";

const MD = `# 넥스테인 소개
넥스테인은 **AI 메모리** 회사입니다.

## 제품
주력은 **naia** 이며 [홈페이지](https://nextain.io) 참조.

## 기술
**naia-memory** 와 **RAG** 를 결합한다.
`;

describe("MarkdownExtractAdapter", () => {
  it("헤딩→섹션 카드, 굵은 용어→Concept, 링크→Reference, 그래프 관계", async () => {
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "넥스테인", text: MD }]);
    const ex = await new MarkdownExtractAdapter().extract(sources);

    expect(ex.cards.length).toBeGreaterThanOrEqual(1); // 작은 섹션 병합(과편화 방지)
    expect(ex.entities.some((e) => e.type === "Topic")).toBe(true);
    expect(ex.entities.some((e) => e.type === "Concept" && e.name === "naia")).toBe(true);
    expect(ex.entities.some((e) => e.type === "Reference")).toBe(true);
    expect(ex.relations.some((r) => r.type === "mentions")).toBe(true);
    expect(ex.relations.some((r) => r.type === "references")).toBe(true);

    // 동일 개념 dedup (naia 한 번만)
    const naiaNodes = ex.entities.filter((e) => e.name === "naia");
    expect(naiaNodes).toHaveLength(1);
  });

  it("보일러플레이트·수치값은 Concept에서 제외(노이즈 허브 방지)", async () => {
    const md = `# 양식
| 항목 | 값 |
**작성일** 2026-06-16, **합계** **100억원**, **상태** 진행, 실제 개념은 **넥스테인** 과 **AGI**.
`;
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "양식", text: md }]);
    const ex = await new MarkdownExtractAdapter().extract(sources);
    const names = ex.entities.filter((e) => e.type === "Concept").map((e) => e.name);
    // 보일러플레이트/값 제외
    for (const noise of ["작성일", "합계", "100억원", "상태", "2026-06-16"]) {
      expect(names).not.toContain(noise);
    }
    // 진짜 개념은 유지
    expect(names).toContain("넥스테인");
    expect(names).toContain("AGI");
  });

  it("같은 섹션 공출현 Concept → co_occurs 관계(주제 군집)", async () => {
    const md = `## 기술
**naia** 와 **메모리** 를 함께 다룬다.
`;
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "co", text: md }]);
    const ex = await new MarkdownExtractAdapter(8, 1).extract(sources); // coOccurMin=1
    const co = ex.relations.filter((r) => r.type === "co_occurs");
    expect(co.length).toBeGreaterThanOrEqual(1);
    const naia = ex.entities.find((e) => e.name === "naia")!;
    const mem = ex.entities.find((e) => e.name === "메모리")!;
    const linked = co.some(
      (r) => (r.from === naia.id && r.to === mem.id) || (r.from === mem.id && r.to === naia.id),
    );
    expect(linked).toBe(true);
  });

  it("coOccurMin 미만 공출현은 co_occurs 제외(약한 신호 차단)", async () => {
    const md = `## 한섹션
**alpha** 와 **beta** 가 한 번만 함께 등장.
`;
    const sources = await new IngestAdapter().ingest([{ kind: "text", title: "weak", text: md }]);
    const ex = await new MarkdownExtractAdapter().extract(sources); // 기본 min=2, 공출현 1회
    expect(ex.relations.some((r) => r.type === "co_occurs")).toBe(false);
  });
});
