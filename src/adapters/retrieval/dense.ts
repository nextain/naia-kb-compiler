/** @spec SPEC-007 — Dense Retrieval 어댑터: 임베딩 코사인 유사도. EmbedPort 주입(BGE-M3/KURE 등). 키워드가 못 잡는 의미·패러프레이즈 검색. */
import type { RetrievalPort, EmbedPort } from "../../domain/ports.js";
import type { Kb, ServiceCard } from "../../domain/types.js";

function l2normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}
const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
};

export class DenseRetrievalAdapter implements RetrievalPort {
  private cards: ServiceCard[] = [];
  private vecs: number[][] = [];
  constructor(private embed: EmbedPort) {}

  async index(kb: Kb): Promise<void> {
    this.cards = kb.cards;
    const texts = kb.cards.map((c) => [c.title, ...Object.values(c.fields)].join(" "));
    const raw = await this.embed.embed(texts);
    this.vecs = raw.map(l2normalize);
  }

  async search(query: string, k = 5): Promise<ServiceCard[]> {
    if (!this.cards.length) return [];
    const [qraw] = await this.embed.embed([query]);
    const qv = l2normalize(qraw);
    return this.vecs
      .map((v, i) => ({ c: this.cards[i], s: dot(qv, v) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map((x) => x.c);
  }
}
