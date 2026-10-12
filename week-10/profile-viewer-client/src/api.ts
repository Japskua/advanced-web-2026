import type { ApiResult, UserProfile } from "@shared/types";
import { API_URL } from "./config";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * There is no token to attach this time. The session lives in an HttpOnly
 * cookie that JavaScript cannot even read. `credentials: "include"` tells the
 * browser to send that cookie with this cross-origin request (and to accept
 * cookies in the response). Without it, fetch() leaves cookies out when the
 * request goes to another origin.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("server", 0);
  }

  if (res.status === 204) return undefined as T;

  const payload = (await res.json()) as ApiResult<T>;
  if (!payload.ok) throw new ApiError(payload.error.message, res.status);
  return payload.data;
}

export function fetchMe(signal?: AbortSignal): Promise<UserProfile> {
  return request<UserProfile>("/api/me", { signal });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

// Signing in is a full-page navigation to the API, which redirects onwards to
// Google. It cannot be a fetch(): the user must see and use Google's page.
export const LOGIN_URL = `${API_URL}/auth/google/login`;
