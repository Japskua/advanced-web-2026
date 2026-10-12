import { SQL } from "bun";
import { sql } from "../db/client";

// A user as stored in the database, including the password hash. This type
// stays inside the API: only PublicUser ({ id, email }) is ever sent out.
export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

// Thrown when the email is already taken.
export class EmailTakenError extends Error {
  constructor() {
    super("Email already in use");
    this.name = "EmailTakenError";
  }
}

// PostgreSQL's error code for "unique constraint violated".
// Full list: https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = "23505";

export async function findUserByEmail(email: string): Promise<User | null> {
  // Columns can be renamed in the query (password_hash AS "passwordHash"), so
  // the rows already have the shape of the User type.
  const rows = await sql<User[]>`
    select id, email, password_hash as "passwordHash"
    from users
    where email = ${email}
  `;
  return rows[0] ?? null;
}

export async function createUser(user: User): Promise<void> {
  try {
    await sql`
      insert into users (id, email, password_hash)
      values (${user.id}, ${user.email}, ${user.passwordHash})
    `;
  } catch (error) {
    // Two registrations with the same email can both pass the service's
    // "does this email exist?" check if they arrive at the same moment. The
    // unique constraint catches the second one; here we turn the database
    // error into an error the service understands.
    if (error instanceof SQL.PostgresError && error.errno === UNIQUE_VIOLATION) {
      throw new EmailTakenError();
    }
    throw error;
  }
}
