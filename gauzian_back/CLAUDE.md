# CLAUDE.md - Backend

This file provides guidance to Claude Code (claude.ai/code) when working with the Rust backend.

## Build & Run

```bash
cargo build                    # Dev build
cargo build --release          # Prod build
cargo test                     # Run tests
cargo watch -x run             # Dev with hot reload
RUST_LOG=debug cargo run       # Run with debug logs
```

## Database

```bash
sqlx migrate run --database-url $DATABASE_URL
sqlx migrate add <name>
```

## Architecture

```
src/
├── main.rs       # Entry point, server init
├── state.rs      # AppState (DB pool, Redis, S3, JWT secret)
├── routes.rs     # Router definition
├── handlers.rs   # HTTP handlers (auth, drive operations)
├── drive.rs      # Core file/folder business logic
├── storage.rs    # S3/MinIO client wrapper
├── auth.rs       # Password hashing, JWT extraction, user queries
├── jwt.rs        # JWT create/decode
└── response.rs   # ApiResponse wrapper with cookie handling
```

## Key Patterns

### Authentication
- Token from Cookie (`auth_token=`) or `Authorization: Bearer`
- JWT validated in `auth.rs` via `FromRequestParts`
- Revocation checked against Redis blacklist

### Authorization
- `file_access`/`folder_access` tables control permissions
- `access_level`: `owner`, `editor`, `viewer`
- Soft delete via `is_deleted` flag

### File Upload
1. `initialize_file` → DB record, returns `file_id`
2. `upload_chunk` → encrypted chunks to MinIO
3. `finalize_upload` → marks `is_fully_uploaded = true`

## Environment Variables

- `DATABASE_URL`, `REDIS_URL`
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`
- `JWT_SECRET`
- `RUST_LOG` (optional)

## Security Fixes Needed

- `auth.rs:201` - Remove password hash logging
- `response.rs:84` - Set `secure(true)` for production
- `handlers.rs:381,943` - Add ownership check for chunk operations
- `auth.rs:151` - Migrate SHA256 to Argon2
