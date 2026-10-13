// Applies sql/schema.sql to the database in DATABASE_URL: `bun run db:setup`.
// In production the PostgreSQL container applies the same file on its first
// start (see week-12/deploy/compose.yml), so this is for local development.
import path from "node:path";
import { sql } from "../src/db/client";

try {
  await sql.file(path.join(import.meta.dir, "..", "sql", "schema.sql"));
  console.log("Schema applied.");
} finally {
  await sql.close();
}
