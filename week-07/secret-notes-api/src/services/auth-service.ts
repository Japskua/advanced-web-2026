/**
 * Registration and login.
 *
 * Passwords are never stored. We store a *hash*: the output of a one-way
 * function. At login we hash the given password again and compare. If the
 * database leaks, the attacker gets hashes, not passwords.
 *
 * A password hash must be:
 * - salted: a random value is mixed in, so two users with the same password get
 *   different hashes and precomputed tables ("rainbow tables") are useless;
 * - slow: so that guessing billions of passwords per second is impossible.
 *   Fast hashes such as SHA-256 are the wrong tool for passwords.
 *
 * Bun.password does both. Its default algorithm is Argon2id, the current
 * recommendation; bcrypt is available too. The salt and the settings are stored
 * inside the hash string itself, e.g. "$argon2id$v=19$m=65536,t=2,p=1$…".
 */
import type { LoginResponse, PublicUser } from "@shared/types";
import { signToken } from "../middleware/auth-middleware";
import { createUser, EmailTakenError, findUserByEmail } from "../repositories/user-repository";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export async function register(email: string, password: string): Promise<PublicUser> {
  if (await findUserByEmail(email)) {
    throw new EmailTakenError();
  }

  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash: await Bun.password.hash(password), // argon2id, salted
  };
  await createUser(user);

  return { id: user.id, email: user.email };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const user = await findUserByEmail(email);

  // The same error for "no such user" and "wrong password". Different messages
  // would tell an attacker which email addresses have accounts.
  if (!user) throw new InvalidCredentialsError();

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  const publicUser: PublicUser = { id: user.id, email: user.email };
  return { token: await signToken(publicUser), user: publicUser };
}
