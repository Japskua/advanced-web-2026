import { SQL } from "bun";
import { sql } from "../db/client";
import { ConflictError } from "../errors";
import type { UserEntity } from "../types";

const UNIQUE_VIOLATION = "23505";

const userColumns = sql`
  id, email, password_hash as "passwordHash", key_fingerprint as "keyFingerprint", created_at as "createdAt"
`;

export async function findUserByEmail(email: string): Promise<UserEntity | null> {
  const rows = await sql<UserEntity[]>`select ${userColumns} from users where email = ${email}`;
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserEntity | null> {
  const rows = await sql<UserEntity[]>`select ${userColumns} from users where id = ${id}`;
  return rows[0] ?? null;
}

export async function insertUser(user: { id: string; email: string; passwordHash: string }): Promise<UserEntity> {
  try {
    const rows = await sql<UserEntity[]>`
      insert into users (id, email, password_hash)
      values (${user.id}, ${user.email}, ${user.passwordHash})
      returning ${userColumns}
    `;
    if (!rows[0]) throw new Error("insert into users returned no row");
    return rows[0];
  } catch (error) {
    if (error instanceof SQL.PostgresError && error.errno === UNIQUE_VIOLATION) {
      throw new ConflictError("Email already in use");
    }
    throw error;
  }
}

// Sets the fingerprint only if none is set yet, in one atomic statement:
// two concurrent onboarding requests cannot both succeed. Returns the updated
// user, or null if a fingerprint was already set.
export async function setKeyFingerprintOnce(userId: string, fingerprint: string): Promise<UserEntity | null> {
  const rows = await sql<UserEntity[]>`
    update users
    set key_fingerprint = ${fingerprint}
    where id = ${userId} and key_fingerprint is null
    returning ${userColumns}
  `;
  return rows[0] ?? null;
}
