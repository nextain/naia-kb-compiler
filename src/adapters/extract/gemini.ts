/** @spec SPEC-003 — Extract 어댑터(gemini): 실 LLM. 토큰·fetch 주입(하드 의존 없음, 테스트는 stub 사용). */
import type { ExtractPort, ExtractResult } from "../../domain/ports.js";
import type { Source } from "../../domain/types.js";

export interface GeminiExtractOptions {
  /** ADC/OAuth 토큰 공급자 (주입 → google-auth 등에 비종속). */
  tokenProvider: () => Promise<string>;
  /** Vertex generateContent 엔드포인트 (project/location/model 포함). */
  endpoint: string;
  fetchImpl?: typeof fetch;
  model?: string;
}

const PROMPT = `다음 자료에서 공공 민원 서비스 카드를 JSON으로 추출하라.
형식: {"cards":[{"title":string,"fields":{"eligibility"?,"documents"?,"department"?,"fee"?,"hours"?,"phone"?,"url"?,"content":string},"sourceUris":string[],"confidence":number}],"entities":[{"type","name"}],"relations":[{"from","type","to"}]}
근거 없는 값은 비워라. confidence는 0~1.`;

/**
 * 실 추출. 코어/테스트는 이 어댑터를 강제하지 않는다(기본 = stub).
 * 응답 파싱 실패 시 throw — 호출측이 fallback/gap 처리.
 */
export class GeminiExtractAdapter implements ExtractPort {
  constructor(private opts: GeminiExtractOptions) {}

  async extract(sources: Source[]): Promise<ExtractResult> {
    const f = this.opts.fetchImpl ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error("fetch 미지원 — fetchImpl 주입 필요");
    const token = await this.opts.tokenProvider();
    const corpus = sources.map((s) => `# ${s.title ?? s.uri ?? s.id}\n${s.text}`).join("\n\n---\n\n");

    const res = await f(this.opts.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\n${corpus}` }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`gemini extract 실패 ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as Partial<ExtractResult> & { cards?: unknown[] };

    let i = 0;
    const cards = (parsed.cards ?? []).map((c) => {
      const cc = c as { title?: string; fields?: Record<string, string>; sourceUris?: string[]; confidence?: number };
      return {
        id: `gcard_${++i}`,
        title: cc.title ?? "무제",
        fields: cc.fields ?? {},
        sourceUris: cc.sourceUris ?? [],
        confidence: typeof cc.confidence === "number" ? cc.confidence : 0.6,
        status: "draft" as const,
      };
    });
    return { cards, entities: (parsed.entities as ExtractResult["entities"]) ?? [], relations: (parsed.relations as ExtractResult["relations"]) ?? [] };
  }
}
