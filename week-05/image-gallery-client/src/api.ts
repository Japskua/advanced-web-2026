import type { ApiResult, UploadRecord } from "@shared/types";
import { API_URL } from "./config";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// The generic request helper from week 4.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }

  let payload: ApiResult<T>;
  try {
    payload = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError(`Unexpected response from the server (HTTP ${res.status})`, res.status);
  }

  if (!payload.ok) throw new ApiError(payload.error.message, res.status);
  return payload.data;
}

export function fetchUploads(signal?: AbortSignal): Promise<UploadRecord[]> {
  return request<UploadRecord[]>("/api/uploads", { signal });
}

// Files are sent as multipart/form-data. Do NOT set the Content-Type header
// yourself: fetch() sets it to multipart/form-data *with* the boundary string
// that separates the parts, and the server needs that boundary to parse the body.
export function uploadImage(file: File): Promise<UploadRecord> {
  const form = new FormData();
  form.append("image", file);

  return request<UploadRecord>("/api/uploads", { method: "POST", body: form });
}

// The API returns paths such as "/uploads/<id>.png"; <img> needs a full URL.
export function imageUrl(upload: UploadRecord): string {
  return `${API_URL}${upload.url}`;
}
