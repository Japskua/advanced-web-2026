/**
 * Mappers: entity → DTO.
 *
 * This is the one place where the internal shape of the data meets the public
 * one. The mapping decides what leaves the API: note that toUserDto() simply
 * has no way to output passwordHash. Adding a column to a table therefore never
 * exposes it by accident; it has to be added here deliberately.
 */
import type { NotificationDto, UserDto } from "@shared/types";
import type { NotificationWithAuthorEntity, UserEntity } from "./types";

export function toUserDto(user: UserEntity): UserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toNotificationDto(notification: NotificationWithAuthorEntity): NotificationDto {
  return {
    id: notification.id,
    title: notification.title,
    content: notification.content,
    createdAt: notification.createdAt.toISOString(),
    author: {
      id: notification.createdBy,
      email: notification.authorEmail,
    },
  };
}
