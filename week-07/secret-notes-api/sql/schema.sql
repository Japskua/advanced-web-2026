-- Database schema for Secret Notes. Apply with `bun run db:setup`.

create table if not exists users (
    id            uuid        primary key,
    -- `unique` makes the database itself refuse a second account with the same
    -- email, even if two registrations arrive at the same moment.
    email         text        not null unique,
    -- Never the password itself: a salted, slow hash of it (see auth-service.ts).
    password_hash text        not null,
    created_at    timestamptz not null default now()
);

create table if not exists notes (
    id      uuid primary key default gen_random_uuid(),
    content text not null
);

-- Some secret notes to look at. `on conflict do nothing` + fixed ids keep this
-- script safe to run more than once.
insert into notes (id, content) values
    ('11111111-0000-4000-8000-000000000001', 'Top secret: React hooks are just functions'),
    ('11111111-0000-4000-8000-000000000002', 'Confidential: TypeScript saves lives'),
    ('11111111-0000-4000-8000-000000000003', 'Classified: console.log debugging is acceptable')
on conflict (id) do nothing;
