/* 지식 그래프 2D 렌더러 (의존성 0). 군집 색 + 관계타입 색/굵기 + 분리력 + hover.
   renderGraph(canvas, {nodes,edges}, opts) → { reheat, info }. opts.onHover(node|null). */
(function (global) {
  const GC = global.GRAPH_COMMON;

  function renderGraph(canvas, data, opts = {}) {
    const ctx = canvas.getContext("2d");
    const DPR = global.devicePixelRatio || 1;
    function resize() { const r = canvas.getBoundingClientRect(); canvas.width = r.width * DPR; canvas.height = r.height * DPR; }
    resize();
    global.addEventListener("resize", () => { resize(); });
    const W = () => canvas.width / DPR, H = () => canvas.height / DPR;

    // 군집 탐지(색·분리)
    const { comm, count: commCount, sizes, rep } = GC.detectCommunities(data.nodes, data.edges);
    const nodeColor = (n) => GC.commColor(comm.get(n.id) ?? 0);

    // 노드 초기화 — 군집별로 방사 위치에 모아 시작(수렴 빠름)
    const nodes = data.nodes.map((n, i) => {
      const c = comm.get(n.id) ?? 0;
      const ca = (c / Math.max(1, commCount)) * Math.PI * 2;
      const R = Math.min(W(), H()) * 0.32;
      const jx = (Math.cos(i * 12.9898) * 43758.5453) % 1, jy = (Math.cos(i * 78.233) * 43758.5453) % 1;
      return { ...n, c, x: W() / 2 + Math.cos(ca) * R + jx * 60, y: H() / 2 + Math.sin(ca) * R + jy * 60, vx: 0, vy: 0, deg: n.deg || 0 };
    });
    const idx = new Map(nodes.map((n) => [n.id, n]));
    const edges = data.edges.filter((e) => idx.has(e.from) && idx.has(e.to));
    const maxDeg = Math.max(1, ...nodes.map((n) => n.deg));
    const maxW = Math.max(1, ...edges.map((e) => e.weight || 1));
    const radius = (n) => 4 + 9 * Math.sqrt(n.deg / maxDeg);

    let scale = 1, ox = 0, oy = 0, hover = null, drag = null, panning = false, lastM = null;
    const adj = new Map(nodes.map((n) => [n.id, new Set()]));
    edges.forEach((e) => { adj.get(e.from).add(e.to); adj.get(e.to).add(e.from); });

    // 물리 — 반발 + 스프링 + 중심 + 군집 centroid 인력(군집 분리)
    const REP = opts.repulsion ?? 5200, SPR = 0.02, LEN = 64, DAMP = 0.86, CEN = 0.006, COMM = 0.025;
    let alpha = 1;
    const cen = []; // 군집 centroid
    function step() {
      if (alpha < 0.02) return;
      for (let c = 0; c < commCount; c++) cen[c] = { x: 0, y: 0, n: 0 };
      for (const n of nodes) { const g = cen[n.c]; if (g) { g.x += n.x; g.y += n.y; g.n++; } }
      for (let c = 0; c < commCount; c++) if (cen[c].n) { cen[c].x /= cen[c].n; cen[c].y /= cen[c].n; }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01;
          const f = (REP * alpha) / d2, d = Math.sqrt(d2), fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        a.vx += (W() / 2 - a.x) * CEN * alpha;
        a.vy += (H() / 2 - a.y) * CEN * alpha;
        const g = cen[a.c];
        if (g) { a.vx += (g.x - a.x) * COMM * alpha; a.vy += (g.y - a.y) * COMM * alpha; }
      }
      edges.forEach((e) => {
        const a = idx.get(e.from), b = idx.get(e.to);
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const k = e.type === "co_occurs" ? SPR * 1.6 : SPR; // 공출현은 더 강하게 묶음
        const f = (d - LEN) * k * alpha, fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      });
      nodes.forEach((n) => { if (n === drag) return; n.vx *= DAMP; n.vy *= DAMP; n.x += n.vx; n.y += n.vy; });
      alpha *= 0.985;
    }

    const tx = (x) => x * scale + ox, ty = (y) => y * scale + oy;
    const inv = (mx, my) => ({ x: (mx - ox) / scale, y: (my - oy) / scale });

    function drawNode(n, r, dim) {
      const col = nodeColor(n), X = tx(n.x), Y = ty(n.y), R = r * scale;
      ctx.globalAlpha = dim ? 0.22 : 1;
      if (n === hover || n.deg / maxDeg > 0.6) { ctx.shadowColor = col; ctx.shadowBlur = n === hover ? 18 : 8; }
      if (n.type === "Topic") { // 섹션/문서 = 링(반투명 채움 + 굵은 테두리)
        ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2);
        ctx.fillStyle = col + "33"; ctx.fill();
        ctx.lineWidth = Math.max(1.4, R * 0.28); ctx.strokeStyle = col; ctx.stroke();
      } else if (n.type === "Reference") { // 링크 = 다이아몬드
        ctx.beginPath(); ctx.moveTo(X, Y - R); ctx.lineTo(X + R, Y); ctx.lineTo(X, Y + R); ctx.lineTo(X - R, Y); ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
      } else { // 개념 = 채운 원
        ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    function draw() {
      ctx.save(); ctx.scale(DPR, DPR);
      ctx.clearRect(0, 0, W(), H());
      ctx.fillStyle = "#0b0d11"; ctx.fillRect(0, 0, W(), H());
      const hl = hover ? adj.get(hover.id) : null;
      // edges — 타입 색 + weight 굵기
      edges.forEach((e) => {
        const a = idx.get(e.from), b = idx.get(e.to);
        const on = hover && (e.from === hover.id || e.to === hover.id);
        const base = GC.relColor(e.type);
        const wgt = 0.5 + 1.6 * Math.sqrt((e.weight || 1) / maxW);
        ctx.beginPath(); ctx.moveTo(tx(a.x), ty(a.y)); ctx.lineTo(tx(b.x), ty(b.y));
        ctx.strokeStyle = on ? base : base + (e.type === "co_occurs" ? "44" : "22");
        ctx.lineWidth = on ? wgt + 1 : wgt;
        ctx.stroke();
      });
      // nodes
      nodes.forEach((n) => { const dim = hover && n !== hover && !(hl && hl.has(n.id)); drawNode(n, radius(n), dim); });
      // labels — 허브 또는 hover 이웃
      nodes.forEach((n) => {
        const dim = hover && n !== hover && !(hl && hl.has(n.id));
        if ((n.deg / maxDeg > 0.32 || n === hover || (hl && hl.has(n.id))) && scale > 0.5) {
          const r = radius(n);
          ctx.fillStyle = dim ? "rgba(230,232,235,0.25)" : "#eef0f3";
          ctx.font = `${Math.min(13, 9 + r * 0.3)}px system-ui,'Noto Sans KR'`;
          ctx.fillText(String(n.label).slice(0, 24), tx(n.x) + r * scale + 4, ty(n.y) + 4);
        }
      });
      ctx.restore();
    }

    let running = true;
    function loop() { if (!running) return; step(); draw(); requestAnimationFrame(loop); }
    loop();

    function nodeAt(mx, my) {
      const p = inv(mx, my); let best = null, bd = 1e9;
      nodes.forEach((n) => { const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2; if (d < bd && d < (radius(n) + 6) ** 2) { bd = d; best = n; } });
      return best;
    }
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag) { const p = inv(mx, my); drag.x = p.x; drag.y = p.y; drag.vx = drag.vy = 0; alpha = Math.max(alpha, 0.3); }
      else if (panning && lastM) { ox += mx - lastM.x; oy += my - lastM.y; lastM = { x: mx, y: my }; }
      else {
        const h = nodeAt(mx, my);
        if (h !== hover) { hover = h; if (opts.onHover) opts.onHover(h && { label: h.label, type: h.type, comm: h.c, deg: h.deg }); }
        canvas.style.cursor = hover ? "pointer" : "grab";
      }
    });
    canvas.addEventListener("mousedown", (e) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, n = nodeAt(mx, my);
      if (n) drag = n; else { panning = true; lastM = { x: mx, y: my }; }
    });
    global.addEventListener("mouseup", () => { drag = null; panning = false; });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, f = e.deltaY < 0 ? 1.1 : 0.9;
      ox = mx - (mx - ox) * f; oy = my - (my - oy) * f; scale *= f;
    }, { passive: false });

    const info = {
      communityCount: commCount,
      communities: Array.from({ length: commCount }, (_, i) => ({
        idx: i, color: GC.commColor(i), size: sizes[i],
        rep: (idx.get(rep.get(i)) || {}).label || "",
      })),
      relCounts: GC.relCounts(edges),
      nodeCount: nodes.length, edgeCount: edges.length,
    };
    return { reheat: () => { alpha = 1; }, stop: () => { running = false; }, info };
  }

  global.renderGraph = renderGraph;
})(window);
