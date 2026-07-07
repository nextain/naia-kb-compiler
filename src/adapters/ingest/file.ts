/** @spec SPEC-002 — 파일(바이너리) → 텍스트 추출 유틸. 소비자가 `file` 소스를 만들기 전에 사용.
 * IngestAdapter 는 텍스트 passthrough 이므로, 바이너리 추출은 이 유틸이 담당(포맷별).
 * mammoth/pdf-parse 는 optionalDependencies — 미설치 환경에선 해당 포맷이 실패로 표기된다. */

export const SUPPORTED_FILE_FORMATS = "TXT, MD, CSV, PDF, DOCX, XLSX (HWP 부분 — 일부 실패 가능)";

/** 파일명 + 버퍼 → 텍스트. 실패 시 throw (소비자가 {status:failed,reason} 표기). */
export async function extractFile(name: string, buf: Buffer): Promise<string> {
  const ext = (name.toLowerCase().split(".").pop() ?? "").trim();

  if (ext === "txt" || ext === "md" || ext === "markdown" || ext === "csv") {
    return buf.toString("utf8");
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    return wb.SheetNames.map((n) => `## ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n").trim();
  }
  if (ext === "docx") {
    const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
    return (await (mammoth as { extractRawText(o: { buffer: Buffer }): Promise<{ value: string }> }).extractRawText({ buffer: buf })).value;
  }
  if (ext === "pdf") {
    // @ts-expect-error pdf-parse 타입 선언 없음(CJS)
    const mod = await import("pdf-parse");
    const pdf = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>;
    return (await pdf(buf)).text;
  }
  if (ext === "hwp" || ext === "hwpx") {
    throw new Error("HWP 파싱 미지원 (전용 파서 필요 — '처리 안 됨'으로 표기)");
  }
  throw new Error(`지원하지 않는 형식: .${ext} (지원: ${SUPPORTED_FILE_FORMATS})`);
}
