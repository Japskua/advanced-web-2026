/**
 * A fixed-window rate limiter for logins (FIX for A07).
 *
 * Without a limit, an attacker can try a list of common passwords against an
 * account as fast as the server answers (tools such as Hydra automate it).
 * Here each key (IP address + email) gets `limit` attempts per window; after
 * that the login answers 429 Too Many Requests until the window ends. A
 * successful login resets the counter.
 *
 * The attempt is counted *before* the password is checked, in the same
 * synchronous step as the limit check. Counting only after a failed check
 * would be too late: verifying a password takes a while (Argon2 is slow on
 * purpose), and an attacker who sends 100 guesses at once would get all 100
 * past the check before the first failure was recorded.
 *
 * Keying by IP *and* email means one attacker cannot lock a victim out from
 * everywhere, and one IP cannot hammer many accounts unnoticed... up to a
 * point: attackers with many IPs need defences further out (a WAF, the cloud
 * provider's bot protection, CAPTCHAs, MFA).
 *
 * The counters live in memory, so they are per server process and reset on
 * restart. A real deployment with several instances would keep them in Redis.
 */
export class RateLimiter {
  private readonly attempts = new Map<string, { count: number; windowEndsAt: number }>();
  private nextCleanupAt = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Use up one attempt for this key. Returns whether the attempt is allowed;
   * if not, how many seconds until the window ends.
   */
  consume(key: string, now = Date.now()): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    this.removeExpired(now);

    const entry = this.attempts.get(key);
    if (!entry) {
      this.attempts.set(key, { count: 1, windowEndsAt: now + this.windowMs });
      return { allowed: true };
    }
    if (entry.count >= this.limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((entry.windowEndsAt - now) / 1000) };
    }
    entry.count += 1;
    return { allowed: true };
  }

  // A successful login clears the counter.
  reset(key: string): void {
    this.attempts.delete(key);
  }

  // Forget windows that have ended, at most once a minute, so the map cannot
  // grow forever with one entry per email ever tried.
  private removeExpired(now: number): void {
    if (now < this.nextCleanupAt) return;
    for (const [key, entry] of this.attempts) {
      if (entry.windowEndsAt <= now) this.attempts.delete(key);
    }
    this.nextCleanupAt = now + 60_000;
  }
}
