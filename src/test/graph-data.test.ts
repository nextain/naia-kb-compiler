/** @spec SPEC-007 — toGraphData: Kb → 시각화 그래프(nodes/edges + degree + 군집). K3 뷰어 데이터 계약. */
import { describe, it, expect } from "vitest";
import { toGraphData } from "../core/graph.js";
import type { Kb } from "../domain/types.js";

const kb: Kb = {
  cards: [],
  entities: [
    { id: "a", type: "Service", name: "전입신고" },
    { id: "b", type: "Department", name: "주민센터" },
    { id: "c", type: "Document", name: "신분증" },
    { id: "x", type: "Service", name: "여권" }, // 분리(연결 없음)
  ],
  relations: [
    { from: "a", type: "handled_by", to: "b" },
    { from: "a", type: "requires_document", to: "c", weight: 2 },
    { from: "a", type: "refers_to", to: "zzz" }, // 댕글링(zzz 미존재) → 엣지 제외
  ],
};

describe("toGraphData (K3 그래프 데이터)", () => {
  const g = toGraphData(kb);

  it("entities→nodes: label=name·type·deg", () => {
    const a = g.nodes.find((n) => n.id === "a")!;
    expect(a.label).toBe("전입신고");
    expect(a.type).toBe("Service");
    expect(a.deg).toBe(2); // b, c 두 관계(zzz 댕글링 제외)
    expect(g.nodes.find((n) => n.id === "b")!.deg).toBe(1);
  });

  it("relations→edges: 양끝 실재만(댕글링 제외) + weight 기본 1", () => {
    expect(g.edges).toHaveLength(2); // zzz 댕글링 제외
    const ac = g.edges.find((e) => e.to === "c")!;
    expect(ac.weight).toBe(2);
    expect(g.edges.find((e) => e.to === "b")!.weight).toBe(1); // 미설정=1
    expect(g.edges.some((e) => e.to === "zzz")).toBe(false);
  });

  it("군집: 연결된 a/b/c = 한 군집, 분리된 x = 별 군집", () => {
    const ca = g.nodes.find((n) => n.id === "a")!.community;
    expect(g.nodes.find((n) => n.id === "b")!.community).toBe(ca);
    expect(g.nodes.find((n) => n.id === "c")!.community).toBe(ca);
    expect(g.nodes.find((n) => n.id === "x")!.community).not.toBe(ca);
    expect(g.communityCount).toBeGreaterThanOrEqual(2);
  });

  it("빈 Kb → 빈 그래프", () => {
    const e = toGraphData({ cards: [], entities: [], relations: [] });
    expect(e.nodes).toHaveLength(0);
    expect(e.edges).toHaveLength(0);
    expect(e.communityCount).toBe(0);
  });
});
