// Typed client for the SolarSaathi API (API Gateway in AWS, or run.sh local/mock on a laptop).
import type { AnalysisResponse, Bill, Job, QuoteReport, Roof } from "../types/api";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const apiConfigured = Boolean(BASE);

export type ApiErrorKind = "network" | "timeout" | "http" | "not_found" | "job_failed" | "busy" | "cancelled";

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string) {
    super(message);
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 30000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw ctrl.signal.aborted ? new ApiError("timeout", "timeout") : new ApiError("network", String(e));
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) throw new ApiError("not_found", data.error || "not found");
  if (!res.ok) throw new ApiError("http", data.error || `HTTP ${res.status}`);
  return data as T;
}

/** Upload straight to S3 with the pre-signed POST. XHR, because fetch can't report upload progress. */
export async function uploadFile(
  file: File,
  kind: "bill" | "quote",
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { url, fields, key } = await request<{ url: string; fields: Record<string, string>; key: string }>(
    "POST", "/uploads", { kind, contentType: file.type });
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append("file", file);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError("http", `upload ${xhr.status}`)));
    xhr.onerror = () => reject(new ApiError("network", "upload failed"));
    xhr.onabort = () => reject(new ApiError("cancelled", "cancelled"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
  onProgress(1);
  return key;
}

export const startBillJob = (key: string) => request<{ jobId: string }>("POST", "/bill/extract", { key });

export const startQuoteJob = (key: string, analysisId: string | null, lang: string) =>
  request<{ jobId: string }>("POST", "/quote/check", { key, analysisId: analysisId || undefined, lang });

export const getJob = <T>(jobId: string) => request<Job<T>>("GET", `/jobs/${jobId}`);

export const analyse = (bill: Bill, lat: number, lon: number, roof: Roof) =>
  request<AnalysisResponse>("POST", "/bill/analyse", { bill, lat, lon, roof }, 45000);

export const getResult = (id: string) => request<AnalysisResponse>("GET", `/results/${id}`);

export const speech = (text: string, lang: string) =>
  request<{ audio: string; contentType: string }>("POST", "/speech", { text, lang });

/** Poll a job every 2 s (4 s after 30 s) until it finishes; give up after 150 s. */
export async function waitForJob<T>(jobId: string, signal: AbortSignal): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < 150000) {
    const wait = Date.now() - start < 30000 ? 2000 : 4000;
    await new Promise((r) => setTimeout(r, wait));
    if (signal.aborted) throw new ApiError("cancelled", "cancelled");
    const job = await getJob<T>(jobId);
    if (job.status === "done" && job.result) return job.result;
    if (job.status === "error") {
      const msg = job.error || "";
      throw new ApiError(/busy|limit|throttl/i.test(msg) ? "busy" : "job_failed", msg);
    }
  }
  throw new ApiError("timeout", "timeout");
}

export type { QuoteReport };
