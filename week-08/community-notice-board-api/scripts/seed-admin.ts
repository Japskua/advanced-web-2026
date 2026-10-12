/**
 * Creates the first administrator: `bun run seed:admin`.
 *
 * Registration through the API always creates ordinary users (otherwise anyone
 * could make themselves an admin). The first admin is therefore created from
 * the command line, by someone with access to the server and its .env file.
 * Running the script again does nothing if the admin already exists.
 *
 * It reuses the normal service, so the admin's password is hashed and checked
 * against the password policy exactly like everyone else's.
 */
import { sql } from "../src/db/client";
import { findUserByEmail } from "../src/repositories/user-repository";
import { registerUser } from "../src/services/auth-service";
import { parseRegisterBody } from "../src/util/validation";

try {
  const { email, password } = parseRegisterBody({
    email: Bun.env.ADMIN_EMAIL,
    password: Bun.env.ADMIN_PASSWORD,
  });

  const existing = await findUserByEmail(email);
  if (existing) {
    console.log(`A user with the email ${email} already exists (role: ${existing.role}). Nothing to do.`);
  } else {
    const admin = await registerUser(email, password, "admin");
    console.log(`Created administrator ${admin.email}. Log in with the password from .env.`);
  }
} catch (error) {
  console.error("Could not create the administrator:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.close();
}
