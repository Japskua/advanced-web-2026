// The API contract shared by the Profile Viewer API and its client.

// The signed-in user's profile, as returned by GET /api/me.
export interface UserProfile {
  sub: string; // the user's stable id at the identity provider ("subject")
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string; // URL of the profile picture
  signedInAt: string; // ISO 8601: when this session started
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { message: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
