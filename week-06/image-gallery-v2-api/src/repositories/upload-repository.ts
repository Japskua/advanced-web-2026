/**
 * The repository layer: the only code that writes SQL.
 *
 * Each function runs one query and returns plain application objects. Services
 * call these functions without knowing anything about tables or SQL, so the
 * storage could change (another database, an ORM) without touching them.
 */
import type { UploadRecord } from "@shared/types";
import { sql } from "../db/client";

/**
 * A row of the `uploads` table, exactly as the database returns it: snake_case
 * column names, and a JavaScript Date for the timestamptz column. This type
 * describes the database (an *entity*); it never leaves this file.
 */
interface UploadRow {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: Date;
}

// What the service supplies when inserting. The database adds uploaded_at.
export interface NewUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/**
 * Mapping a database row to the object the API sends (the shared UploadRecord):
 * camelCase names, an ISO string for the date, and a derived `url` that is not
 * stored at all.
 */
function toUploadRecord(row: UploadRow): UploadRecord {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    uploadedAt: row.uploaded_at.toISOString(),
    url: `/uploads/${row.filename}`,
  };
}

/*
 * Parameterised queries.
 *
 *   sql`select … where id = ${id}`
 *
 * looks like string interpolation but is not. `sql` is a *tagged template*: it
 * receives the SQL text and the values separately, sends the text with
 * placeholders ($1, $2, …) and the values as separate parameters. The database
 * never interprets a value as SQL, so SQL injection is impossible here.
 * Week 11 shows what happens when SQL is built by concatenating strings.
 */

export async function insertUpload(upload: NewUpload): Promise<UploadRecord> {
  // `returning` gives back the inserted row, including the uploaded_at value
  // the database generated, without a second query.
  const rows = await sql<UploadRow[]>`
    insert into uploads (id, filename, original_name, mime_type, size)
    values (${upload.id}, ${upload.filename}, ${upload.originalName}, ${upload.mimeType}, ${upload.size})
    returning id, filename, original_name, mime_type, size, uploaded_at
  `;

  const row = rows[0];
  if (!row) throw new Error("insert into uploads returned no row");
  return toUploadRecord(row);
}

export async function listUploads(): Promise<UploadRecord[]> {
  const rows = await sql<UploadRow[]>`
    select id, filename, original_name, mime_type, size, uploaded_at
    from uploads
    order by uploaded_at desc
  `;
  return rows.map(toUploadRecord);
}

// Delete one row and return it (so the service knows which file to remove),
// or null if no row had that id. One statement: no separate "find" first.
export async function deleteUploadById(id: string): Promise<UploadRecord | null> {
  const rows = await sql<UploadRow[]>`
    delete from uploads
    where id = ${id}
    returning id, filename, original_name, mime_type, size, uploaded_at
  `;

  const row = rows[0];
  return row ? toUploadRecord(row) : null;
}
