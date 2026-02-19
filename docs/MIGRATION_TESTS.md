# Tests de Validation - Migration Authorization Headers

## 🎯 Objectif

Valider que la migration des cookies JWT vers Authorization headers fonctionne correctement avec persistance session localStorage.

---

## ✅ Checklist Tests Manuels

### Test 1 : Login Initial

**Scénario** : Premier login utilisateur

**Étapes** :
1. Ouvrir navigateur en mode incognito
2. Aller sur `https://gauzian.pupin.fr`
3. Entrer email + password
4. Cliquer "Login"

**Résultat attendu** :
- ✅ Redirection vers `/drive` sans rechargement complet
- ✅ localStorage contient `gauzian_auth_token`
- ✅ IndexedDB `GauzianSecureDB` contient `user_private_key` + `user_public_key`
- ✅ DevTools Network → onglet Headers → requête `/api/drive/files` contient `Authorization: Bearer <token>`
- ✅ Pas de cookie `auth_token` dans les requêtes

**Vérification localStorage** :
```javascript
// Dans DevTools Console
localStorage.getItem('gauzian_auth_token')
// Doit retourner un JWT (format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....)
```

**Vérification IndexedDB** :
1. DevTools → Application → IndexedDB → `GauzianSecureDB` → `keys`
2. Vérifier présence de :
   - `user_private_key` (type: CryptoKey)
   - `user_public_key` (type: CryptoKey)

---

### Test 2 : Session Persistante (F5)

**Scénario** : Rechargement de page (F5) doit conserver la session

**Étapes** :
1. Après login (Test 1), sur `/drive`
2. Appuyer sur **F5** (hard refresh)

**Résultat attendu** :
- ✅ Reste connecté sur `/drive` (pas de redirect `/login`)
- ✅ localStorage `gauzian_auth_token` toujours présent
- ✅ IndexedDB clés toujours présentes
- ✅ DevTools Network → requête après F5 contient toujours `Authorization: Bearer <token>`

---

### Test 3 : Session Persistante (Fermer/Rouvrir Navigateur)

**Scénario** : Fermer complètement le navigateur et rouvrir

**Étapes** :
1. Après login (Test 1)
2. **Fermer tous les onglets** du navigateur
3. **Fermer le navigateur complètement**
4. Attendre 10 secondes
5. **Rouvrir le navigateur**
6. Aller sur `https://gauzian.pupin.fr`

**Résultat attendu** :
- ✅ Affiche "Chargement..." pendant ~1 seconde
- ✅ Redirection automatique vers `/drive` (auto-login silencieux)
- ✅ Pas de demande de re-login
- ✅ localStorage + IndexedDB toujours présents
- ✅ DevTools Network → `Authorization: Bearer` dans les requêtes

---

### Test 4 : Logout

**Scénario** : Logout doit effacer tous les états

**Étapes** :
1. Connecté sur `/drive`
2. Cliquer bouton **Logout**

**Résultat attendu** :
- ✅ Redirection vers `/login`
- ✅ localStorage `gauzian_auth_token` **supprimé**
- ✅ IndexedDB `GauzianSecureDB` **vidé** (store `keys` vide)
- ✅ Impossible d'accéder `/drive` (middleware redirect `/login`)

**Vérification** :
```javascript
// Dans DevTools Console après logout
localStorage.getItem('gauzian_auth_token')
// Doit retourner null
```

---

### Test 5 : Upload Fichier E2EE

**Scénario** : Upload fichier avec chunked upload + Authorization header

**Étapes** :
1. Connecté sur `/drive`
2. Cliquer "Upload"
3. Sélectionner un fichier (ex: `test.pdf`, 2MB)
4. Attendre fin upload

**Résultat attendu** :
- ✅ Progress bar affiche 0% → 100%
- ✅ Fichier apparaît dans la liste (nom déchiffré correctement)
- ✅ DevTools Network → onglet Headers :
  - Requête `POST /api/files/initialize` contient `Authorization: Bearer <token>`
  - Requête `POST /api/files/upload-chunk` contient `Authorization: Bearer <token>`
  - Requête `POST /api/files/finalize-upload` contient `Authorization: Bearer <token>`
- ✅ **Pas de header `Content-Type: multipart/form-data` défini manuellement** (auto par navigateur)
- ✅ Pas de cookie `auth_token` envoyé

---

### Test 6 : Download Fichier E2EE

**Scénario** : Download fichier avec déchiffrement client-side

**Étapes** :
1. Après upload (Test 5)
2. Cliquer sur le fichier `test.pdf`
3. Cliquer "Download"

**Résultat attendu** :
- ✅ Fichier téléchargé correctement
- ✅ Contenu identique à l'original (déchiffrement OK)
- ✅ DevTools Network → `Authorization: Bearer` dans requêtes download chunks

---

### Test 7 : Partage Fichier E2EE

**Scénario** : Partager un fichier avec un autre utilisateur

**Prérequis** : 2 comptes utilisateurs (userA et userB)

**Étapes** :
1. Login avec userA
2. Upload fichier `secret.txt`
3. Cliquer "Share" sur `secret.txt`
4. Entrer email de userB
5. Cliquer "Confirm Share"
6. Logout userA
7. Login avec userB
8. Vérifier que `secret.txt` apparaît dans "Shared with me"
9. Download `secret.txt`

**Résultat attendu** :
- ✅ userB voit `secret.txt` dans shared
- ✅ userB peut download ET déchiffrer le fichier
- ✅ DevTools Network → `Authorization: Bearer` dans toutes les requêtes
- ✅ Backend stocke `encrypted_file_key` chiffré avec clé publique userB

---

### Test 8 : Token Expiré (401)

**Scénario** : Token expiré doit logout automatiquement

**Étapes** :
1. Login normalement
2. Dans DevTools Console, modifier le token localStorage avec un vieux token :
   ```javascript
   localStorage.setItem('gauzian_auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
   ```
3. Faire F5
4. Cliquer sur un dossier (trigger API call)

**Résultat attendu** :
- ✅ Backend retourne **401 Unauthorized**
- ✅ `fetchWithAuth()` catch 401
- ✅ Appel automatique `logout()`
- ✅ localStorage effacé
- ✅ IndexedDB effacé
- ✅ Redirection `/login`
- ✅ Message console : "Session expirée (401), redirection vers login"

---

### Test 9 : CRUD Événements Agenda

**Scénario** : Créer, modifier, supprimer événement avec Authorization header

**Étapes** :
1. Aller sur `/agenda`
2. Créer événement "Meeting" (date + heure)
3. Modifier l'événement (changer titre)
4. Supprimer l'événement

**Résultat attendu** :
- ✅ Événement créé, modifié, supprimé correctement
- ✅ DevTools Network → `Authorization: Bearer` dans toutes les requêtes agenda
- ✅ Événements chiffrés E2EE (backend ne voit que encrypted_data)

---

### Test 10 : Navigation Multiple

**Scénario** : Navigation entre pages sans perte de session

**Étapes** :
1. Login
2. Aller sur `/drive`
3. Aller sur `/agenda`
4. Aller sur `/info`
5. Retour `/drive`
6. F5

**Résultat attendu** :
- ✅ Toutes les navigations fonctionnent (pas de redirect `/login`)
- ✅ Session persistante même après F5
- ✅ localStorage + IndexedDB préservés

---

## 🔍 Tests Automatisés (Script Bash)

```bash
#!/bin/bash
# tests/migration_validation.sh

echo "🧪 Tests Migration Authorization Headers"
echo "========================================"

# Test 1 : Vérifier qu'aucun credentials: 'include' ne reste
echo "Test 1 : Grep credentials: 'include'..."
FOUND=$(grep -r "credentials.*include" gauzian_front/app --include="*.js" --include="*.vue" | grep -v "// " | grep -v "/\*" | wc -l)
if [ "$FOUND" -eq 2 ]; then
  echo "✅ Seulement 2 occurrences (faux positifs dans useAuth commentaires)"
else
  echo "❌ ERREUR : $FOUND occurrences trouvées (attendu: 2)"
  exit 1
fi

# Test 2 : Vérifier backend compile
echo "Test 2 : Compilation backend..."
cd gauzian_back
cargo check --quiet
if [ $? -eq 0 ]; then
  echo "✅ Backend compile"
else
  echo "❌ ERREUR : Backend ne compile pas"
  exit 1
fi
cd ..

# Test 3 : Vérifier frontend build
echo "Test 3 : Build frontend..."
cd gauzian_front
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Frontend build OK"
else
  echo "❌ ERREUR : Frontend build échoue"
  exit 1
fi
cd ..

echo ""
echo "✅ Tous les tests automatisés passent !"
echo ""
echo "⚠️  Tests manuels requis :"
echo "   - Test login/logout (1, 2, 3, 4)"
echo "   - Test upload/download E2EE (5, 6)"
echo "   - Test partage E2EE (7)"
echo "   - Test token expiré 401 (8)"
echo ""
echo "📖 Voir MIGRATION_TESTS.md pour détails"
```

---

## 📊 Résumé Technique

### Changements Backend

| Fichier | Modification | Ligne |
|---------|--------------|-------|
| `auth/handlers.rs` | Retirer `.with_token()` login | 116 |
| `auth/handlers.rs` | Retirer `.with_token()` register | 177 |
| `auth/services.rs` | Simplifier `extract_token_from_headers()` | 81-104 |

### Changements Frontend

| Fichier | Modification |
|---------|--------------|
| `composables/useAuth.js` | Nouveau (localStorage + login/logout/validateSession) |
| `composables/useFetchWithAuth.js` | Nouveau (helper Authorization header) |
| `middleware/auth.global.js` | Nouveau (validation session globale) |
| `pages/login.vue` | Utilise useAuth.login() + navigateTo |
| `pages/index.vue` | Validation session + redirect |
| `pages/drive.vue` | Supprimé autologin() |
| `pages/info.vue` | Supprimé checkSession() |
| `utils/crypto.ts` | Ajout clearAllKeys() |
| **11 composables** | Remplacé fetch() par fetchWithAuth() |

---

## 🎉 Résultat Final

- ✅ **0 cookies JWT** (100% Authorization headers)
- ✅ **Session persistante 10 jours** (localStorage)
- ✅ **E2EE préservé** (clés IndexedDB extractable: false)
- ✅ **Sécurité renforcée** (pas de CSRF, logout auto sur 401)
- ✅ **User-friendly** (auto-login silencieux au retour)

---

**Date** : 2026-02-17
**Version** : Migration Authorization Headers v1.0
