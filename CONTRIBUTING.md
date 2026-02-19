# Contributing to GAUZIAN

Merci de contribuer à **GAUZIAN** ! Ce guide décrit le workflow de contribution, les standards de code, et les best practices.

---

## Table des Matières

1. [Getting Started](#getting-started)
2. [Workflow Git](#workflow-git)
3. [Commit Messages](#commit-messages)
4. [Pull Requests](#pull-requests)
5. [Code Standards](#code-standards)
6. [Testing](#testing)
7. [Documentation](#documentation)
8. [Security](#security)

---

## Getting Started

### Prerequisites

**Backend (Rust)** :
- Rust stable (1.70+)
- PostgreSQL 17
- Redis 7
- MinIO (S3-compatible storage)

**Frontend (Nuxt)** :
- Node.js 20+
- npm 10+

**Deployment** :
- Docker & Docker Compose
- Kubernetes cluster (K3s) sur VPS
- **OU** Clever Cloud account

---

### Clone et Setup

```bash
# Clone le repository
git clone https://github.com/yourusername/gauzian.git
cd gauzian

# Backend setup
cd gauzian_back
cargo build
cargo test

# Frontend setup
cd ../gauzian_front
npm install
npm run dev
```

**⚠️ Note** : Pas de développement local classique. Le projet est déployé directement sur **VPS K8s** ou **Clever Cloud**.

---

## Workflow Git

### Branches

Le projet utilise le workflow **GitFlow** simplifié :

```
main                    # Production (protected)
  └── feat/<feature>    # Feature branches
  └── fix/<bugfix>      # Bugfix branches
  └── docs/<topic>      # Documentation updates
  └── refactor/<name>   # Code refactoring
```

**Protected Branches** :
- `main` : Déployé automatiquement en production
- Nécessite PR review + CI passing

---

### Créer une Branch

```bash
# Pull les dernières modifications
git checkout main
git pull origin main

# Créer une feature branch
git checkout -b feat/user-avatar-upload

# Ou bugfix
git checkout -b fix/chunked-upload-timeout

# Ou docs
git checkout -b docs/api-documentation
```

**Naming Convention** :
- `feat/` : Nouvelle fonctionnalité
- `fix/` : Correction de bug
- `docs/` : Documentation
- `refactor/` : Refactoring (pas de changement fonctionnel)
- `test/` : Ajout de tests
- `chore/` : Tâches de maintenance (update dependencies, etc.)

---

### Faire des Commits

```bash
# Ajouter les modifications
git add gauzian_back/src/auth/handlers.rs
git add gauzian_front/app/pages/login.vue

# Créer un commit
git commit -m "feat(auth): Add password reset functionality

- Add POST /auth/reset-password endpoint
- Generate secure reset tokens (256-bit)
- Send reset email via SMTP
- Add 15-minute token expiration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**⚠️ IMPORTANT** : Voir [Commit Messages](#commit-messages) pour le format attendu.

---

### Push et PR

```bash
# Push la branch vers GitHub
git push origin feat/user-avatar-upload

# Créer une Pull Request
gh pr create --title "feat(auth): Add password reset functionality" \
  --body "## Summary
- Add password reset endpoint
- Generate secure tokens
- Email integration

## Test plan
- [ ] Test reset token generation
- [ ] Test email sending
- [ ] Test token expiration
- [ ] Test invalid tokens

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Commit Messages

### Format Conventional Commits

**Format** :

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types** :
- `feat` : Nouvelle fonctionnalité
- `fix` : Correction de bug
- `docs` : Documentation seulement
- `style` : Formatage (pas de changement de code)
- `refactor` : Refactoring (pas de bug fix, pas de nouvelle feature)
- `perf` : Optimisation de performance
- `test` : Ajout de tests
- `chore` : Maintenance (dependencies, build, CI)

**Scopes** :
- `auth` : Authentification
- `drive` : Fichiers/dossiers
- `agenda` : Calendrier
- `crypto` : E2EE operations
- `api` : Backend API
- `ui` : Frontend UI
- `k8s` : Kubernetes
- `db` : Database migrations

---

### Examples

**Feature** :

```
feat(drive): Add folder sharing with E2EE

- Implement POST /drive/share_folder_batch endpoint
- Wrap folder_key with recipient's RSA public key
- Recursively share all files in folder
- Add permission checks (owner only)

Closes #42
```

**Bug Fix** :

```
fix(auth): Fix JWT token expiration check

The token expiration was checked against wrong timestamp,
causing valid tokens to be rejected after 1 hour instead of 10 days.

- Fix exp claim comparison (use seconds, not milliseconds)
- Add unit test for token validation

Fixes #123
```

**Documentation** :

```
docs(api): Add OpenAPI spec for drive endpoints

- Document all 31 drive endpoints
- Add request/response schemas
- Add curl examples
```

**Refactoring** :

```
refactor(drive): Extract chunked upload logic to service layer

- Move upload logic from handlers to services
- Improve testability (mock S3 client)
- No functional changes
```

---

### Co-Authored-By

Si vous travaillez avec Claude Code ou un autre contributeur, ajoutez une ligne `Co-Authored-By` :

```
feat(auth): Add two-factor authentication

- Add TOTP support with qrcode generation
- Add backup codes (10 codes, SHA-256 hashed)
- Add /auth/2fa/setup and /auth/2fa/verify endpoints

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
Co-Authored-By: John Doe <john@example.com>
```

---

## Pull Requests

### PR Title Format

Même format que les commits :

```
feat(drive): Add folder sharing with E2EE
fix(auth): Fix JWT token expiration check
docs(api): Add OpenAPI spec for drive endpoints
```

---

### PR Description Template

```markdown
## Summary

Brief description of changes (2-3 sentences).

## Changes

- [ ] Add new endpoint POST /drive/share_folder
- [ ] Update database schema (add folder_access table)
- [ ] Add E2EE key wrapping for folder sharing
- [ ] Update frontend ShareModal component

## Test Plan

How to test these changes:

1. Create a folder with files
2. Share folder with another user
3. Verify recipient can access all files
4. Verify E2EE: recipient can decrypt files

## Screenshots (if UI changes)

![Before](https://...)
![After](https://...)

## Related Issues

Closes #42
Fixes #123

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

### PR Review Process

1. **Create PR** : Push branch → créer PR sur GitHub
2. **CI Checks** : Attendre que les tests passent (GitHub Actions)
   - Backend : `cargo test`, `cargo clippy`, `cargo fmt --check`
   - Frontend : `npm test`, `npm run lint`
3. **Code Review** : Au moins 1 reviewer doit approuver
4. **Address Feedback** : Corriger les commentaires si nécessaire
5. **Merge** : Squash & merge vers `main`
6. **Deploy** : Déploiement automatique sur VPS K8s ou Clever Cloud

---

### Review Checklist

**Pour les Reviewers** :

- [ ] Le code suit les [Code Standards](#code-standards)
- [ ] Les tests sont ajoutés/mis à jour
- [ ] La documentation est mise à jour (CLAUDE.md, README, etc.)
- [ ] Pas de secrets hardcodés (JWT_SECRET, API keys, etc.)
- [ ] Pas de `console.log` sensibles (passwords, tokens)
- [ ] Les migrations DB sont incluses (si schema change)
- [ ] Le commit message suit le format Conventional Commits

---

## Code Standards

### Backend (Rust)

**Voir** : [`gauzian_back/docs/BEST_PRACTICES_RUST.md`](gauzian_back/docs/BEST_PRACTICES_RUST.md)

**Règles principales** :

1. ✅ **Architecture** : Modulariser (handlers → services → repo)
2. ✅ **Errors** : Utiliser `Result<T, AppError>` + `?` operator
3. ✅ **Database** : `query!` (compile-time checked) + connection pooling
4. ✅ **Async** : `async fn` pour I/O, `spawn_blocking` pour CPU
5. ✅ **Security** : Argon2, strong JWT secrets, input validation, CORS strict
6. ✅ **Logging** : `tracing` (structured) + Prometheus metrics
7. ❌ **Never** : `unwrap()` en prod, `std::sync::Mutex` dans async, logger secrets

**Formatter & Linter** :

```bash
# Formatter
cargo fmt

# Linter
cargo clippy -- -D warnings

# Tests
cargo test
```

---

### Frontend (Vue 3 / Nuxt 4)

**Voir** : [`gauzian_front/docs/BEST_PRACTICES_FRONTEND.md`](gauzian_front/docs/BEST_PRACTICES_FRONTEND.md)

**Règles principales** :

1. ✅ **Vue 3** : `<script setup>`, `ref`/`reactive`, `computed`, `watch`
2. ✅ **Nuxt 4** : `useState` pour état global, `navigateTo` pour navigation
3. ✅ **Crypto** : IV unique, IndexedDB non-extractable, PBKDF2 310k, cleanup au logout
4. ✅ **API** : `credentials: 'include'`, error handling, éviter N+1
5. ✅ **Security** : XSS prevention (sanitize), CSP headers, pas d'eval()
6. ✅ **Testing** : Unit tests (Vitest) + component tests (@vue/test-utils)
7. ❌ **Never** : Oublier `.value`, destructurer reactive, mutate props, memory leaks

**Formatter & Linter** :

```bash
# Formatter
npm run format  # (Prettier)

# Linter
npm run lint  # (ESLint)

# Tests
npm test
```

---

### Database Migrations

**Créer une migration** :

```bash
cd gauzian_back
sqlx migrate add add_folder_access_table
```

**Éditer la migration** :

```sql
-- migrations/XXXXXXX_add_folder_access_table.up.sql
CREATE TABLE IF NOT EXISTS folder_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_folder_key TEXT NOT NULL,
    access_level TEXT NOT NULL CHECK (access_level IN ('owner', 'editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(folder_id, user_id)
);

CREATE INDEX idx_folder_access_user_id ON folder_access(user_id);
CREATE INDEX idx_folder_access_folder_id ON folder_access(folder_id);
```

**Tester la migration** :

```bash
# Apply migration
sqlx migrate run --database-url $DATABASE_URL

# Vérifier le schema
psql $DATABASE_URL -c "\d folder_access"

# Rollback si erreur
sqlx migrate revert --database-url $DATABASE_URL
```

---

## Testing

### Backend Tests

**Unit Tests** :

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_email() {
        assert!(validate_email("user@example.com").is_ok());
        assert!(validate_email("invalid-email").is_err());
    }

    #[tokio::test]
    async fn test_hash_password() {
        let password = "password123";
        let hash = hash_password(password).await.unwrap();

        assert!(verify_password(password, &hash).await.unwrap());
        assert!(!verify_password("wrong_password", &hash).await.unwrap());
    }
}
```

**Integration Tests** :

```rust
// tests/integration_test.rs
use sqlx::PgPool;

async fn setup_test_db() -> PgPool {
    let pool = PgPoolOptions::new()
        .connect("postgres://localhost/test_db")
        .await
        .unwrap();

    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    pool
}

#[tokio::test]
async fn test_create_user() {
    let pool = setup_test_db().await;

    let user = repo::create_user(&pool, "test@example.com", "password123")
        .await
        .unwrap();

    assert_eq!(user.email, "test@example.com");

    // Cleanup
    sqlx::query!("DELETE FROM users WHERE id = $1", user.id)
        .execute(&pool)
        .await
        .unwrap();
}
```

**Lancer les tests** :

```bash
cargo test
cargo test --test integration  # Integration tests seulement
```

---

### Frontend Tests

**Unit Tests (Composables)** :

```javascript
// tests/composables/useAuth.test.js
import { describe, it, expect, vi } from 'vitest';
import { useAuth } from '~/composables/useAuth';

describe('useAuth', () => {
  it('should login successfully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user_id: '123', token: 'abc' })
    });

    const { login, isAuthenticated } = useAuth();
    await login('test@example.com', 'password123');

    expect(isAuthenticated.value).toBe(true);
  });
});
```

**Component Tests** :

```javascript
import { mount } from '@vue/test-utils';
import FileItem from '~/components/FileItem.vue';

describe('FileItem', () => {
  it('should render file name', () => {
    const wrapper = mount(FileItem, {
      props: {
        file: { id: '123', encrypted_metadata: 'test.pdf', size: 1024 }
      }
    });

    expect(wrapper.text()).toContain('test.pdf');
  });
});
```

**Lancer les tests** :

```bash
npm test
npm run test:watch  # Watch mode
npm run test:coverage  # Coverage report
```

---

### Test Coverage

**Objectif** : Maintenir une couverture de tests > 80%.

```bash
# Backend
cargo tarpaulin --out Html

# Frontend
npm run test:coverage
```

---

## Documentation

### Quoi Documenter

**Code** :
- [ ] Fonctions publiques (docstrings Rust, JSDoc)
- [ ] Modules (fichiers README.md)
- [ ] API endpoints (OpenAPI spec)

**Architecture** :
- [ ] Nouveaux modules (ajouter à ARCHITECTURE.md)
- [ ] Nouvelles dépendances (ajouter à CLAUDE.md)
- [ ] Database schema changes (mettre à jour DATABASE_SCHEMA.md)

**Deployment** :
- [ ] Nouvelles variables d'environnement (DEPLOYMENT.md)
- [ ] Nouvelles configurations K8s (k8s/README.md)

---

### Mise à Jour de CLAUDE.md

Si vous ajoutez une nouvelle feature, mettre à jour les fichiers CLAUDE.md :

**Backend** : `gauzian_back/CLAUDE.md`
- Ajouter la route dans "Architecture" section
- Ajouter les variables d'environnement si nécessaire
- Ajouter les métriques Prometheus si créées

**Frontend** : `gauzian_front/CLAUDE.md`
- Ajouter le composable/page dans "Architecture" section
- Ajouter les variables d'environnement si nécessaire
- Documenter les nouveaux patterns crypto si applicable

---

### Documentation API

**Mettre à jour** : `gauzian_back/docs/API_DOCUMENTATION.md`

Ajouter la documentation du nouvel endpoint :

```markdown
### POST `/drive/share_folder_batch`

**Description** : Partage un dossier ET tous ses fichiers/sous-dossiers récursivement (E2EE).

**Authentification** : ✅ Requise

**Request Body** :

\`\`\`json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "encrypted_folder_key": "<folder_key_wrapped_with_recipient_rsa>",
  "encrypted_file_keys": {
    "880e8400-e29b-41d4-a716-446655440003": "<file_key_wrapped>",
    "990e8400-e29b-41d4-a716-446655440008": "<file_key_wrapped>"
  },
  "access_level": "editor"
}
\`\`\`

**Response** : `200 OK`
```

---

## Security

### Reporting Security Issues

**⚠️ IMPORTANT** : **NE PAS** créer de GitHub issue publique pour les vulnérabilités de sécurité.

**Contact privé** :
- Email : security@gauzian.com
- GitHub Security Advisory : [Create a security advisory](https://github.com/yourusername/gauzian/security/advisories/new)

**Informations à inclure** :
- Description de la vulnérabilité
- Steps to reproduce
- Impact potentiel
- Suggestions de fix (optionnel)

**Réponse** : Nous répondons sous 48h et publions un patch sous 7 jours.

---

### Security Checklist (Pull Requests)

**Avant de créer une PR, vérifier** :

- [ ] Pas de secrets hardcodés (JWT_SECRET, API keys, passwords)
- [ ] Pas de `console.log` avec données sensibles (passwords, tokens, clés crypto)
- [ ] Input validation (email, UUIDs, file sizes, etc.)
- [ ] SQL injection prevention (utiliser `query!` avec paramètres bindés)
- [ ] XSS prevention (sanitize user input avant `v-html`)
- [ ] CSRF protection (vérifié par cookies SameSite=None + Secure)
- [ ] Authentication checks (tous les endpoints protégés utilisent `Claims`)
- [ ] Authorization checks (vérifier ownership avant delete/share)
- [ ] HTTPS enforced (cookies `Secure` flag en production)
- [ ] Rate limiting (si endpoints publics comme /login, /register)

---

### Crypto Security

**E2EE Best Practices** :

- [ ] **TOUJOURS** générer un IV unique par chiffrement
- [ ] **TOUJOURS** utiliser AES-256-GCM (pas CBC)
- [ ] **TOUJOURS** stocker les clés dans IndexedDB (non-extractable)
- [ ] **TOUJOURS** nettoyer IndexedDB au logout
- [ ] **JAMAIS** réutiliser le même IV
- [ ] **JAMAIS** stocker les clés en clair (localStorage, sessionStorage)
- [ ] **JAMAIS** logger les clés ou tokens
- [ ] PBKDF2 avec 310,000 iterations minimum (OWASP 2024)
- [ ] RSA-4096 minimum (pas 2048)

**Voir** : [`gauzian_front/docs/CRYPTO_ARCHITECTURE.md`](gauzian_front/docs/CRYPTO_ARCHITECTURE.md)

---

## Deployment

### Deployer sur VPS K8s (Production)

```bash
# 1. Build et push images Docker
./push_docker_hub.sh

# 2. Déployer sur VPS
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'

# 3. Vérifier le déploiement
ssh vps 'kubectl get pods -n gauzian-v2'
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=50'
```

**Voir** : [`DEPLOYMENT.md`](DEPLOYMENT.md) section "Déploiement 1 - VPS Kubernetes"

---

### Deployer sur Clever Cloud (Alternatif)

```bash
# 1. Build image backend (pre-build optimisé)
./update-backend-image.sh

# 2. Commit Dockerfile généré
git add Dockerfile.backend.prebuilt
git commit -m "chore: Update backend image"

# 3. Push vers Clever Cloud
git push clever main
```

**Voir** : [`DEPLOYMENT.md`](DEPLOYMENT.md) section "Déploiement 2 - Clever Cloud"

---

## Questions ?

**Documentation** :
- Root : [`CLAUDE.md`](CLAUDE.md)
- Backend : [`gauzian_back/CLAUDE.md`](gauzian_back/CLAUDE.md)
- Frontend : [`gauzian_front/CLAUDE.md`](gauzian_front/CLAUDE.md)
- API : [`gauzian_back/docs/API_DOCUMENTATION.md`](gauzian_back/docs/API_DOCUMENTATION.md)
- Database : [`gauzian_back/docs/DATABASE_SCHEMA.md`](gauzian_back/docs/DATABASE_SCHEMA.md)
- K8s : [`gauzian_back/k8s/README.md`](gauzian_back/k8s/README.md)

**Contact** :
- GitHub Issues : [Create an issue](https://github.com/yourusername/gauzian/issues/new)
- Email : support@gauzian.com

---

**Merci de contribuer à GAUZIAN ! 🚀**

**Dernière mise à jour** : 2026-02-11
