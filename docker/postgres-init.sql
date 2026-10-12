-- Runs once, the first time the PostgreSQL container starts with an empty
-- volume. Each week that uses a database gets its own, so schemas never clash.
--
-- The tables themselves are created by each project's `bun run db:setup`
-- script, which applies that project's sql/schema.sql.

create database image_gallery;           -- week 6
create database secret_notes;            -- week 7
create database notice_board;            -- week 8
create database secure_app_vulnerable;   -- week 11, SECURITY_MODE=vulnerable
create database secure_app_secure;       -- week 11, SECURITY_MODE=secure
create database file_vault;              -- week 12
