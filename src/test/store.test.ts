/** @spec SPEC-005 / TEST-F-005 — Store + export/import 무손실 라운드트립(가반성). */
import { afterEach, describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStoreAdapter } from "../adapters/store/memory.js";
import { WorkspaceStoreAdapter } from "../adapters/store/workspace-fs.js";
import type { Kb } from "../domain/types.js";

const kb: Kb = {
  cards: [{ id: "c1", title: "여권", fields: { fee: "53000원", content: "여권 발급" }, sourceUris: ["u1"], confidence: 0.8, status: "accepted" }],
  entities: [{ id: "e1", type: "Service", name: "여권" }],
  relations: [{ from: "e1", type: "handled_by", to: "e2" }],
};

describe("MemoryStoreAdapter", () => {
  it("save → load 동일", async () => {
    const s = new MemoryStoreAdapter();
    await s.save(kb);
    expect(await s.load()).toEqual(kb);
  });

  it("export → import 라운드트립 무손실(다른 인스턴스)", async () => {
    const a = new MemoryStoreAdapter();
    await a.save(kb);
    const json = await a.export();

    const b = new MemoryStoreAdapter();
    await b.import(json);
    expect(await b.load()).toEqual(kb);
  });

  it("잘못된 포맷 import → throw", async () => {
    const s = new MemoryStoreAdapter();
    await expect(s.import('{"nope":1}')).rejects.toThrow();
  });
});

describe("WorkspaceStoreAdapter (SPEC-005, NFR-002 가반성)", () => {
  const dirs: string[] = [];
  const mkTmp = async (): Promise<string> => {
    const d = await mkdtemp(join(tmpdir(), "kb-wsfs-"));
    dirs.push(d);
    return d;
  };
  afterEach(async () => {
    while (dirs.length) await rm(dirs.pop() as string, { recursive: true, force: true });
  });

  it("save → load 동일 (파일 영속)", async () => {
    const s = new WorkspaceStoreAdapter({ dir: await mkTmp() });
    await s.save(kb);
    expect(await s.load()).toEqual(kb);
  });

  it("파일 없음(첫 실행) → 빈 KB", async () => {
    const s = new WorkspaceStoreAdapter({ dir: await mkTmp() });
    expect(await s.load()).toEqual({ cards: [], entities: [], relations: [] });
  });

  it("save 는 {dir}/kb.json 에 {version:1, kb} envelope 기록", async () => {
    const dir = await mkTmp();
    await new WorkspaceStoreAdapter({ dir }).save(kb);
    const raw = JSON.parse(await readFile(join(dir, "kb.json"), "utf8"));
    expect(raw).toEqual({ version: 1, kb });
  });

  it("export → import 라운드트립 무손실 (다른 dir/인스턴스)", async () => {
    const a = new WorkspaceStoreAdapter({ dir: await mkTmp() });
    await a.save(kb);
    const json = await a.export();
    const b = new WorkspaceStoreAdapter({ dir: await mkTmp() });
    await b.import(json);
    expect(await b.load()).toEqual(kb);
  });

  it("가반성: memory.export → workspace.import → load 동일", async () => {
    const m = new MemoryStoreAdapter();
    await m.save(kb);
    const w = new WorkspaceStoreAdapter({ dir: await mkTmp() });
    await w.import(await m.export());
    expect(await w.load()).toEqual(kb);
  });

  it("가반성: workspace.export → memory.import → load 동일", async () => {
    const w = new WorkspaceStoreAdapter({ dir: await mkTmp() });
    await w.save(kb);
    const m = new MemoryStoreAdapter();
    await m.import(await w.export());
    expect(await m.load()).toEqual(kb);
  });

  it("잘못된 포맷 import → throw", async () => {
    const s = new WorkspaceStoreAdapter({ dir: await mkTmp() });
    await expect(s.import('{"nope":1}')).rejects.toThrow();
  });
});
