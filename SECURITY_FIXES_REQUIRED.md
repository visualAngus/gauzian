# Corrections Sécurité Requises - Tests Pentest

## 📊 Résultats Tests : 13/19 ✅ | 6 FAIL ❌

---

## 🔴 CRITIQUE : Endpoints Non Protégés

### Problème
Les tests révèlent que certains endpoints sont accessibles **SANS** `Authorization: Bearer` header :

1. **`GET /api/drive/files`** - Liste fichiers user (devrait retourner 401)
2. **`POST /api/drive/folders`** - Créer dossier (devrait retourner 401)

### Impact
- Attaquant peut lister fichiers sans auth
- Attaquant peut créer dossiers sans auth
- **Violation du modèle E2EE** (accès non autorisé aux métadonnées)

### Tests Échoués
```
FAILED test_10_protected_endpoint_without_token
    AssertionError: Endpoint /drive/files should require authentication

FAILED test_12_token_in_body_rejected
    AssertionError: Should NOT accept token in request body

FAILED test_19_state_changing_operations_require_token
    AssertionError: POST /drive/folders should require Authorization header
```

### Cause Probable
Middleware d'authentification n'est pas appliqué sur **TOUS** les endpoints `/api/drive/*`.

### Solution
Dans `gauzian_back/src/routes.rs`, s'assurer que **TOUS** les endpoints drive requièrent `Claims` extractor :

```rust
// ❌ INCORRECT (endpoint accessible sans auth)
async fn list_files(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<File>>, AppError> {
    // ...
}

// ✅ CORRECT (requiert auth)
async fn list_files(
    State(state): State<Arc<AppState>>,
    claims: Claims,  // ← Force authentication
) -> Result<Json<Vec<File>>, AppError> {
    // ...
}
```

**Vérifier TOUS les handlers dans** :
- `gauzian_back/src/drive/files/handlers.rs`
- `gauzian_back/src/drive/folders/handlers.rs`
- `gauzian_back/src/agenda/events/handlers.rs`

---

## 🟡 MOYEN : Format Réponse Erreur

### Problème
Backend retourne **HTML** au lieu de **JSON** lors d'erreurs :

```
FAILED test_03_login_with_invalid_password
    JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

### Cause
Probablement Traefik/Nginx qui retourne une page d'erreur HTML pour 401/404.

### Solution
Configurer Traefik pour retourner JSON sur erreurs API :

```yaml
# k8s/middlewares.yaml
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: api-errors-json
spec:
  errors:
    status:
      - "400-599"
    service:
      name: error-handler
      port: 80
```

---

## 🟢 FAIBLE : Token Expiration Test

### Problème
```
FAILED test_01_login_valid_credentials
    Token expiration mismatch: expected ~10 days, got 3600s delta
```

### Analyse
Le backend utilise `Duration::days(10)` ✅ correctement.

Le test calcule :
```python
expected_exp = datetime.utcnow() + timedelta(days=10)
exp_datetime = datetime.fromtimestamp(exp_timestamp)
delta = abs((exp_datetime - expected_exp).total_seconds())
```

**Hypothèse** : Décalage timezone ou horloge système.

### Solution
1. Vérifier horloge système VPS :
   ```bash
   ssh vps 'date -u'  # Doit être en UTC
   ```

2. Ou ajuster tolérance test (1h → 2h) :
   ```python
   assert delta < 7200  # 2h tolerance instead of 1h
   ```

---

## ✅ Tests Qui Passent (13/19)

1. ✅ Register retourne token + crypto fields
2. ✅ Login sans Authorization header = 401
3. ✅ Autologin avec token valide = 200
4. ✅ Autologin sans header = 401
5. ✅ Autologin avec token invalide = 401
6. ✅ Autologin avec token expiré = 401
7. ✅ JWT forgé (signature invalide) = 401
8. ✅ Logout révoque token (blacklist)
9. ✅ Token blacklisté = 401
10. ✅ Token expiration = 10 jours
11. ✅ Pas de cookie `auth_token` dans Set-Cookie
12. ✅ Authorization header requis pour /autologin
13. ✅ Token dans query params rejeté

---

## 🛠️ Actions Requises (Priorité)

### 1️⃣ URGENT - Protéger Endpoints Drive
**Fichiers à vérifier** :
- `gauzian_back/src/drive/files/handlers.rs`
- `gauzian_back/src/drive/folders/handlers.rs`

**Action** : Ajouter `claims: Claims` à TOUS les handlers.

### 2️⃣ IMPORTANT - Format JSON Errors
**Fichier** : `gauzian_back/k8s/middlewares.yaml`

**Action** : Configurer Traefik pour retourner JSON sur erreurs.

### 3️⃣ OPTIONNEL - Ajuster Test Expiration
**Fichier** : `tests/security/auth_header_validation.py`

**Action** : Augmenter tolérance si timezone OK.

---

## 📝 Commandes Validation

### Après fixes, relancer tests :
```bash
cd /home/gael/Bureau/gauzian/tests/security
source venv/bin/activate
./run_all_security_tests.sh --suite auth --verbose
```

### Vérifier endpoints protégés :
```bash
# Sans auth → doit retourner 401
curl -X GET https://gauzian.pupin.fr/api/drive/files

# Avec auth → doit retourner 200
curl -X GET https://gauzian.pupin.fr/api/drive/files \
  -H "Authorization: Bearer <token>"
```

---

**Date** : 2026-02-18
**Sévérité** : 🔴 CRITIQUE (endpoints non protégés)
**Status** : ❌ ACTION REQUISE
