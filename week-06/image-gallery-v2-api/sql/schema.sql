-- Database schema for the image gallery.
-- Apply it with `bun run db:setup` (or paste it into psql / pgAdmin).
-- "if not exists" makes the script safe to run more than once.

create table if not exists uploads (
    id            uuid        primary key,
    filename      text        not null unique,
    original_name text        not null,
    mime_type     text        not null,
    size          integer     not null check (size > 0),
    -- timestamptz stores an absolute point in time (converted to UTC).
    -- The database fills it in when the row is inserted.
    uploaded_at   timestamptz not null default now()
);

-- The gallery is always listed newest first; this index makes that ordering
-- cheap even with many rows.
create index if not exists uploads_uploaded_at_idx on uploads (uploaded_at desc);
