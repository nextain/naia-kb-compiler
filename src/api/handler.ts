/** @spec SPEC-006 — 프레임워크 비의존 compile API 핸들러. (Next/Express 등에서 래핑) */
import { z } from "zod";
import type { Adapters } from "../domain/ports.js";
import { compile } from "../core/compile.js";
import type { KnowledgeService } from "../core/serve.js";

const sourceSchema = z.object({
  kind: z.enum(["text", "url", "file"]),
  uri: z.string().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
});

const bodySchema = z.object({
  sources: z.array(sourceSchema).min(1),
  goldQA: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  lowConfidenceThreshold: z.number().min(0).max(1).optional(),
});

export interface HandlerResponse {
  status: number;
  body: unknown;
}

/** 입력 검증 → compile → {status, body}. 호출측이 HTTP에 매핑. */
export async function handleCompile(rawBody: unknown, adapters: Adapters): Promise<HandlerResponse> {
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return { status: 400, body: { error: "검증 실패", issues: parsed.error.issues } };
  }
  try {
    const result = await compile(parsed.data, adapters);
    return { status: 200, body: result };
  } catch (e) {
    return { status: 500, body: { error: (e as Error).message } };
  }
}

const querySchema = z.object({ q: z.string().min(1), k: z.number().int().positive().max(50).optional() });

/** 서빙: 검색. naia-agent/omni 가 KnowledgeService 를 주입해 호출. */
export async function handleSearch(rawBody: unknown, svc: KnowledgeService): Promise<HandlerResponse> {
  const p = querySchema.safeParse(rawBody);
  if (!p.success) return { status: 400, body: { error: "검증 실패", issues: p.error.issues } };
  try {
    return { status: 200, body: await svc.search(p.data.q, p.data.k) };
  } catch (e) {
    return { status: 500, body: { error: (e as Error).message } };
  }
}

/** 서빙: 질의응답(grounded + 기권). agent/omni 의 tool 백엔드. */
export async function handleAsk(rawBody: unknown, svc: KnowledgeService): Promise<HandlerResponse> {
  const p = querySchema.safeParse(rawBody);
  if (!p.success) return { status: 400, body: { error: "검증 실패", issues: p.error.issues } };
  try {
    return { status: 200, body: await svc.ask(p.data.q) };
  } catch (e) {
    return { status: 500, body: { error: (e as Error).message } };
  }
}
