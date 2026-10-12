/**
 * The database connection.
 *
 * Bun has a PostgreSQL client built in: `SQL` from the "bun" module. No driver
 * package is needed. (MySQL and SQLite work through the same API.)
 *
 * A `SQL` instance manages a *pool* of connections. Opening a connection to
 * PostgreSQL is slow, so the pool keeps a few open and lends one to each query.
 * Connections are opened lazily, on the first query.
 *
 * Only the repositories import this module. The rest of the application does
 * not know that a database exists.
 */
import { SQL } from "bun";
import { DATABASE_URL } from "../config";

export const sql = new SQL({
  url: DATABASE_URL,
  max: 10, // at most 10 connections at a time
  idleTimeout: 30, // close connections that have been idle for 30 seconds
});
