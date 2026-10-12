import type { UserDto } from "@shared/types";
import { BadRequestError, NotFoundError } from "../errors";
import { toUserDto } from "../mappers";
import * as userRepository from "../repositories/user-repository";
import type { AuthUser } from "../types";

export async function getCurrentUser(userId: string): Promise<UserDto> {
  const user = await userRepository.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  return toUserDto(user);
}

export async function listUsers(): Promise<UserDto[]> {
  const users = await userRepository.listUsers();
  return users.map(toUserDto);
}

// `actor` is the admin making the request. Business rules about *who* may do
// *what to whom* belong in the service, not in the handler.
export async function deleteUser(actor: AuthUser, userId: string): Promise<void> {
  // Deleting yourself would lock the last admin out of the admin pages.
  if (userId === actor.id) {
    throw new BadRequestError("Administrators cannot delete their own account.");
  }

  const deleted = await userRepository.deleteUserById(userId);
  if (!deleted) {
    throw new NotFoundError("User not found");
  }
}
