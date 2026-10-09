const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const post = (path, body) => request("POST", path, body);
export const get = (path) => request("GET", path);

// The phone uploads straight to S3 with a pre-signed POST; the API never handles the image.
export async function upload(file, kind) {
  const { url, fields, key } = await post("/uploads", { kind, contentType: file.type });
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append("file", file);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  return key;
}

// AI jobs run in the background; poll until done (about 10-40 seconds).
export async function waitForJob(jobId, timeoutMs = 150000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    const job = await get(`/jobs/${jobId}`);
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.error || "Could not read the file");
  }
  throw new Error("This is taking too long. Please try again.");
}

export const apiConfigured = Boolean(API);
