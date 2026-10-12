/**
 * The API contract: Data Transfer Objects (DTOs).
 *
 * A DTO is the shape of data as it crosses the network. It is designed for the
 * client: only the fields the client needs, in a convenient form (camelCase,
 * ISO date strings, the author's email instead of a bare foreign key).
 *
 * Compare with the *entities* in community-notice-board-api/src/types.ts, which
 * describe rows in the database and never leave the API. The API's mappers
 * (src/mappers.ts) convert entities into these DTOs.
 */

export type Role = "user" | "admin";

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  createdAt: string; // ISO 8601
}

export interface NotificationDto {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO 8601
  author: {
    id: string;
    email: string;
  };
}

// Request bodies
export interface CredentialsBody {
  email: string;
  password: string;
}

export interface CreateNotificationBody {
  title: string;
  content: string;
}

// Response data of POST /api/auth/login
export interface LoginResponse {
  token: string;
  user: UserDto;
}

// The payload (claims) inside our JWTs. The client may decode it to adapt the
// UI, but the API never trusts what the client says about itself.
export interface TokenClaims {
  sub: string; // user id
  email: string;
  role: Role;
  iat: number; // issued at (seconds since 1970)
  exp: number; // expires at (seconds since 1970)
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { message: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
