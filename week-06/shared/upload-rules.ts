/**
 * Upload rules shared by the API and the client.
 *
 * Unlike types.ts, this module contains *values*, so it really is bundled into
 * both programs. The client uses the rules to give instant feedback before
 * uploading; the API enforces the same rules, because a client can always be
 * bypassed.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// MIME type → file extension used on the server.
export const ALLOWED_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

export function isAllowedImageType(type: string): type is AllowedImageType {
  return Object.hasOwn(ALLOWED_IMAGE_TYPES, type);
}
