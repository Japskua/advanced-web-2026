import type {
  ApiResult,
  CreateNotificationBody,
  LoginResponse,
  NotificationDto,
  UserDto,
} from "@shared/types";
import { clearToken, getToken } from "./auth";
import { API_URL } from "./config";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }

  // A 401 while we hold a token means the token is no longer accepted
  // (expired, or the account was deleted). Clearing it notifies useAuth(), and
  // the route guards send the user to the login page. Every page gets this
  // behaviour without handling 401 itself.
  if (res.status === 401 && token) {
    clearToken();
  }

  if (res.status === 204) return undefined as T;

  let payload: ApiResult<T>;
  try {
    payload = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError(`Unexpected response from the server (HTTP ${res.status})`, res.status);
  }

  if (!payload.ok) throw new ApiError(payload.error.message, res.status);
  return payload.data;
}

export function register(email: string, password: string): Promise<UserDto> {
  return request<UserDto>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function fetchNotifications(signal?: AbortSignal): Promise<NotificationDto[]> {
  return request<NotificationDto[]>("/api/notifications", { signal });
}

export function createNotification(input: CreateNotificationBody): Promise<NotificationDto> {
  return request<NotificationDto>("/api/admin/notifications", { method: "POST", body: JSON.stringify(input) });
}

export function fetchUsers(signal?: AbortSignal): Promise<UserDto[]> {
  return request<UserDto[]>("/api/admin/users", { signal });
}

export function deleteUser(userId: string): Promise<void> {
  return request<void>(`/api/admin/users/${userId}`, { method: "DELETE" });
}
