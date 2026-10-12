-- Database schema for the Encrypted File Vault. Apply with `bun run db:setup`
-- (locally, or against Azure by pointing DATABASE_URL at the Azure server).

create table if not exists users (
    id              uuid        primary key,
    email           text        not null unique,
    password_hash   text        not null,
    -- SHA-256 of the user's encryption key (hex). Null until onboarding.
    -- The key itself never reaches the server.
    key_fingerprint text        null check (key_fingerprint ~ '^[0-9a-f]{64}$'),
    created_at      timestamptz not null default now()
);

create table if not exists files (
    id                   uuid        primary key,
    owner_id             uuid        not null references users (id) on delete cascade,
    original_filename    text        not null,
    -- Where the encrypted bytes are in Blob Storage: "<owner id>/<file id>".
    blob_name            text        not null unique,
    content_type         text        not null,
    size_bytes           integer     not null check (size_bytes >= 0),
    encryption_algorithm text        not null check (encryption_algorithm = 'AES-GCM'),
    encryption_iv        text        not null,
    created_at           timestamptz not null default now()
);

create index if not exists files_owner_created_idx on files (owner_id, created_at desc);
