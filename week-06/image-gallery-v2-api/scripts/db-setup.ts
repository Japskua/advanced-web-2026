// Applies sql/schema.sql to the database in DATABASE_URL.
//
//   bun run db:setup
//
// sql.file() runs every statement in the file. The schema uses
// "create ... if not exists", so running this twice is harmless.
import path from "node:path";
import { sql } from "../src/db/client";

const schemaPath = path.join(import.meta.dir, "..", "sql", "schema.sql");

try {
  await sql.file(schemaPath);
  const [row] = await sql<{ count: number }[]>`select count(*)::int as count from uploads`;
  console.log(`Schema applied. The uploads table has ${row?.count ?? 0} row(s).`);
} finally {
  await sql.close();
}
