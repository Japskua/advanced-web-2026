import type { ApiResult, LoginResponse, Note, PublicUser } from "@shared/types";
import { getToken } from "./auth";
import { API_URL } from "./config";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// The request helper from earlier weeks, now attaching the token when there is one.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
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

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function register(email: string, password: string): Promise<PublicUser> {
  return postJson<PublicUser>("/api/auth/register", { email, password });
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return postJson<LoginResponse>("/api/auth/login", { email, password });
}

export function fetchNotes(signal?: AbortSignal): Promise<Note[]> {
  return request<Note[]>("/api/notes", { signal });
}
