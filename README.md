# GAUZIAN — Cloud souverain, zero-knowledge, haute performance

[![Rust](https://img.shields.io/badge/Backend-Rust-orange?logo=rust)](https://www.rust-lang.org/)
[![Nuxt](https://img.shields.io/badge/Frontend-Nuxt%204-00DC82?logo=nuxt.js)](https://nuxt.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql)](https://www.postgresql.org/)
[![K8s](https://img.shields.io/badge/Infra-Kubernetes-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()
[![Status](https://img.shields.io/badge/Status-Production%20Beta-green)]()

> **GAUZIAN** — La souveraineté numérique n'est pas un slogan, c'est quelque chose que l'on construit, ligne par ligne.

---

## 🎯 Vision

GAUZIAN est une **suite applicative cloud européenne** zero-knowledge.  
Le serveur ne voit **jamais** les données en clair — tout le chiffrement se fait côté client.

**Modèle économique** : Freemium (3 Go gratuits) + offres payantes.

---

## 🔗 Essayer Gauzian

### [gauzian.pupin.fr](https://gauzian.pupin.fr)

- ✅ Création de compte avec chiffrement E2EE automatique
- ✅ Upload/download de fichiers chiffrés
- ✅ Partage sécurisé avec rechiffrement par destinataire
- ✅ Gestion des permissions (owner/editor/viewer)

> Instance Beta — vos fichiers sont chiffrés, le serveur ne peut pas les lire.

---

## 📦 Produits

| Service | Statut | Description |
|---------|--------|-------------|
| **GZ ID** | ✅ Production | Authentification JWT + Redis, Argon2id |
| **GZ DRIVE** | ✅ Production | Stockage E2EE, partage, corbeille |
| **GZ AGENDA** | 🔄 En cours | Calendrier chiffré, partage d'événements |
| **GZ MAIL** | ⏸️ En pause | Messagerie sécurisée SMTP/IMAP |

---

## 🏗️ Structure du Repository

Ce repo est organisé en **3 branches indépendantes** (orphelines) :

| Branche | Rôle | CI/CD |
|---------|------|-------|
| [`back`](../../tree/back) | Code Rust/Axum (API backend) | Build Docker + Deploy VPS |
| [`front`](../../tree/front) | Code Nuxt 4 / Vue 3 (frontend) | Build Docker + Deploy VPS |
| [`main`](../../tree/main) | Orchestration K8s, scripts, docs | Deploy VPS |
| `archive/before-restructure` | Snapshot mono-repo initial | — |

```
main/
├── k8s/                    # Manifests Kubernetes (28 fichiers)
├── .github/workflows/      # CI/CD (build + deploy automatiques)
├── docs/                   # Documentation sécurité, partage E2EE
├── tests/                  # SQLMap, k6 load tests
├── push_docker_hub.sh
└── DEPLOYMENT.md
```

---

## 🔐 Sécurité Zero-Knowledge

### Algorithmes

| Usage | Algorithme |
|-------|-----------|
| Échange de clés | RSA-4096 (OAEP, SHA-256) |
| Chiffrement fichiers | AES-256-GCM |
| Dérivation mot de passe | PBKDF2 (310 000 itérations) |
| Hachage mots de passe | Argon2id |
| Stockage clés client | IndexedDB (`extractable: false`) |

### Garanties

- Le serveur ne voit que des **blobs chiffrés**
- Les clés privées ne quittent **jamais** le navigateur en clair
- Partage E2EE par **rechiffrement asymétrique** (pas de partage de clé maître)
- Clés non-exportables via JavaScript (Web Crypto API)

### Mesures Anti-abus

- ✅ Rate limiting (100 req/s API, 50 req/s S3)
- ✅ IDOR protection sur tous les endpoints sensibles
- ✅ Token revocation (blacklist Redis, fail-closed)
- ✅ SQL injection : requêtes paramétrées SQLx (compile-time)
- ✅ Secure cookies (`HttpOnly`, `SameSite=Strict`)
- ✅ CodeQL : analyse Rust + JS/TS automatique sur chaque push

---

## 🚀 Stack Technique

**Backend** (`back`) : Rust (Axum) · SQLx · PostgreSQL 17 · Redis 7 · MinIO S3

**Frontend** (`front`) : Nuxt 4 · Vue 3 · TypeScript · Web Crypto API

**Infrastructure** (`main`) : Kubernetes (K3s) · Traefik · Prometheus · Grafana · Docker Hub

---

## 📊 Infrastructure K8s

**Voir [`k8s/README.md`](k8s/README.md) pour détails (800 lignes).**

| URL | Service |
|-----|---------|
| [gauzian.pupin.fr](https://gauzian.pupin.fr) | Frontend |
| [gauzian.pupin.fr/api](https://gauzian.pupin.fr/api) | Backend API |
| [grafana.gauzian.pupin.fr](https://grafana.gauzian.pupin.fr) | Monitoring |
| [minio.gauzian.pupin.fr](https://minio.gauzian.pupin.fr) | MinIO Console |

Auto-scaling HPA : 2 → 10 replicas (CPU > 50% / RAM > 70%)

---

## 📚 Documentation

- [`k8s/README.md`](k8s/README.md) — Infrastructure Kubernetes (800 lignes)
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Guide déploiement complet
- [`docs/SECURITY_TESTING.md`](docs/SECURITY_TESTING.md) — Tests SQLMap, Nikto
- [`CLAUDE.md`](CLAUDE.md) — Guide Claude Code (branches, CI/CD)
- [`DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md) — Journal de bord

---

## 📜 Roadmap 2026

- **Q1** : GZ AGENDA beta + finalisation CI/CD
- **Q2** : Notifications E2EE + révocation d'accès UI
- **Q3** : Application mobile
- **Q4** : Version 1.0 stable + offres payantes

---

## 📜 Licence

Propriétaire © 2026 GAUZIAN. Tous droits réservés.
