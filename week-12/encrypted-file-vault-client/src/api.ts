import type { ApiResult, FileDto, LoginResponse, RegisterBody, UserDto } from "@shared/types";
import { API_URL } from "./config";

// --- The token -------------------------------------------------------------
// A Bearer token in localStorage (weeks 7–8). Why not week 10's HttpOnly
// cookie? See the API's middleware/auth.ts: a token works wherever the client
// runs; switching this app to a cookie is one of the week's exercises.
const TOKEN_KEY = "vault-token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// AuthProvider registers what to do when the API rejects our token.
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Cannot reach the server.", 0);
  }

  if (res.status === 401 && token) onUnauthorized();
  return res;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  if (res.status === 204) return undefined as T;

  const payload = (await res.json().catch(() => null)) as ApiResult<T> | null;
  if (!payload) throw new ApiError(`Unexpected response from the server (HTTP ${res.status})`, res.status);
  if (!payload.ok) throw new ApiError(payload.error.message, res.status);
  return payload.data;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// --- Auth --------------------------------------------------------------------
export const login = (email: string, password: string) => postJson<LoginResponse>("/api/auth/login", { email, password });
export const register = (body: RegisterBody) => postJson<UserDto>("/api/auth/register", body);
export const fetchMe = (signal?: AbortSignal) => request<UserDto>("/api/auth/me", { signal });
export const registerKeyFingerprint = (keyFingerprint: string) =>
  postJson<UserDto>("/api/auth/onboarding", { keyFingerprint });

// --- Files -------------------------------------------------------------------
export const fetchFiles = (signal?: AbortSignal) => request<FileDto[]>("/api/files", { signal });

export function uploadEncryptedFile(input: {
  ciphertext: Uint8Array<ArrayBuffer>;
  original: File;
  iv: string;
  keyFingerprint: string;
}): Promise<FileDto> {
  const form = new FormData();
  form.append("file", new Blob([input.ciphertext], { type: "application/octet-stream" }), "encrypted.bin");
  form.append("originalFilename", input.original.name);
  form.append("contentType", input.original.type || "application/octet-stream");
  form.append("sizeBytes", String(input.original.size));
  form.append("encryptionAlgorithm", "AES-GCM");
  form.append("encryptionIv", input.iv);
  form.append("keyFingerprint", input.keyFingerprint);
  return request<FileDto>("/api/files", { method: "POST", body: form });
}

export async function downloadEncryptedFile(fileId: string): Promise<ArrayBuffer> {
  const res = await send(`/api/files/${fileId}/content`);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as ApiResult<never> | null;
    throw new ApiError(payload && !payload.ok ? payload.error.message : "Download failed", res.status);
  }
  return await res.arrayBuffer();
}

export const deleteFile = (fileId: string) => request<void>(`/api/files/${fileId}`, { method: "DELETE" });
