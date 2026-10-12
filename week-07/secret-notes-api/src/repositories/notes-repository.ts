import type { Note } from "@shared/types";
import { sql } from "../db/client";

// The table and the API object have the same fields here, so the rows can be
// returned as they are. Week 8 shows the general case with separate types.
export async function listNotes(): Promise<Note[]> {
  return await sql<Note[]>`
    select id, content
    from notes
    order by id
  `;
}
