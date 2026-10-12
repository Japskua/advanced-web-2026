// Applies sql/schema.sql to the database in DATABASE_URL: `bun run db:setup`.
// For Azure: run it once with DATABASE_URL pointing at the Azure server.
import path from "node:path";
import { sql } from "../src/db/client";

try {
  await sql.file(path.join(import.meta.dir, "..", "sql", "schema.sql"));
  console.log("Schema applied.");
} finally {
  await sql.close();
}
