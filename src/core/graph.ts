/** @spec SPEC-007 — 그래프 투영 유틸. 코어는 도메인을 모른다(분류 함수 주입).
 *
 * 위치·연락처처럼 **관계가 적은 목록형 지식**은 엔티티 간 의미 관계가 거의 없어 그래프가
 * "점만 흩어진다". 이때 항목을 분류 함수로 묶어 `루트 → 카테고리 → 항목` 허브-스포크로
 * 투영하면 구조가 보인다. (소비 응용의 분류 트리 그래프를 일반화 — 도메인 비종속.) */
import type { Entity, Relation, Kb } from "../domain/types.js";

export interface CategoryGraphOptions {
  rootId?: string;
  rootLabel?: string;
  maxLabel?: number; // 항목 라벨 최대 길이
}

/** 항목 배열을 `classify` 결과로 그룹핑해 허브-스포크 그래프 데이터로 투영.
 *  @param items   id + (title|name) 을 가진 항목들
 *  @param classify 항목 → 카테고리명 (도메인 규칙 — 소비자가 주입)
 *  @returns {entities, relations} = Kb 와 동일 형식의 경량 그래프 데이터(어느 그래프 백엔드로도 투영 가능) */
export function categoryGraph<T extends { id: string; title?: string; name?: string }>(
  items: T[],
  classify: (item: T) => string,
  opts: CategoryGraphOptions = {},
): { entities: Entity[]; relations: Relation[] } {
  const rootId = opts.rootId ?? "root";
  const maxLabel = opts.maxLabel ?? 24;
  const entities: Entity[] = [{ id: rootId, type: "root", name: opts.rootLabel ?? "전체" }];
  const relations: Relation[] = [];
  const catId: Record<string, string> = {};

  for (const it of items) {
    const cat = classify(it);
    if (!catId[cat]) {
      catId[cat] = `cat:${cat}`;
      entities.push({ id: catId[cat], type: "category", name: cat });
      relations.push({ from: rootId, to: catId[cat], type: "has_category" });
    }
    const label = String(it.title ?? it.name ?? it.id).slice(0, maxLabel);
    const nid = `item:${it.id}`;
    entities.push({ id: nid, type: cat, name: label });
    relations.push({ from: catId[cat], to: nid, type: "in_category" });
  }

  return { entities, relations };
}

// ── 시각화용 그래프 데이터(nodes/edges + degree + 군집) — 소비자(naia-os 2D/3D 뷰어 등)가 바로 렌더.
//    엔진의 examples/cms 뷰어가 인라인으로 하던 변환(name→label·deg 집계)+군집탐지를 재사용 가능 형태로 노출(D03).

export interface GraphNode {
  id: string;
  label: string; // = Entity.name (뷰어는 label 사용)
  type: string;
  deg: number; // 연결 수(중요도/크기)
  community: number; // 0기반 군집 idx(라벨 전파)
}
export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  weight: number; // 미설정 관계 = 1
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communityCount: number;
}

/** 라벨 전파 군집 탐지(의존성0·결정론 — id 순서 고정 + 동률 시 작은 라벨 우선). examples/cms graph-common.js 포팅. */
function detectCommunities(
  nodes: readonly { id: string }[],
  edges: readonly { from: string; to: string; weight: number }[],
  iters = 14,
): { comm: Map<string, number>; count: number } {
  const adj = new Map<string, [string, number][]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    const w = e.weight || 1;
    adj.get(e.from)!.push([e.to, w]);
    adj.get(e.to)!.push([e.from, w]);
  }
  const order = nodes.map((n) => n.id);
  const label = new Map<string, string>(order.map((id) => [id, id]));
  for (let it = 0; it < iters; it++) {
    let changed = false;
    for (const id of order) {
      const nb = adj.get(id)!;
      if (!nb.length) continue;
      const cnt = new Map<string, number>();
      for (const [to, w] of nb) {
        const l = label.get(to)!;
        cnt.set(l, (cnt.get(l) ?? 0) + w);
      }
      let best = label.get(id)!;
      let bv = -1;
      for (const [l, v] of cnt) {
        if (v > bv || (v === bv && l < best)) { bv = v; best = l; }
      }
      if (best !== label.get(id)) { label.set(id, best); changed = true; }
    }
    if (!changed) break;
  }
  const groups = new Map<string, string[]>();
  for (const id of order) {
    const l = label.get(id)!;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(id);
  }
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length); // 큰 군집 먼저(색 안정)
  const comm = new Map<string, number>();
  sorted.forEach((ids, i) => ids.forEach((id) => comm.set(id, i)));
  return { comm, count: sorted.length };
}

/** Kb(엔티티·관계) → 시각화 그래프 데이터(nodes/edges + degree + 군집). 댕글링 관계(미존재 엔티티)는 제외. */
export function toGraphData(kb: Kb): GraphData {
  const deg = new Map<string, number>(kb.entities.map((e) => [e.id, 0]));
  const edges: GraphEdge[] = [];
  for (const r of kb.relations) {
    if (!deg.has(r.from) || !deg.has(r.to)) continue; // 양끝 엔티티 실재해야 엣지
    deg.set(r.from, (deg.get(r.from) ?? 0) + 1);
    deg.set(r.to, (deg.get(r.to) ?? 0) + 1);
    edges.push({ from: r.from, to: r.to, type: r.type, weight: r.weight ?? 1 });
  }
  const base = kb.entities.map((e) => ({ id: e.id, label: e.name, type: e.type, deg: deg.get(e.id) ?? 0 }));
  const { comm, count } = detectCommunities(base, edges);
  const nodes: GraphNode[] = base.map((n) => ({ ...n, community: comm.get(n.id) ?? 0 }));
  return { nodes, edges, communityCount: count };
}
