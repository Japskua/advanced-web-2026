/**
 * Resets a database to the demo state: schema + the same users and notes in
 * both versions. Used by `bun run db:setup` and by the tests.
 *
 * The ids are fixed so the lecture can refer to them (and so the client can
 * pre-fill them):
 *   users  11111111-… admin@example.com  Admin123!  admin
 *          22222222-… alice@example.com  alice123   user
 *          33333333-… bob@example.com    bob123     user
 *   notes  aaaaaaaa-… Admin's note,  bbbbbbbb-… Alice's,  cccccccc-… Bob's
 *
 * Alice's and Bob's passwords are weak on purpose: the secure version's
 * password policy applies to new registrations, and existing weak passwords are
 * exactly what rate limiting has to protect.
 */
import path from "node:path";
import type { SQL } from "bun";
import type { SecurityMode } from "./config";

export const SEED_USERS = [
  { id: "11111111-1111-1111-1111-111111111111", email: "admin@example.com", password: "Admin123!", role: "admin" },
  { id: "22222222-2222-2222-2222-222222222222", email: "alice@example.com", password: "alice123", role: "user" },
  { id: "33333333-3333-3333-3333-333333333333", email: "bob@example.com", password: "bob123", role: "user" },
] as const;

export const SEED_NOTES = [
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Admin note", content: "Sensitive admin content", ownerId: SEED_USERS[0].id },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "Alice note", content: "Alice's private note", ownerId: SEED_USERS[1].id },
  { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", title: "Bob note", content: "Bob's private note", ownerId: SEED_USERS[2].id },
] as const;

export async function resetDatabase(sql: SQL, mode: SecurityMode): Promise<void> {
  await sql.file(path.join(import.meta.dir, "..", "sql", `${mode}-schema.sql`));

  for (const user of SEED_USERS) {
    if (mode === "vulnerable") {
      await sql`insert into users (id, email, password, role) values (${user.id}, ${user.email}, ${user.password}, ${user.role})`;
    } else {
      const hash = await Bun.password.hash(user.password);
      await sql`insert into users (id, email, password_hash, role) values (${user.id}, ${user.email}, ${hash}, ${user.role})`;
    }
  }

  for (const note of SEED_NOTES) {
    await sql`insert into notes (id, title, content, owner_id) values (${note.id}, ${note.title}, ${note.content}, ${note.ownerId})`;
  }
}
