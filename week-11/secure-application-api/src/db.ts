// One connection pool per version. Connections open lazily, so a pool that is
// never used never connects.
import { SQL } from "bun";
import { SECURE_DATABASE_URL, VULNERABLE_DATABASE_URL } from "./config";

export const vulnerableSql = new SQL({ url: VULNERABLE_DATABASE_URL, max: 5 });
export const secureSql = new SQL({ url: SECURE_DATABASE_URL, max: 5 });
