-- Schema of the VULNERABLE version. Applied (and reset) by `bun run db:setup`.

drop table if exists notes;
drop table if exists users;

create table users (
    id       uuid primary key,
    email    text not null unique,
    -- VULNERABILITY (A04 Cryptographic Failures): the password itself is
    -- stored. Anyone who can read this table (a backup, a SQL injection, a
    -- curious admin) learns every user's password, and people reuse passwords.
    password text not null,
    role     text not null default 'user'
);

create table notes (
    id       uuid primary key,
    title    text not null,
    content  text not null,
    owner_id uuid not null references users (id) on delete cascade
);
