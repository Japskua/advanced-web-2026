// Business rules for accounts: registration and login.
// Services work with entities and DTOs, throw AppErrors, and know nothing about
// HTTP requests or SQL.
import type { LoginResponse, Role, UserDto } from "@shared/types";
import { ConflictError, UnauthorizedError } from "../errors";
import { toUserDto } from "../mappers";
import * as userRepository from "../repositories/user-repository";
import { signToken } from "../util/jwt";

export async function registerUser(email: string, password: string, role: Role = "user"): Promise<UserDto> {
  if (await userRepository.findUserByEmail(email)) {
    throw new ConflictError("Email already in use");
  }

  const user = await userRepository.insertUser({
    id: crypto.randomUUID(),
    email,
    passwordHash: await Bun.password.hash(password),
    role,
  });
  return toUserDto(user);
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const user = await userRepository.findUserByEmail(email);

  // One message for both cases, so the response does not reveal which emails exist.
  if (!user || !(await Bun.password.verify(password, user.passwordHash))) {
    throw new UnauthorizedError("Invalid email or password");
  }

  return {
    token: await signToken(user),
    user: toUserDto(user),
  };
}
