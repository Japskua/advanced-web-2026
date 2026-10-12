// SQL for the notifications table.
import { sql } from "../db/client";
import type { NotificationEntity, NotificationWithAuthorEntity } from "../types";

// A join: each notification row is combined with the row of its author, so the
// list can show who wrote it without a second query per notification.
export async function listNotificationsWithAuthor(): Promise<NotificationWithAuthorEntity[]> {
  return await sql<NotificationWithAuthorEntity[]>`
    select
      n.id,
      n.title,
      n.content,
      n.created_at as "createdAt",
      n.created_by as "createdBy",
      u.email      as "authorEmail"
    from notifications n
    join users u on u.id = n.created_by
    order by n.created_at desc
  `;
}

export async function insertNotification(notification: {
  id: string;
  title: string;
  content: string;
  createdBy: string;
}): Promise<NotificationEntity> {
  const rows = await sql<NotificationEntity[]>`
    insert into notifications (id, title, content, created_by)
    values (${notification.id}, ${notification.title}, ${notification.content}, ${notification.createdBy})
    returning id, title, content, created_at as "createdAt", created_by as "createdBy"
  `;
  const row = rows[0];
  if (!row) throw new Error("insert into notifications returned no row");
  return row;
}
