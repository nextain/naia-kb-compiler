/** @spec SPEC-002 / TEST-F-002 — Ingest. */
import { describe, it, expect } from "vitest";
import { IngestAdapter } from "../adapters/ingest/text.js";

describe("IngestAdapter", () => {
  it("text 소스 → 정규화 Source", async () => {
    const out = await new IngestAdapter().ingest([{ kind: "text", title: "t", text: "  본문  " }]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("본문");
    expect(out[0].id).toBeTruthy();
  });

  it("빈 text 는 제외", async () => {
    const out = await new IngestAdapter().ingest([{ kind: "text", text: "   " }]);
    expect(out).toHaveLength(0);
  });

  it("url 소스 → 주입 fetcher로 본문 취득", async () => {
    const ing = new IngestAdapter(async (u) => `fetched:${u}`);
    const out = await ing.ingest([{ kind: "url", uri: "https://x.test" }]);
    expect(out[0].text).toBe("fetched:https://x.test");
    expect(out[0].kind).toBe("url");
  });
});
