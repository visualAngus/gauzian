# Tests E2E API — GAUZIAN

Tests de sécurité et fonctionnels de l'API, exécutés via [Hurl](https://hurl.dev/).Tests intégrés dans la CI GitHub Actions, avec des comptes de test dédiés.

---

## Structure

```
tests/
├── run_tests.sh              # Runner local (coloré, gestion rate limit)
├── setup_test_accounts.sh    # Création one-shot des comptes CI (déjà exécuté)
└── api/
    ├── 00_health.hurl        # Health check
    ├── auth/
    │   ├── 01_register.hurl  # Tests register (référence, exclu du CI)
    │   ├── 02_login.hurl     # Login valide/invalide, champs manquants
    │   ├── 03_token_security.hurl  # JWT tampering, token expiré, token vide
    │   └── 04_logout.hurl    # Logout, réutilisation token révoqué
    └── drive/
        ├── 01_folder_crud.hurl     # CRUD dossiers
        ├── 02_file_crud.hurl       # Upload/download fichiers (E2EE simulé)
        ├── 03_idor_security.hurl   # IDOR : accès ressources d'un autre user
        ├── 04_sharing_security.hurl # Partage, privilege escalation
        └── 05_trash.hurl           # Corbeille, restauration, suppression définitive
```

---

## Lancer les tests localement

### Prérequis

```bash
# Installer Hurl 4.3.0
curl -LO https://github.com/Orange-OpenSource/hurl/releases/download/4.3.0/hurl_4.3.0_amd64.deb
sudo dpkg -i hurl_4.3.0_amd64.deb
```

### Commande

```bash
API_URL=https://gauzian.pupin.fr/api \
TEST_USER_EMAIL_A=ci-a@gauzian.app \
TEST_USER_EMAIL_B=ci-b@gauzian.app \
TEST_USER_PASSWORD=<mot_de_passe> \
TEST_USERNAME_A=ci-a \
TEST_USERNAME_B=ci-b \
bash tests/run_tests.sh
```

> Le mot de passe est dans le secret GitHub `TEST_USER_PASSWORD`.

---

## Comptes de test (prod)

| Compte | Email | Username |
|--------|-------|----------|
| User A | `ci-a@gauzian.app` | `ci-a` |
| User B | `ci-b@gauzian.app` | `ci-b` |

Les comptes sont créés via `tests/setup_test_accounts.sh`. Si supprimés de la DB, relancer :

```bash
API_URL=https://gauzian.pupin.fr/api \
bash tests/setup_test_accounts.sh \
  --email-a ci-a@gauzian.app \
  --email-b ci-b@gauzian.app \
  --username-a ci-a \
  --username-b ci-b \
  --password <nouveau_mot_de_passe>

# Puis mettre à jour le secret GitHub
gh secret set TEST_USER_PASSWORD --body "<nouveau_mot_de_passe>"
```

---

## Rate Limiting

Le runner détecte automatiquement le **HTTP 429** avant chaque test.  
Si le rate limit est actif (fenêtre de **15 min par email**), les tests sont marqués `⚠ SKIPPED` avec un message explicite — pas d'erreur en cascade.

**Pour débloquer immédiatement :**

```bash
ssh vps 'kubectl exec -n gauzian-v2 deploy/redis -- redis-cli DEL login_attempts:ci-a@gauzian.app login_attempts:ci-b@gauzian.app'
```

> ⚠️ Le fichier `02_login.hurl` contient des tests de brute force (tentatives échouées intentionnelles) qui déclenchent le rate limit pour les tests suivants. Si tu enchaînes plusieurs runs, attends 15 min ou vide Redis entre les runs.

---

## CI/CD (GitHub Actions)

Le job `api-security-tests` est intégré dans `.github/workflows/build-and-push.yml`.  
Il se déclenche **après le déploiement** sur la branche `back`.

**Secrets GitHub requis :**

| Secret | Valeur |
|--------|--------|
| `API_URL` | `https://gauzian.pupin.fr/api` |
| `TEST_USER_EMAIL_A` | `ci-a@gauzian.app` |
| `TEST_USER_EMAIL_B` | `ci-b@gauzian.app` |
| `TEST_USER_PASSWORD` | *(confidentiel)* |
| `TEST_USERNAME_A` | `ci-a` |
| `TEST_USERNAME_B` | `ci-b` |

---

## Structure des réponses API

> ⚠️ Point critique : **`/login` n'est PAS wrappé** dans `{"ok": true, "data": {...}}`.

| Endpoint | Structure réponse |
|----------|-------------------|
| `POST /login` | `{"token": "...", "user_id": "...", ...}` (racine) |
| `GET /autologin` | String `"Authenticated as user ..."` |
| Tous les autres | `{"ok": true, "data": {...}}` ou `{"ok": false, "error": "..."}` |

**Codes HTTP notables :**

| Situation | Code |
|-----------|------|
| Champ manquant (Axum validation) | `422` |
| Mauvais mot de passe | `401` |
| Rate limit dépassé | `429` |
| `create_folder` succès | `200` (pas 201) |
| Ressource non trouvée | `404` |
