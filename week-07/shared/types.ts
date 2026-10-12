// The API contract shared by the Secret Notes API and its client.

export interface Note {
  id: string;
  content: string;
}

// A user as the API shows it. The password hash is never part of this type.
export interface PublicUser {
  id: string;
  email: string;
}

// Body of POST /api/auth/register and POST /api/auth/login.
export interface Credentials {
  email: string;
  password: string;
}

// Response data of POST /api/auth/login.
export interface LoginResponse {
  token: string; // a JWT; send it back as "Authorization: Bearer <token>"
  user: PublicUser;
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { message: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
