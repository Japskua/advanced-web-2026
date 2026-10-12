import { timingSafeEqual } from "node:crypto";
import type { LoginResponse, RegisterBody, UserDto } from "@shared/types";
import { INVITE_CODE } from "../config";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../errors";
import { toUserDto } from "../mappers";
import * as userRepository from "../repositories/user-repository";
import type { AuthUser } from "../types";
import { signToken } from "../util/jwt";

// Compare secrets in constant time, so the response time does not reveal how
// many leading characters of a guess were right.
function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function registerUser(input: RegisterBody): Promise<UserDto> {
  if (!safeEqual(input.inviteCode, INVITE_CODE)) {
    throw new ForbiddenError("Invalid invitation code");
  }
  if (await userRepository.findUserByEmail(input.email)) {
    throw new ConflictError("Email already in use");
  }

  const user = await userRepository.insertUser({
    id: crypto.randomUUID(),
    email: input.email,
    passwordHash: await Bun.password.hash(input.password),
  });
  return toUserDto(user);
}

// Same work for unknown emails as for wrong passwords (week 11, A07).
const DUMMY_HASH = await Bun.password.hash(crypto.randomUUID());

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const user = await userRepository.findUserByEmail(email);
  const valid = await Bun.password.verify(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new UnauthorizedError("Invalid email or password");

  return { token: await signToken(user.id), user: toUserDto(user) };
}

// Onboarding: remember the fingerprint of the key the browser just generated.
// It can be set once. Changing it would make every existing file undecryptable
// with the new key, so that would need a re-encryption feature first.
export async function setKeyFingerprint(user: AuthUser, fingerprint: string): Promise<UserDto> {
  const updated = await userRepository.setKeyFingerprintOnce(user.id, fingerprint);
  if (!updated) throw new ConflictError("An encryption key is already set up for this account");
  return toUserDto(updated);
}
