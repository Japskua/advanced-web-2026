/**
 * Server-side sessions.
 *
 * Week 7 kept the login state in a JWT that the client stored and sent back.
 * This week the state stays on the server: after login we create a session (a
 * random id → the user's profile) and give the browser only the id, in an
 * HttpOnly cookie.
 *
 *   JWT (week 7)                         Session cookie (week 10)
 *   state lives in the token             state lives on the server
 *   JavaScript can read it               HttpOnly: JavaScript cannot read it
 *   cannot be revoked before expiry      delete the session = logged out now
 *   no server storage needed             server must store sessions
 *
 * Sessions are kept in memory, so they disappear when the server restarts and
 * are not shared between several server processes. Real deployments use a
 * shared store (Redis, the database).
 */
import type { UserProfile } from "@shared/types";
import { SESSION_TTL_MS } from "../config";

interface Session {
  profile: UserProfile;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function removeExpiredSessions(now = Date.now()): void {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

export function createSession(profile: Omit<UserProfile, "signedInAt">): string {
  removeExpiredSessions();

  // 122 random bits: impossible to guess. A session id is as good as a
  // password while it is valid.
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    profile: { ...profile, signedInAt: new Date().toISOString() },
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return sessionId;
}

export function getSession(sessionId: string): UserProfile | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session.profile;
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}
