// Limits shared by the API and the client (values, so this module is bundled
// into both programs).

// Files are encrypted in the browser; the limit applies to the original file.
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// AES-GCM appends a 16-byte authentication tag to the ciphertext.
export const AES_GCM_TAG_BYTES = 16;

// The recommended IV (nonce) length for AES-GCM.
export const AES_GCM_IV_BYTES = 12;
