import type { CreateNotificationBody, NotificationDto } from "@shared/types";
import { toNotificationDto } from "../mappers";
import * as notificationRepository from "../repositories/notification-repository";
import type { AuthUser } from "../types";

export async function listNotifications(): Promise<NotificationDto[]> {
  const notifications = await notificationRepository.listNotificationsWithAuthor();
  return notifications.map(toNotificationDto);
}

export async function createNotification(author: AuthUser, input: CreateNotificationBody): Promise<NotificationDto> {
  const notification = await notificationRepository.insertNotification({
    id: crypto.randomUUID(),
    title: input.title,
    content: input.content,
    // The author is the authenticated user, never a value from the request body.
    createdBy: author.id,
  });

  return toNotificationDto({ ...notification, authorEmail: author.email });
}
