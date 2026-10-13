// SQL for the files table. Every query includes the owner id: a user can only
// ever see, read or delete their own files (no IDOR, see week 11).
import { sql } from "../db/client";
import type { FileEntity } from "../types";

const fileColumns = sql`
  id,
  owner_id             as "ownerId",
  original_filename    as "originalFilename",
  object_key           as "objectKey",
  content_type         as "contentType",
  size_bytes           as "sizeBytes",
  encryption_algorithm as "encryptionAlgorithm",
  encryption_iv        as "encryptionIv",
  created_at           as "createdAt"
`;

export async function insertFile(file: Omit<FileEntity, "createdAt">): Promise<FileEntity> {
  const rows = await sql<FileEntity[]>`
    insert into files (id, owner_id, original_filename, object_key, content_type, size_bytes, encryption_algorithm, encryption_iv)
    values (${file.id}, ${file.ownerId}, ${file.originalFilename}, ${file.objectKey}, ${file.contentType},
            ${file.sizeBytes}, ${file.encryptionAlgorithm}, ${file.encryptionIv})
    returning ${fileColumns}
  `;
  if (!rows[0]) throw new Error("insert into files returned no row");
  return rows[0];
}

export async function listFilesByOwner(ownerId: string): Promise<FileEntity[]> {
  return await sql<FileEntity[]>`
    select ${fileColumns} from files where owner_id = ${ownerId} order by created_at desc
  `;
}

export async function findFileForOwner(fileId: string, ownerId: string): Promise<FileEntity | null> {
  const rows = await sql<FileEntity[]>`
    select ${fileColumns} from files where id = ${fileId} and owner_id = ${ownerId}
  `;
  return rows[0] ?? null;
}

export async function deleteFileForOwner(fileId: string, ownerId: string): Promise<FileEntity | null> {
  const rows = await sql<FileEntity[]>`
    delete from files where id = ${fileId} and owner_id = ${ownerId} returning ${fileColumns}
  `;
  return rows[0] ?? null;
}
