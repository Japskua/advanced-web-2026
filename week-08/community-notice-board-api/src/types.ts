/**
 * Types that are internal to the API.
 *
 * Entities describe rows of database tables, field for field, as the
 * repositories read them. They can contain things the outside world must never
 * see (passwordHash) and are shaped by the database, not by the client.
 * Entities never leave the API; src/mappers.ts turns them into the DTOs in
 * shared/types.ts.
 */
import type { Role } from "@shared/types";

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

export interface NotificationEntity {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  createdBy: string; // users.id of the author
}

// A notification joined with its author's email (one row of the list query).
export interface NotificationWithAuthorEntity extends NotificationEntity {
  authorEmail: string;
}

// The user making the request, as established by withAuth().
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
