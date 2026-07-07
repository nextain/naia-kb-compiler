/** @spec SPEC-006/SPEC-008 — openWorkspaceKnowledge: 워크스페이스 정본 로드 → search/ask 진입(통합 K1a 브릿지).
 *  naia-agent in-process 소비자가 쓸 단일 진입점의 계약: 파일 로드 → 색인 → 검색/질의/기권 관통. */
import { afterEach, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openWorkspaceKnowledge } from "../client.js";
import { WorkspaceStoreAdapter } from "../adapters/store/workspace-fs.js";
import type { Kb } from "../domain/types.js";

const kb: Kb = {
  cards: [
    { id: "c1", title: "여권 발급", fields: { content: "여권 발급 대상은 국민. 수수료는 53000원. 담당은 민원여권과." }, sourceUris: ["u1"], confidence: 1, status: "accepted" },
    { id: "c2", title: "전입신고", fields: { content: "전입신고 필요서류는 신분증. 담당은 주민센터." }, sourceUris: ["file:///ws/jeonipsingo.md"], confidence: 1, status: "accepted" },
  ],
  entities: [{ id: "e1", type: "Service", name: "전입신고" }],
  relations: [{ from: "e1", type: "handled_by", to: "e2", weight: 1 }],
};

describe("openWorkspaceKnowledge (통합 K1a 브릿지)", () => {
  const dirs: string[] = [];
  const seeded = async (): Promise<string> => {
    const d = await mkdtemp(join(tmpdir(), "kb-open-"));
    dirs.push(d);
    await new WorkspaceStoreAdapter({ dir: d }).save(kb);
    return d;
  };
  afterEach(async () => {
    while (dirs.length) await rm(dirs.pop() as string, { recursive: true, force: true });
  });

  it("정본 로드 → kb(엔티티/관계/카드) 그대로 반환", async () => {
    const { kb: loaded } = await openWorkspaceKnowledge(await seeded());
    expect(loaded).toEqual(kb);
  });

  it("search: 관련 카드 hit + sourceUris 보존(근거→원문 키)", async () => {
    const { service } = await openWorkspaceKnowledge(await seeded());
    const hits = await service.search("필요서류");
    expect(hits[0].title).toBe("전입신고");
    expect(hits[0].sourceUris).toContain("file:///ws/jeonipsingo.md");
  });

  it("ask: 근거 있으면 답변 + 출처(sourceUris)", async () => {
    const { service } = await openWorkspaceKnowledge(await seeded());
    const r = await service.ask("전입신고 필요서류?");
    expect(r.abstained).toBe(false);
    expect(r.answer).toContain("신분증");
    expect(r.sources.flatMap((s) => s.sourceUris)).toContain("file:///ws/jeonipsingo.md");
  });

  it("ask: 근거 없으면 기권(지어내지 않음, D05)", async () => {
    const { service } = await openWorkspaceKnowledge(await seeded());
    const r = await service.ask("우주선 발사 비용?");
    expect(r.abstained).toBe(true);
  });

  it("빈 워크스페이스(파일 없음) → 열림 + ask 기권", async () => {
    const d = await mkdtemp(join(tmpdir(), "kb-open-empty-"));
    dirs.push(d);
    const { kb: loaded, service } = await openWorkspaceKnowledge(d);
    expect(loaded).toEqual({ cards: [], entities: [], relations: [] });
    expect((await service.ask("아무거나")).abstained).toBe(true);
  });
});
