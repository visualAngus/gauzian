# CLAUDE.md - Branche `back` (Backend Rust / Axum)

Guidance for Claude Code when working with the **GAUZIAN backend**.

---

## Structure des Branches

> Cette branche (`back`) est **orpheline** — aucun ancêtre commun avec `main` ou `front`.
> Le code est à la **racine** (pas dans `gauzian_back/`).

| Branche | Rôle |
|---------|------|
| **`back`** ← vous êtes ici | Code source Rust/Axum |
| `front` | Code source Nuxt 4 |
| `main` | Orchestration K8s / déploiement |

**Workflow** : `git push origin back` → CI build Docker → deploy VPS automatique

---

## Quick Links

- **Architecture Backend** : `src/ARCHITECTURE.md` (⭐ 26KB)
- **Database Schema** : `docs/DATABASE_SCHEMA.md` (⭐ 700 lignes, ERD Mermaid)
- **Environment Variables** : `docs/ENV_VARIABLES.md`
- **Metrics** : `METRICS_USAGE_EXAMPLES.md`

---

## Structure

```
back/ (racine)
├── src/
│   ├── main.rs             # Entry point, serveur Axum
│   ├── state.rs            # AppState (DB pool, Redis, S3, JWT)
│   ├── routes.rs           # Définition des routes
│   ├── auth/               # Module authentification
│   ├── drive/              # Module fichiers/dossiers E2EE
│   ├── agenda/             # Module calendrier (en développement)
│   ├── storage.rs          # Client S3/MinIO
│   ├── metrics.rs          # Prometheus (17 métriques)
│   └── ARCHITECTURE.md     # ⭐ Architecture détaillée
├── migrations/             # Migrations SQLx
├── docs/                   # Documentation
├── Cargo.toml
├── Cargo.lock
└── Dockerfile              # Build production
```

---

## Build & Run

```bash
cargo build
cargo build --release
cargo run
RUST_LOG=debug cargo run
cargo test
cargo watch -x run
```

### Database Migrations

```bash
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &
sqlx migrate run --database-url $DATABASE_URL
sqlx migrate add <nom_migration>
```

---

## Déploiement

```bash
# CI/CD automatique (recommandé)
git push origin back        # → build Docker + deploy VPS

# Manuel
docker build -t angusvisual/gauzian-backend:dev .
docker push angusvisual/gauzian-backend:dev
ssh vps 'bash /home/debian/gauzian/k8s/scripts/ci-deploy.sh'
```

> **`[skip ci]`** dans le message de commit désactive le build/deploy automatique.

---

## Variables d'Environnement

Voir `docs/ENV_VARIABLES.md` pour liste complète.

| Variable | Obligatoire |
|----------|-------------|
| `DATABASE_URL` | ✅ |
| `REDIS_URL` | ✅ |
| `S3_ENDPOINT` | ✅ |
| `S3_ACCESS_KEY` | ✅ |
| `S3_SECRET_KEY` | ✅ |
| `S3_BUCKET` | ✅ |
| `JWT_SECRET` | ✅ |
| `COOKIE_SECURE` | ✅ (prod) |

---

## Commits (convention)

```
feat(drive): Add folder sharing
fix(auth): Correct JWT expiration
docs(api): Update endpoint documentation [skip ci]
```

---

## Règles Git — À RESPECTER ABSOLUMENT

- **Ne jamais merger une PR / branche dans `back` sans validation explicite du propriétaire.**
- **Ne jamais pusher directement sur `back` un changement non demandé.**
- Toujours créer une branche feature (`feat/...`, `fix/...`) et ouvrir une PR.
- La PR est **revue et mergée par le propriétaire uniquement**. Claude ne merge jamais.
- En cas de doute : demander avant d'agir.

**Dernière mise à jour** : 2026-02-21
