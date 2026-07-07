/* 지식 그래프 2D·3D 공용 — 군집 탐지 / 색 팔레트 / 관계 의미 사전. 의존성 0. */
(function (global) {
  // 관계 타입 → 색 + 사람용 의미(범례에 그대로 사용)
  const REL = {
    co_occurs: { color: "#5ad1a8", label: "함께 등장", desc: "같은 섹션에 같이 나옴 = 주제 연관(개념끼리 연결)" },
    mentions: { color: "#6f7891", label: "언급", desc: "문서 섹션이 그 개념을 언급" },
    references: { color: "#e0a24a", label: "링크 참조", desc: "문서 안 하이퍼링크" },
    default: { color: "#5a6273", label: "관계", desc: "" },
  };
  const relColor = (t) => (REL[t] || REL.default).color;

  // 군집 색 — 어두운 배경에서 잘 구분되는 밝은 톤
  const COMMUNITY_PALETTE = [
    "#4c8bf5", "#3fb950", "#a371f7", "#f778ba", "#e5984d", "#56d4dd", "#f5d44c", "#ff6b6b",
    "#9b8cff", "#4dd4ac", "#d98cff", "#ff9f5a", "#73c2ff", "#bce04f", "#ff7eb6", "#7ee0d0",
  ];
  const commColor = (i) => COMMUNITY_PALETTE[((i % COMMUNITY_PALETTE.length) + COMMUNITY_PALETTE.length) % COMMUNITY_PALETTE.length];

  // 라벨 전파(Label Propagation) 군집 탐지 — 의존성 0, 결정론(id 순서 고정 + 동률 시 작은 라벨 우선).
  // weight 있으면 가중. 반환: { comm:Map(id→0기반 군집idx), count, sizes:[], rep:Map(idx→대표노드id) }
  function detectCommunities(nodes, edges, opts = {}) {
    const iters = opts.iters ?? 14;
    const adj = new Map(nodes.map((n) => [n.id, []]));
    for (const e of edges) {
      if (!adj.has(e.from) || !adj.has(e.to)) continue;
      const w = e.weight || 1;
      adj.get(e.from).push([e.to, w]);
      adj.get(e.to).push([e.from, w]);
    }
    const order = nodes.map((n) => n.id);
    const label = new Map(order.map((id) => [id, id]));
    for (let it = 0; it < iters; it++) {
      let changed = false;
      for (const id of order) {
        const nb = adj.get(id);
        if (!nb.length) continue;
        const cnt = new Map();
        for (const [to, w] of nb) { const l = label.get(to); cnt.set(l, (cnt.get(l) || 0) + w); }
        let best = label.get(id), bv = -1;
        for (const [l, v] of cnt) { if (v > bv || (v === bv && String(l) < String(best))) { bv = v; best = l; } }
        if (best !== label.get(id)) { label.set(id, best); changed = true; }
      }
      if (!changed) break;
    }
    // 라벨 묶기 → 큰 군집 먼저(색 안정)
    const groups = new Map();
    for (const id of order) { const l = label.get(id); if (!groups.has(l)) groups.set(l, []); groups.get(l).push(id); }
    const deg = new Map(nodes.map((n) => [n.id, n.deg || 0]));
    const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
    const comm = new Map();
    const rep = new Map();
    sorted.forEach((ids, i) => {
      ids.forEach((id) => comm.set(id, i));
      rep.set(i, ids.slice().sort((a, b) => (deg.get(b) || 0) - (deg.get(a) || 0))[0]);
    });
    return { comm, count: sorted.length, sizes: sorted.map((g) => g.length), rep };
  }

  // 그래프 부가 통계 — 범례용. relCounts: 타입별 엣지수.
  function relCounts(edges) {
    const m = {};
    for (const e of edges) m[e.type] = (m[e.type] || 0) + 1;
    return m;
  }

  // 의미 범례 HTML — info(renderGraph 반환) 기반. "무엇을 뜻하는지" 설명 포함.
  function buildLegendHTML(info) {
    const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const comms = (info.communities || []).slice(0, 8).map((c) =>
      `<div class="row"><span class="dot" style="background:${c.color}"></span><b>군집 ${c.idx + 1}</b> <span class="mut">${c.size}개 · ${esc((c.rep || "").slice(0, 16))}</span></div>`).join("");
    const moreC = info.communityCount > 8 ? `<div class="mut sm">…외 ${info.communityCount - 8}개 군집</div>` : "";
    const rels = Object.entries(info.relCounts || {})
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => { const r = REL[t] || REL.default; return `<div class="row"><span class="line" style="background:${r.color}"></span><b>${r.label}</b> <span class="mut">${n}</span><div class="sm mut">${esc(r.desc)}</div></div>`; }).join("");
    return `
      <div class="lg-sec"><div class="lg-h">노드 색 = 주제 군집 <span class="mut sm">(자동 그룹핑)</span></div>${comms}${moreC}</div>
      <div class="lg-sec"><div class="lg-h">선 색 = 관계 종류</div>${rels}</div>
      <div class="lg-sec"><div class="lg-h">그 외</div>
        <div class="row"><span class="dot big"></span><b>크기</b> <span class="mut">= 연결 수(중요도)</span></div>
        <div class="row"><span class="shape">○</span><b>개념</b> · <span class="shape">◎</span><b>섹션</b> · <span class="shape">◇</span><b>링크</b></div>
        <div class="row mut sm">거리(가까움) ≈ 연관도 — 절대값 아닌 근사. 함께 등장할수록 당겨짐.</div>
      </div>`;
  }

  global.GRAPH_COMMON = { REL, relColor, COMMUNITY_PALETTE, commColor, detectCommunities, relCounts, buildLegendHTML };
})(typeof window !== "undefined" ? window : globalThis);
