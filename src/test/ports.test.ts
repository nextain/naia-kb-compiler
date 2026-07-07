/** @spec SPEC-001 / TEST-F-001 — 도메인·포트 계약(목 어댑터가 인터페이스 충족). */
import { describe, it, expect } from "vitest";
import type { IngestPort, ExtractPort, RetrievalPort, StorePort, Adapters } from "../domain/ports.js";
import type { Kb } from "../domain/types.js";
import { defaultAdapters } from "../client.js";

describe("포트 계약", () => {
  it("목 어댑터가 각 포트 인터페이스를 충족", async () => {
    const ingest: IngestPort = { async ingest() { return []; } };
    const extract: ExtractPort = { async extract() { return { cards: [], entities: [], relations: [] }; } };
    const retrieval: RetrievalPort = { async index() {}, async search() { return []; } };
    const emptyKb: Kb = { cards: [], entities: [], relations: [] };
    const store: StorePort = { async save() {}, async load() { return emptyKb; }, async export() { return "{}"; }, async import() {} };

    expect(await ingest.ingest([])).toEqual([]);
    expect((await extract.extract([])).cards).toEqual([]);
    expect(await retrieval.search("x")).toEqual([]);
    expect(await store.load()).toEqual(emptyKb);
  });

  it("defaultAdapters 가 Adapters 묶음을 제공", () => {
    const a: Adapters = defaultAdapters();
    expect(a.ingest).toBeDefined();
    expect(a.extract).toBeDefined();
    expect(a.retrieval).toBeDefined();
    expect(a.store).toBeDefined();
  });
});
