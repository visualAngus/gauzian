# CLAUDE.md - Branche `front` (Frontend Nuxt 4 / Vue 3)

Guidance for Claude Code when working with the **GAUZIAN frontend**.

---

## Structure des Branches

> Cette branche (`front`) est **orpheline** — aucun ancêtre commun avec `main` ou `back`.
> Le code est à la **racine** (pas dans `gauzian_front/`).

| Branche | Rôle |
|---------|------|
| `back` | Code source Rust/Axum |
| **`front`** ← vous êtes ici | Code source Nuxt 4 |
| `main` | Orchestration K8s / déploiement |

**Workflow** : `git push origin front` → CI build Docker → deploy VPS automatique

---

## Quick Links

- **Crypto Architecture** : `docs/CRYPTO_ARCHITECTURE.md` (⭐ 1000 lignes, E2EE détaillé)
- **API Endpoints** : `API_ENDPOINTS.md`
- **README** : `README.md` (1100 lignes, architecture complète)

---

## Structure

```
front/ (racine)
├── app/
│   ├── pages/              # Routes (login, drive, agenda, info)
│   ├── composables/        # Logique réutilisable
│   │   ├── useAuth.js
│   │   ├── useFetchWithAuth.js
│   │   ├── useApiUrl.js
│   │   └── drive/ agenda/
│   ├── components/         # Composants Vue
│   └── utils/
│       └── crypto.ts       # ⭐ CORE E2EE (RSA-4096 + AES-256-GCM)
├── docs/
│   └── CRYPTO_ARCHITECTURE.md
├── nuxt.config.ts          # Config Nuxt (proxy dev + CSP + runtimeConfig)
├── package.json
└── Dockerfile
```

---

## Dev Local

```bash
npm install
npm run dev                 # http://localhost:3000
```

### Proxy API (dev uniquement)

Le proxy est configuré dans `nuxt.config.ts` via `routeRules` :

```ts
'/api/**': { proxy: 'https://gauzian.pupin.fr/api/**' }
```

- En dev : `apiUrl = '/api'` (défaut dans runtimeConfig) → proxy Nitro → prod
- En production : `NUXT_PUBLIC_API_URL=https://gauzian.pupin.fr/api` (K8s env var) → direct

> Pas besoin de `.env` en dev. Le défaut `/api` + le proxy suffisent.

---

## Build & Déploiement

```bash
# CI/CD automatique (recommandé)
git push origin front       # → build Docker + deploy VPS

# Manuel
npm run build
docker build -t angusvisual/gauzian-front:dev .
docker push angusvisual/gauzian-front:dev
ssh vps 'bash /home/debian/gauzian/k8s/scripts/ci-deploy.sh'
```

> **`[skip ci]`** dans le message de commit désactive le build/deploy automatique.

---

## Variables d'Environnement

| Variable | Dev | Production (K8s) |
|----------|-----|-----------------|
| `NUXT_PUBLIC_API_URL` | non requis (`/api` par défaut) | `https://gauzian.pupin.fr/api` |

---

## Architecture E2EE (côté client)

**Voir `docs/CRYPTO_ARCHITECTURE.md` pour détails (1000 lignes).**

- **RSA-4096** : Génération à l'inscription, clé privée chiffrée par mot de passe
- **AES-256-GCM** : Chiffrement fichiers et métadonnées
- **PBKDF2** (310k iterations) : Dérivation clé depuis mot de passe
- **IndexedDB** : Stockage clés avec `extractable: false`

---

## Composables Principaux

| Composable | Usage |
|------------|-------|
| `useAuth` | État authentification, login/logout |
| `useApiUrl` | URL API (respecte env var / défaut) |
| `useFetchWithAuth` | Fetch avec Authorization header auto |
| `useDriveData` | Chargement fichiers/dossiers |
| `useFileActions` | Upload, download, delete, share |
| `useEvents` | CRUD agenda (E2EE) |

---

## Commits (convention)

```
feat(drive): Add drag & drop upload
fix(crypto): Correct PBKDF2 iteration count
docs(composables): Update useAuth documentation [skip ci]
```

**Dernière mise à jour** : 2026-02-20
