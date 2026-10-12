import type { FileDto, UserDto } from "@shared/types";
import type { FileEntity, UserEntity } from "./types";

export function toUserDto(user: Pick<UserEntity, "id" | "email" | "keyFingerprint">): UserDto {
  return { id: user.id, email: user.email, keyFingerprint: user.keyFingerprint };
}

// The blob name and the owner id stay internal: the client refers to files by id.
export function toFileDto(file: FileEntity): FileDto {
  return {
    id: file.id,
    originalFilename: file.originalFilename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    encryptionAlgorithm: file.encryptionAlgorithm,
    encryptionIv: file.encryptionIv,
    createdAt: file.createdAt.toISOString(),
  };
}
