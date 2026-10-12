/**
 * Encrypted files: the bytes go to Blob Storage, the metadata to PostgreSQL.
 *
 * The server never sees a plaintext file or the key. It stores ciphertext plus
 * what the owner's browser needs to decrypt it later (the IV), and checks that
 * uploads were encrypted with the account's registered key.
 */
import { AES_GCM_TAG_BYTES } from "@shared/limits";
import type { FileDto } from "@shared/types";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors";
import { toFileDto } from "../mappers";
import * as fileRepository from "../repositories/file-repository";
import type { AuthUser } from "../types";
import type { UploadInput } from "../util/validation";
import { deleteBlob, downloadBlob, uploadBlob } from "./blob-storage";

/**
 * The fingerprint check.
 *
 * The browser sends the SHA-256 fingerprint of the key it used. If it differs
 * from the one registered at onboarding, the file was encrypted with another
 * key (a typo while pasting, an old key) and the user could never decrypt it
 * with their real key. Refusing the upload protects them from losing data.
 *
 * This is a safety net, not an authentication factor: fingerprints are not
 * secret. Authentication is the JWT.
 */
function assertKeyMatches(user: AuthUser, keyFingerprint: string): void {
  if (!user.keyFingerprint) {
    throw new ForbiddenError("Set up your encryption key before uploading files.");
  }
  if (user.keyFingerprint !== keyFingerprint) {
    throw new ForbiddenError("This file was encrypted with a different key than the one registered for your account.");
  }
}

export async function listFiles(user: AuthUser): Promise<FileDto[]> {
  const files = await fileRepository.listFilesByOwner(user.id);
  return files.map(toFileDto);
}

export async function uploadFile(user: AuthUser, input: UploadInput): Promise<FileDto> {
  assertKeyMatches(user, input.keyFingerprint);

  // AES-GCM ciphertext is exactly the plaintext plus a 16-byte tag. Anything
  // else is not what the client claims to have uploaded.
  if (input.encrypted.size !== input.sizeBytes + AES_GCM_TAG_BYTES) {
    throw new BadRequestError("The encrypted data does not match the declared file size.");
  }

  const id = crypto.randomUUID();
  const blobName = `${user.id}/${id}`;

  await uploadBlob(blobName, new Uint8Array(await input.encrypted.arrayBuffer()));

  try {
    const file = await fileRepository.insertFile({
      id,
      ownerId: user.id,
      originalFilename: input.originalFilename,
      blobName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      encryptionAlgorithm: "AES-GCM",
      encryptionIv: input.encryptionIv,
    });
    return toFileDto(file);
  } catch (error) {
    await deleteBlob(blobName); // no orphaned blobs (the week 6 lesson)
    throw error;
  }
}

// The ciphertext only. The client already has the IV and the file name from the list.
export async function downloadFile(user: AuthUser, fileId: string): Promise<Uint8Array> {
  const file = await fileRepository.findFileForOwner(fileId, user.id);
  if (!file) throw new NotFoundError("File not found");
  return await downloadBlob(file.blobName);
}

// Row first, then the blob (the week 6 order: the database is the source of truth).
export async function deleteFile(user: AuthUser, fileId: string): Promise<void> {
  const file = await fileRepository.deleteFileForOwner(fileId, user.id);
  if (!file) throw new NotFoundError("File not found");
  await deleteBlob(file.blobName);
}
