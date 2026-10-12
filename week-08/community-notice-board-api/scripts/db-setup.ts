// Applies sql/schema.sql to the database in DATABASE_URL: `bun run db:setup`.
import path from "node:path";
import { sql } from "../src/db/client";

try {
  await sql.file(path.join(import.meta.dir, "..", "sql", "schema.sql"));
  console.log("Schema applied. Next: `bun run seed:admin` to create the first administrator.");
} finally {
  await sql.close();
}
