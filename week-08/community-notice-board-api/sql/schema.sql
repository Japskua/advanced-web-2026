-- Database schema for the Community Notice Board. Apply with `bun run db:setup`.

create table if not exists users (
    id            uuid        primary key,
    email         text        not null unique,
    password_hash text        not null,
    -- Role-based access control: every user has exactly one role. The check
    -- constraint makes any other value impossible, whatever the code does.
    role          text        not null default 'user' check (role in ('user', 'admin')),
    created_at    timestamptz not null default now()
);

create table if not exists notifications (
    id         uuid        primary key,
    title      text        not null,
    content    text        not null,
    created_at timestamptz not null default now(),
    -- A foreign key: created_by must be the id of an existing user. When that
    -- user is deleted, their notifications are deleted with them.
    created_by uuid        not null references users (id) on delete cascade
);

create index if not exists notifications_created_at_idx on notifications (created_at desc);
