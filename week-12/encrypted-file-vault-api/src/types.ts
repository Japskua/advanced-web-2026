// Entities (database rows) and internal types. They never leave the API;
// src/mappers.ts turns them into the DTOs in shared/types.ts.

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  keyFingerprint: string | null;
  createdAt: Date;
}

export interface FileEntity {
  id: string;
  ownerId: string;
  originalFilename: string;
  objectKey: string; // where the encrypted bytes are in object storage
  contentType: string;
  sizeBytes: number;
  encryptionAlgorithm: "AES-GCM";
  encryptionIv: string;
  createdAt: Date;
}

// The user making the request, as established by withAuth().
export interface AuthUser {
  id: string;
  email: string;
  keyFingerprint: string | null;
}
