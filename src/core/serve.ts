/** @spec SPEC-008 — 서빙(검색·질의응답). 빌드된 KB 위에서 retrieval + 추출형 grounded 답변/기권.
 * naia-agent(RAG/툴) · naia-omni(툴 호출) · CMS 가 공용으로 쓰는 서빙 진입점. 오프라인·결정론(LLM 선택).
 */
import type { RetrievalPort, GeneratePort } from "../domain/ports.js";
import type { Kb, ServiceCard } from "../domain/types.js";
import { coverage } from "./text.js";

export interface SearchHit {
  title: string;
  snippet: string;
  score: number;
  sourceUris: string[];
}
export interface AskResult {
  abstained: boolean;
  answer: string;
  sources: { title: string; sourceUris: string[] }[];
}

const cardText = (c: ServiceCard) => [c.title, ...Object.values(c.fields)].join(" ");

/** 카드 본문에서 질의와 가장 관련된 문장/줄을 뽑음(추출형 근거). */
export function bestSnippet(card: ServiceCard, q: string, max = 300): string {
  const lines = String(card.fields.content ?? cardText(card))
    .split(/\r?\n|(?<=[.!?。])\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  let best = lines[0] ?? card.title;
  let bs = -1;
  for (const l of lines) {
    const s = coverage(q, l);
    if (s > bs) { bs = s; best = l; }
  }
  return best.slice(0, max);
}

export interface KnowledgeServiceOptions {
  answerThreshold?: number; // 기권 임계(질의-카드 관련성). 기본 0.4
  generate?: GeneratePort; // 주입 시 추출 대신 LLM grounded 생성(선택)
}

/** 빌드된 KB + RetrievalPort 를 감싼 서빙 서비스. agent/omni/CMS 공용. */
export class KnowledgeService {
  private constructor(private kb: Kb, private retrieval: RetrievalPort, private opts: KnowledgeServiceOptions = {}) {}

  static async create(kb: Kb, retrieval: RetrievalPort, opts: KnowledgeServiceOptions = {}): Promise<KnowledgeService> {
    await retrieval.index(kb);
    return new KnowledgeService(kb, retrieval, opts);
  }

  async search(query: string, k = 8): Promise<SearchHit[]> {
    const hits = await this.retrieval.search(query, k);
    return hits.map((c) => ({
      title: c.title,
      snippet: bestSnippet(c, query),
      score: +coverage(query, cardText(c)).toFixed(2),
      sourceUris: c.sourceUris,
    }));
  }

  /** 추출형 grounded 답변 + 근거없으면 기권. generate 주입 시 LLM 생성. */
  async ask(query: string): Promise<AskResult> {
    const hits = await this.retrieval.search(query, 5);
    const threshold = this.opts.answerThreshold ?? 0.4;
    const best = hits.find((c) => coverage(query, cardText(c)) >= threshold);
    if (!best) {
      return { abstained: true, answer: "관련 근거를 찾지 못했습니다.", sources: [] };
    }
    const sources = hits.slice(0, 3).map((c) => ({ title: c.title, sourceUris: c.sourceUris }));
    if (this.opts.generate) {
      const g = await this.opts.generate.answer(query, hits);
      return { abstained: g.abstained, answer: g.text, sources };
    }
    return { abstained: false, answer: bestSnippet(best, query), sources };
  }
}
