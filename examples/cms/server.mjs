#!/usr/bin/env node
/**
 * 테스트용 웹 CMS + 코퍼스 검색/질의(Q&A).
 * 모드: (1) 자료 붙여넣기 → 컴파일/안전스캔  (2) CORPUS_DIR 인덱싱 → 검색·질의응답(넥스테인 자료 등).
 * 프레임워크 0(node:http). dist 필요. 실행: CORPUS_DIR=<md폴더> node examples/cms/server.mjs → http://localhost:7878
 */
import http from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  handleCompile, handleSearch, handleAsk, defaultAdapters, MarkdownExtractAdapter, StubExtractAdapter,
  Bm25RetrievalAdapter, KnowledgeService, applySafety,
} from "../../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 7878;
const CORPUS_DIR = process.env.CORPUS_DIR ?? "";
const html = readFileSync(join(__dirname, "index.html"), "utf8");
const fileRes = (name, type) => (res) => { try { res.writeHead(200, { "content-type": type }); res.end(readFileSync(join(__dirname, name))); } catch { res.writeHead(404); res.end("not found"); } };
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { r(JSON.parse(b || "{}")); } catch { r({}); } }); });
const json = (res, s, o) => { res.writeHead(s, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(o)); };

// ── 코퍼스 인덱싱 (검색/질의용) ──
const EXC = new Set([".git", ".obsidian", ".agents", ".users", "node_modules"]);
const EXCF = new Set(["AGENTS.md", "CLAUDE.md", "GEMINI.md", "README.md"]);
let CORPUS = null; // { retrieval, cards, stats, safety }

function walkMd(dir, acc = []) {
  for (const n of readdirSync(dir)) { if (EXC.has(n)) continue; const p = join(dir, n); const st = statSync(p); if (st.isDirectory()) walkMd(p, acc); else if (extname(n) === ".md" && !EXCF.has(n)) acc.push(p); }
  return acc;
}
async function buildCorpus(dir) {
  const files = walkMd(dir);
  const rels = files.map((p) => relative(dir, p));
  const sources = files.map((p, i) => ({ kind: "text", title: rels[i], text: readFileSync(p, "utf8") }));
  const ex = await new MarkdownExtractAdapter().extract(await defaultAdapters().ingest.ingest(sources));
  const kb = { cards: ex.cards, entities: ex.entities, relations: ex.relations };
  const safety = applySafety(sources.map((s, i) => ({ id: String(i), text: s.text })), "warn").report;
  const svc = await KnowledgeService.create(kb, new Bm25RetrievalAdapter());
  CORPUS = { dir, svc, cards: kb.cards, fileList: rels, stats: { files: files.length, cards: kb.cards.length, entities: kb.entities.length }, safety };
  console.log(`코퍼스 인덱싱: 파일 ${files.length} · 카드 ${kb.cards.length} · PII ${safety.piiCount}/대외비 ${safety.confidentialCount}`);
}

const ANSWER_T = 0.4; // 질의 관련성 기권 임계
function bestSnippet(card, q) {
  const lines = String(card.fields.content ?? "").split(/\r?\n|(?<=[.!?。])\s+/).map((l) => l.trim()).filter((l) => l.length > 1);
  let best = lines[0] ?? card.title, bs = -1;
  for (const l of lines) { const s = coverage(q, l); if (s > bs) { bs = s; best = l; } }
  return best.slice(0, 300);
}

const server = http.createServer(async (req, res) => {
  const path = req.url.split("?")[0]; // 쿼리스트링 제거 — /graph.html?name=... 등 라우팅 정확매칭용
  if (req.method === "GET" && (path === "/" || path === "/index.html")) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(html); }
  if (req.method === "GET" && path === "/graph.html") return fileRes("graph.html", "text/html; charset=utf-8")(res);
  if (req.method === "GET" && path === "/graph3d.html") return fileRes("graph3d.html", "text/html; charset=utf-8")(res);
  if (req.method === "GET" && path === "/graph.js") return fileRes("graph.js", "text/javascript; charset=utf-8")(res);
  if (req.method === "GET" && path === "/graph3d.js") return fileRes("graph3d.js", "text/javascript; charset=utf-8")(res);
  if (req.method === "GET" && path === "/graph-common.js") return fileRes("graph-common.js", "text/javascript; charset=utf-8")(res);
  if (req.method === "GET" && path.startsWith("/viz/")) {
    const name = decodeURIComponent(path.slice(5)).replace(/[^\w-]/g, "");
    try { res.writeHead(200, { "content-type": "application/json; charset=utf-8" }); return res.end(readFileSync(join(__dirname, "../../benchmark/results", `${name}-viz.json`), "utf8")); }
    catch { res.writeHead(404); return res.end("viz 없음"); }
  }

  // 코퍼스 상태
  if (req.method === "GET" && req.url === "/api/corpus") return json(res, 200, CORPUS ? { ready: true, dir: CORPUS.dir, ...CORPUS.stats, safety: { pii: CORPUS.safety.piiCount, confidential: CORPUS.safety.confidentialCount } } : { ready: false, corpusDir: CORPUS_DIR });
  // 인덱싱된 자료 목록
  if (req.method === "GET" && req.url === "/api/corpus/list") return json(res, 200, CORPUS ? { dir: CORPUS.dir, files: CORPUS.fileList } : { files: [] });
  // 재인덱싱(업데이트)
  if (req.method === "POST" && req.url === "/api/corpus/reindex") {
    if (!CORPUS_DIR) return json(res, 400, { error: "CORPUS_DIR 미설정" });
    try { await buildCorpus(CORPUS_DIR); return json(res, 200, { ok: true, ...CORPUS.stats }); }
    catch (e) { return json(res, 500, { error: e.message }); }
  }

  // 검색 / 질의응답 — 엔진 KnowledgeService 위임(코어 재사용)
  if (req.method === "POST" && req.url === "/api/search") {
    if (!CORPUS) return json(res, 400, { error: "코퍼스 미인덱싱 (CORPUS_DIR 설정 필요)" });
    const { status, body } = await handleSearch(await readBody(req), CORPUS.svc);
    return json(res, status, body);
  }
  if (req.method === "POST" && req.url === "/api/ask") {
    if (!CORPUS) return json(res, 400, { error: "코퍼스 미인덱싱" });
    const { status, body } = await handleAsk(await readBody(req), CORPUS.svc);
    return json(res, status, body);
  }

  if (req.method === "POST" && req.url === "/api/safety") {
    const { sources = [] } = await readBody(req);
    return json(res, 200, applySafety(sources.map((s, i) => ({ id: String(i), text: s.text ?? "" })), "warn").report);
  }
  if (req.method === "POST" && req.url === "/api/compile") {
    const body = await readBody(req);
    const extractor = body.extractor === "stub" ? new StubExtractAdapter() : new MarkdownExtractAdapter();
    const { status, body: out } = await handleCompile({ sources: body.sources ?? [], goldQA: body.goldQA, safety: body.safety ?? "warn" }, { ...defaultAdapters(), extract: extractor });
    return json(res, status, out);
  }

  res.writeHead(404); res.end("not found");
});

server.listen(PORT, async () => {
  console.log(`naia-kb-compiler CMS → http://localhost:${PORT}`);
  if (CORPUS_DIR) { console.log(`코퍼스 인덱싱 중: ${CORPUS_DIR}`); try { await buildCorpus(CORPUS_DIR); } catch (e) { console.error("코퍼스 인덱싱 실패:", e.message); } }
  else console.log("(CORPUS_DIR 미설정 — 검색/질의 비활성. 컴파일 모드만)");
});
