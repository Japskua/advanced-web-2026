-- Schema of the SECURE version. Applied (and reset) by `bun run db:setup`.

drop table if exists notes;
drop table if exists users;

create table users (
    id            uuid primary key,
    email         text not null unique,
    -- FIX (A04): only an Argon2id hash of the password is stored.
    password_hash text not null,
    role          text not null default 'user' check (role in ('user', 'admin'))
);

create table notes (
    id       uuid primary key,
    title    text not null,
    content  text not null,
    owner_id uuid not null references users (id) on delete cascade
);
