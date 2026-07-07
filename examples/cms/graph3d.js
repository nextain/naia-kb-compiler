/* 지식 그래프 3D 렌더러 (의존성 0, WebGL 없이 캔버스에 3D force 투영).
   회전 궤도 + 자동회전 + 원근 깊이감(원근 크기/알파) + 군집 색.
   renderGraph3D(canvas, {nodes,edges}, opts) → { reheat, info }. opts.onHover(node|null). */
(function (global) {
  const GC = global.GRAPH_COMMON;

  function renderGraph3D(canvas, data, opts = {}) {
    const ctx = canvas.getContext("2d");
    const DPR = global.devicePixelRatio || 1;
    function resize() { const r = canvas.getBoundingClientRect(); canvas.width = r.width * DPR; canvas.height = r.height * DPR; }
    resize();
    global.addEventListener("resize", () => resize());
    const W = () => canvas.width / DPR, H = () => canvas.height / DPR;

    const { comm, count: commCount, sizes, rep } = GC.detectCommunities(data.nodes, data.edges);
    const nodeColor = (n) => GC.commColor(comm.get(n.id) ?? 0);

    // 3D 초기 배치 — 군집별 구면 클러스터
    const S = 260;
    const nodes = data.nodes.map((n, i) => {
      const c = comm.get(n.id) ?? 0;
      const ca = (c / Math.max(1, commCount)) * Math.PI * 2;
      const rnd = (k) => ((Math.cos((i + 1) * k) * 43758.5453) % 1);
      const cx = Math.cos(ca) * S * 0.7, cy = (rnd(12.9) ) * S * 0.6, cz = Math.sin(ca) * S * 0.7;
      return { ...n, c, x: cx + rnd(3.1) * 90, y: cy + rnd(7.7) * 90, z: cz + rnd(5.3) * 90, vx: 0, vy: 0, vz: 0, deg: n.deg || 0, _sx: 0, _sy: 0, _sr: 0, _d: 1 };
    });
    const idx = new Map(nodes.map((n) => [n.id, n]));
    const edges = data.edges.filter((e) => idx.has(e.from) && idx.has(e.to));
    const maxDeg = Math.max(1, ...nodes.map((n) => n.deg));
    const maxW = Math.max(1, ...edges.map((e) => e.weight || 1));
    const baseR = (n) => 3 + 8 * Math.sqrt(n.deg / maxDeg);
    const adj = new Map(nodes.map((n) => [n.id, new Set()]));
    edges.forEach((e) => { adj.get(e.from).add(e.to); adj.get(e.to).add(e.from); });

    // 물리 (3D)
    const REP = opts.repulsion ?? 9000, SPR = 0.02, LEN = 70, DAMP = 0.85, CEN = 0.005, COMM = 0.02;
    let alpha = 1;
    const cen = [];
    function step() {
      if (alpha < 0.02) return;
      for (let c = 0; c < commCount; c++) cen[c] = { x: 0, y: 0, z: 0, n: 0 };
      for (const n of nodes) { const g = cen[n.c]; if (g) { g.x += n.x; g.y += n.y; g.z += n.z; g.n++; } }
      for (let c = 0; c < commCount; c++) if (cen[c].n) { cen[c].x /= cen[c].n; cen[c].y /= cen[c].n; cen[c].z /= cen[c].n; }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d2 = dx * dx + dy * dy + dz * dz + 0.01;
          const f = (REP * alpha) / d2, d = Math.sqrt(d2), fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
          a.vx += fx; a.vy += fy; a.vz += fz; b.vx -= fx; b.vy -= fy; b.vz -= fz;
        }
        a.vx += -a.x * CEN * alpha; a.vy += -a.y * CEN * alpha; a.vz += -a.z * CEN * alpha;
        const g = cen[a.c]; if (g) { a.vx += (g.x - a.x) * COMM * alpha; a.vy += (g.y - a.y) * COMM * alpha; a.vz += (g.z - a.z) * COMM * alpha; }
      }
      edges.forEach((e) => {
        const a = idx.get(e.from), b = idx.get(e.to);
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
        const k = e.type === "co_occurs" ? SPR * 1.6 : SPR, f = (d - LEN) * k * alpha;
        const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
        a.vx += fx; a.vy += fy; a.vz += fz; b.vx -= fx; b.vy -= fy; b.vz -= fz;
      });
      nodes.forEach((n) => { if (n === drag) return; n.vx *= DAMP; n.vy *= DAMP; n.vz *= DAMP; n.x += n.vx; n.y += n.vy; n.z += n.vz; });
      alpha *= 0.99;
    }

    // 카메라 — 궤도(yaw/pitch) + 거리(zoom)
    let yaw = 0.6, pitch = 0.35, dist = 720, autorot = true;
    const focal = 620;
    function project(n) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = n.x * cy - n.z * sy, z1 = n.x * sy + n.z * cy, y1 = n.y;
      const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp;
      const dcam = dist - z2;            // 카메라까지 깊이(작을수록 가까움)
      const persp = focal / Math.max(60, dcam);
      return { sx: W() / 2 + x1 * persp, sy: H() / 2 - y2 * persp, persp, dcam };
    }

    let hover = null, drag = null, lastM = null, dragging = false;
    function draw() {
      ctx.save(); ctx.scale(DPR, DPR);
      // 배경 — 가벼운 비네팅으로 입체감
      const g = ctx.createRadialGradient(W() / 2, H() / 2, 40, W() / 2, H() / 2, Math.max(W(), H()) * 0.75);
      g.addColorStop(0, "#11141b"); g.addColorStop(1, "#070809");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W(), H());

      for (const n of nodes) { const p = project(n); n._sx = p.sx; n._sy = p.sy; n._sr = baseR(n) * p.persp; n._d = p.dcam; }
      const dmin = Math.min(...nodes.map((n) => n._d)), dmax = Math.max(...nodes.map((n) => n._d));
      const depth = (d) => 1 - Math.min(1, Math.max(0, (d - dmin) / (dmax - dmin + 1))); // 1=가까움
      const hl = hover ? adj.get(hover.id) : null;

      // edges (먼 것부터)
      const drawEdges = edges.map((e) => { const a = idx.get(e.from), b = idx.get(e.to); return { e, a, b, d: (a._d + b._d) / 2 }; }).sort((x, y) => y.d - x.d);
      for (const { e, a, b } of drawEdges) {
        const on = hover && (e.from === hover.id || e.to === hover.id);
        const t = depth((a._d + b._d) / 2), base = GC.relColor(e.type);
        const al = on ? 0.85 : (0.06 + 0.22 * t) * (e.type === "co_occurs" ? 1.3 : 1);
        ctx.globalAlpha = Math.min(1, al);
        ctx.strokeStyle = base; ctx.lineWidth = (0.5 + 1.6 * Math.sqrt((e.weight || 1) / maxW)) * (on ? 1.8 : 1);
        ctx.beginPath(); ctx.moveTo(a._sx, a._sy); ctx.lineTo(b._sx, b._sy); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // nodes (먼 것부터 — 가까운 게 위에)
      const order = nodes.slice().sort((a, b) => b._d - a._d);
      for (const n of order) {
        const t = depth(n._d), dim = hover && n !== hover && !(hl && hl.has(n.id));
        const col = nodeColor(n), R = Math.max(1.2, n._sr);
        ctx.globalAlpha = dim ? 0.18 : (0.45 + 0.55 * t);
        if (n === hover || n.deg / maxDeg > 0.5) { ctx.shadowColor = col; ctx.shadowBlur = (n === hover ? 22 : 10) * t; }
        if (n.type === "Topic") {
          ctx.beginPath(); ctx.arc(n._sx, n._sy, R, 0, Math.PI * 2); ctx.fillStyle = col + "33"; ctx.fill();
          ctx.lineWidth = Math.max(1.2, R * 0.28); ctx.strokeStyle = col; ctx.stroke();
        } else if (n.type === "Reference") {
          ctx.beginPath(); ctx.moveTo(n._sx, n._sy - R); ctx.lineTo(n._sx + R, n._sy); ctx.lineTo(n._sx, n._sy + R); ctx.lineTo(n._sx - R, n._sy); ctx.closePath();
          ctx.fillStyle = col; ctx.fill();
        } else { ctx.beginPath(); ctx.arc(n._sx, n._sy, R, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); }
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      // labels — 가까운 허브 + hover 이웃
      for (const n of order) {
        const dim = hover && n !== hover && !(hl && hl.has(n.id)), t = depth(n._d);
        if ((n.deg / maxDeg > 0.4 && t > 0.45) || n === hover || (hl && hl.has(n.id))) {
          ctx.fillStyle = dim ? "rgba(230,232,235,0.25)" : "#eef0f3";
          ctx.font = `${Math.min(13, 9 + n._sr * 0.25)}px system-ui,'Noto Sans KR'`;
          ctx.fillText(String(n.label).slice(0, 22), n._sx + n._sr + 4, n._sy + 4);
        }
      }
      ctx.restore();
    }

    let running = true;
    function frame() { if (!running) return; if (autorot && !dragging) yaw += 0.0035; step(); draw(); requestAnimationFrame(frame); }
    frame();

    function nodeAt(mx, my) { let best = null, bd = 1e9; for (const n of nodes) { const d = (n._sx - mx) ** 2 + (n._sy - my) ** 2; if (d < bd && d < (n._sr + 7) ** 2) { bd = d; best = n; } } return best; }
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (dragging && lastM) { yaw += (mx - lastM.x) * 0.008; pitch += (my - lastM.y) * 0.008; pitch = Math.max(-1.4, Math.min(1.4, pitch)); lastM = { x: mx, y: my }; }
      else { const h = nodeAt(mx, my); if (h !== hover) { hover = h; if (opts.onHover) opts.onHover(h && { label: h.label, type: h.type, comm: h.c, deg: h.deg }); } canvas.style.cursor = hover ? "pointer" : "grab"; }
    });
    canvas.addEventListener("mousedown", (e) => { const r = canvas.getBoundingClientRect(); lastM = { x: e.clientX - r.left, y: e.clientY - r.top }; dragging = true; autorot = false; });
    global.addEventListener("mouseup", () => { dragging = false; });
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.max(220, Math.min(1600, dist * (e.deltaY < 0 ? 0.9 : 1.1))); }, { passive: false });
    canvas.addEventListener("dblclick", () => { autorot = !autorot; });

    const info = {
      communityCount: commCount,
      communities: Array.from({ length: commCount }, (_, i) => ({ idx: i, color: GC.commColor(i), size: sizes[i], rep: (idx.get(rep.get(i)) || {}).label || "" })),
      relCounts: GC.relCounts(edges), nodeCount: nodes.length, edgeCount: edges.length,
    };
    return { reheat: () => { alpha = 1; }, stop: () => { running = false; }, toggleAuto: () => (autorot = !autorot), info };
  }

  global.renderGraph3D = renderGraph3D;
})(window);
