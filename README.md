# GAUZIAN — Frontend (Nuxt 4 / Vue 3)

[![Nuxt](https://img.shields.io/badge/Frontend-Nuxt%204-00DC82?logo=nuxt.js)](https://nuxt.com/)

Branche `front` — code source du frontend Nuxt 4.  
Voir la branche [`main`](../../tree/main) pour l'infrastructure K8s et le déploiement.

---

## Stack

- **Nuxt 4** / **Vue 3** / **TypeScript**
- **Web Crypto API** — chiffrement E2EE côté client
- **IndexedDB** — stockage clés non-extractables

---

## Structure

```
app/
├── pages/           # login, drive, agenda, info
├── composables/
│   ├── useAuth.js
│   ├── useFetchWithAuth.js
│   ├── useApiUrl.js
│   └── drive/ agenda/
├── components/      # FileItem, EventModal, etc.
└── utils/
    └── crypto.ts    # ⭐ CORE E2EE (RSA-4096 + AES-256-GCM)
docs/
└── CRYPTO_ARCHITECTURE.md  # ⭐ E2EE détaillé (1000 lignes)
nuxt.config.ts       # Proxy dev + CSP + runtimeConfig
```

---

## Développement

```bash
npm install
npm run dev          # http://localhost:3000
```

Le proxy API est configuré automatiquement dans `nuxt.config.ts` :  
les requêtes `/api/*` sont redirigées vers `gauzian.pupin.fr` en dev (pas de CORS).

---

## Déploiement

```bash
git push origin front  # → CI/CD build Docker + deploy VPS automatique
```

> Ajouter `[skip ci]` dans le message de commit pour éviter le déploiement.

---

## Documentation

- [`docs/CRYPTO_ARCHITECTURE.md`](docs/CRYPTO_ARCHITECTURE.md) — Architecture E2EE (1000 lignes)
- [`API_ENDPOINTS.md`](API_ENDPOINTS.md) — Endpoints agenda

---

## Sécurité E2EE côté client

- **RSA-4096** : génération à l'inscription, clé privée chiffrée par mot de passe
- **AES-256-GCM** : chiffrement fichiers + métadonnées
- **PBKDF2** (310k iterations) : dérivation depuis mot de passe
- Clés stockées avec `extractable: false` → impossible à exfiltrer via JS
