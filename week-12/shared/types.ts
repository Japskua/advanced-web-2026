// The API contract (DTOs) shared by the Encrypted File Vault API and client.

export interface UserDto {
  id: string;
  email: string;
  // SHA-256 of the user's encryption key, hex-encoded, or null before
  // onboarding. Not secret: it cannot be turned back into the key, and it lets
  // the client check that a pasted key is the right one.
  keyFingerprint: string | null;
}

export interface FileDto {
  id: string;
  originalFilename: string;
  contentType: string; // of the original (decrypted) file
  sizeBytes: number; // of the original (decrypted) file
  encryptionAlgorithm: "AES-GCM";
  encryptionIv: string; // Base64, 12 bytes; needed to decrypt
  createdAt: string; // ISO 8601
}

export interface RegisterBody {
  email: string;
  password: string;
  inviteCode: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserDto;
}

export interface OnboardingBody {
  keyFingerprint: string;
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { message: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
