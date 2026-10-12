// A UUID looks like 3f1c2b9e-8d4a-4c1e-9b7a-2f6d5e4c3b2a.
// Checking the format before querying matters: PostgreSQL rejects a malformed
// value for a uuid column with an error, and that error must not reach the
// client as a 500 (or worse, with database details in it).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
