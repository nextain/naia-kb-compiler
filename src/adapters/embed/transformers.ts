/** @spec SPEC-007 — EmbedPort 어댑터: 로컬 ONNX 임베딩(Transformers.js). BGE-M3 기본, KURE-v1 등 교체 가능.
 * @huggingface/transformers 는 *동적 import* — 미설치/미사용 시 코어·테스트에 영향 없음(프라이버시: 로컬 추론, 클라우드 미전송).
 */
import type { EmbedPort } from "../../domain/ports.js";

export interface TransformersEmbedOptions {
  /** HF 모델 id (ONNX). 기본 = BGE-M3(다국어·한국어). 한국어 특화 = KURE-v1 ONNX 준비 시 교체. */
  model?: string;
  pooling?: "mean" | "cls";
  normalize?: boolean;
  batchSize?: number;
}

// 라이브러리 타입 복잡성 회피 — 선택적 의존성이라 느슨히 다룬다.
type Pipe = (t: string, o?: { pooling?: string; normalize?: boolean }) => Promise<{ data: ArrayLike<number> }>;

export class TransformersEmbedAdapter implements EmbedPort {
  private pipePromise: Promise<Pipe> | null = null;
  constructor(private opts: TransformersEmbedOptions = {}) {}

  private load(): Promise<Pipe> {
    if (!this.pipePromise) {
      const model = this.opts.model ?? "Xenova/bge-m3";
      this.pipePromise = import("@huggingface/transformers").then(
        (m) => (m as { pipeline: (task: string, model: string) => Promise<Pipe> }).pipeline("feature-extraction", model),
      );
    }
    return this.pipePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const pipe = await this.load();
    const pooling = this.opts.pooling ?? "cls";
    const normalize = this.opts.normalize ?? true;
    const out: number[][] = [];
    for (const t of texts) {
      const r = await pipe(t, { pooling, normalize });
      out.push(Array.from(r.data, Number));
    }
    return out;
  }
}
