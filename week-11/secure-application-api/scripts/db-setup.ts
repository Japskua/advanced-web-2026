// Resets BOTH demo databases to the seeded state: `bun run db:setup`.
// Run it again after a demo deleted users or notes.
import { secureSql, vulnerableSql } from "../src/db";
import { resetDatabase } from "../src/seed";

try {
  await resetDatabase(vulnerableSql, "vulnerable");
  console.log("Vulnerable database reset (passwords stored in plain text).");
  await resetDatabase(secureSql, "secure");
  console.log("Secure database reset (passwords stored as Argon2id hashes).");
} finally {
  await vulnerableSql.close();
  await secureSql.close();
}
