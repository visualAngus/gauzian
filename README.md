# GAUZIAN — Backend (Rust / Axum)

[![Rust](https://img.shields.io/badge/Backend-Rust-orange?logo=rust)](https://www.rust-lang.org/)

Branche `back` — code source du backend Rust/Axum.  
Voir la branche [`main`](../../tree/main) pour l'infrastructure K8s et le déploiement.

---

## Stack

- **Rust** (Axum) — API REST
- **PostgreSQL 17** + **SQLx** — stockage métadonnées chiffrées
- **Redis 7** — token revocation, cache
- **MinIO S3** — stockage chunks chiffrés

---

## Structure

```
src/
├── main.rs         # Entry point Axum
├── state.rs        # AppState (DB, Redis, S3, JWT)
├── routes.rs       # Définition des routes
├── auth/           # Register, login, JWT
├── drive/          # Fichiers/dossiers E2EE (47 handlers)
├── agenda/         # Calendrier chiffré
├── storage.rs      # Client MinIO/S3
├── metrics.rs      # Prometheus (17 métriques)
└── ARCHITECTURE.md # ⭐ Architecture détaillée (26KB)
migrations/         # SQLx migrations (15 fichiers)
docs/               # DATABASE_SCHEMA.md, ENV_VARIABLES.md
```

---

## Développement

```bash
cargo build
cargo run
RUST_LOG=debug cargo run
cargo test
cargo watch -x run
```

### Migrations

```bash
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &
sqlx migrate run --database-url $DATABASE_URL
```

---

## Déploiement

```bash
git push origin back   # → CI/CD build Docker + deploy VPS automatique
```

> Ajouter `[skip ci]` dans le message de commit pour éviter le déploiement.

---

## Documentation

- [`src/ARCHITECTURE.md`](src/ARCHITECTURE.md) — Architecture détaillée (26KB)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — Schéma DB + ERD (700 lignes)
- [`docs/ENV_VARIABLES.md`](docs/ENV_VARIABLES.md) — Variables d'environnement
- [`METRICS_USAGE_EXAMPLES.md`](METRICS_USAGE_EXAMPLES.md) — Requêtes Prometheus

---

## Sécurité E2EE

Le serveur ne voit **jamais** les données en clair.  
RSA-4096 · AES-256-GCM · PBKDF2 (310k iterations) · Argon2id
