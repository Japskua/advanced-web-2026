// SQL for the users table. Returns entities (src/types.ts), never DTOs.
import { SQL } from "bun";
import type { Role } from "@shared/types";
import { sql } from "../db/client";
import { ConflictError } from "../errors";
import type { UserEntity } from "../types";

const UNIQUE_VIOLATION = "23505";

// Selecting with aliases gives rows in the entity's camelCase shape directly.
// A tagged template can be embedded in another one: `${userColumns}` inserts
// this fragment as SQL text, not as a parameter.
const userColumns = sql`id, email, password_hash as "passwordHash", role, created_at as "createdAt"`;

export async function findUserByEmail(email: string): Promise<UserEntity | null> {
  const rows = await sql<UserEntity[]>`select ${userColumns} from users where email = ${email}`;
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserEntity | null> {
  const rows = await sql<UserEntity[]>`select ${userColumns} from users where id = ${id}`;
  return rows[0] ?? null;
}

export async function listUsers(): Promise<UserEntity[]> {
  return await sql<UserEntity[]>`select ${userColumns} from users order by created_at desc`;
}

export async function insertUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
}): Promise<UserEntity> {
  try {
    const rows = await sql<UserEntity[]>`
      insert into users (id, email, password_hash, role)
      values (${user.id}, ${user.email}, ${user.passwordHash}, ${user.role})
      returning ${userColumns}
    `;
    const row = rows[0];
    if (!row) throw new Error("insert into users returned no row");
    return row;
  } catch (error) {
    if (error instanceof SQL.PostgresError && error.errno === UNIQUE_VIOLATION) {
      throw new ConflictError("Email already in use");
    }
    throw error;
  }
}

// Returns whether a row was deleted. The notifications of the user are deleted
// by the database itself (`on delete cascade` in the schema).
export async function deleteUserById(id: string): Promise<boolean> {
  const result = await sql`delete from users where id = ${id}`;
  return result.count > 0;
}
