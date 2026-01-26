# Guide de Test - Partage de Fichiers et Dossiers

## 🚀 Démarrage Rapide

### 1. Build et Déploiement

```bash
# Backend (depuis gauzian_back/)
cargo build --release

# Frontend (depuis gauzian_front/)
npm install
npm run build

# Docker (depuis gauzian_back/)
./push_docker_hub.sh

# Déploiement K8s sur VPS
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'
```

### 2. Vérification des Services

```bash
# Vérifier les pods
ssh vps 'kubectl get pods -n gauzian'

# Vérifier les logs backend
ssh vps 'kubectl logs -n gauzian -l app=backend --tail=50'

# Vérifier les logs frontend
ssh vps 'kubectl logs -n gauzian -l app=frontend --tail=50'
```

## 🧪 Tests Manuels

### Scénario 1 : Partage d'un Dossier Simple

**Prérequis** : 2 comptes utilisateurs (Alice et Bob)

1. **Alice** : Se connecter et créer un dossier "Photos"
2. **Alice** : Ajouter un fichier dans "Photos"
3. **Alice** : Clic droit sur "Photos" → "Partager"
4. **Alice** : Entrer l'email de Bob → Sélectionner niveau "editor" → Partager
5. **Bob** : Se connecter et vérifier que "Photos" apparaît
6. **Bob** : Ouvrir "Photos" et vérifier que le fichier est visible
7. **Bob** : Télécharger le fichier et vérifier qu'il se déchiffre correctement

**Résultat attendu** : ✅ Bob peut voir et télécharger le dossier et son contenu

### Scénario 2 : Partage avec Propagation Récursive

**Prérequis** : 2 comptes utilisateurs (Alice et Bob)

1. **Alice** : Créer hiérarchie :
   ```
   Photos/
   ├── Vacances/
   │   └── plage.jpg
   └── Famille/
       └── noel.jpg
   ```
2. **Alice** : Partager "Photos" avec Bob (niveau "viewer")
3. **Bob** : Se connecter
4. **Bob** : Vérifier que "Photos" est visible
5. **Bob** : Ouvrir "Photos" → Vérifier "Vacances" et "Famille" visibles
6. **Bob** : Ouvrir "Vacances" → Vérifier "plage.jpg" visible
7. **Bob** : Télécharger "plage.jpg" → Vérifier déchiffrement correct
8. **Bob** : Ouvrir "Famille" → Télécharger "noel.jpg" → Vérifier déchiffrement

**Résultat attendu** : ✅ Tous les sous-dossiers et fichiers sont accessibles

### Scénario 3 : Partage de Fichier Individuel

**Prérequis** : 2 comptes utilisateurs (Alice et Bob)

1. **Alice** : Uploader "document.pdf" à la racine
2. **Alice** : Clic droit sur "document.pdf" → "Partager"
3. **Alice** : Entrer email de Bob → "viewer" → Partager
4. **Bob** : Se connecter
5. **Bob** : Vérifier que "document.pdf" apparaît dans la liste
6. **Bob** : Télécharger "document.pdf" → Vérifier déchiffrement

**Résultat attendu** : ✅ Bob peut voir et télécharger le fichier

### Scénario 4 : Partage Multiple Contacts

**Prérequis** : 3 comptes (Alice, Bob, Charlie)

1. **Alice** : Créer dossier "Projet"
2. **Alice** : Clic droit → "Partager"
3. **Alice** : Ajouter bob@example.com → Ajouter charlie@example.com
4. **Alice** : Niveau "editor" → Partager
5. **Bob** : Vérifier accès à "Projet"
6. **Charlie** : Vérifier accès à "Projet"

**Résultat attendu** : ✅ Bob et Charlie ont accès

### Scénario 5 : Validation des Erreurs

#### Test 5.1 : Email Invalide
1. Ouvrir modal de partage
2. Entrer "invalid.email" → Vérifier couleur rouge
3. Appuyer Enter → Vérifier alerte "email invalide"

**Résultat attendu** : ✅ Email rejeté

#### Test 5.2 : Doublon Contact
1. Ouvrir modal de partage
2. Ajouter "bob@example.com"
3. Essayer d'ajouter "bob@example.com" à nouveau
4. Vérifier alerte "contact déjà dans la liste"

**Résultat attendu** : ✅ Doublon rejeté

#### Test 5.3 : Partage avec Soi-même
1. **Alice** : Partager dossier avec alice@example.com (son propre email)
2. Vérifier erreur backend "Cannot share with yourself"

**Résultat attendu** : ✅ Auto-partage bloqué

#### Test 5.4 : Contact Inexistant
1. **Alice** : Partager avec "nonexistent@example.com"
2. Vérifier erreur "User not found"

**Résultat attendu** : ✅ Contact inexistant détecté

#### Test 5.5 : Partage Sans Ownership
1. **Bob** : Recevoir accès "viewer" à dossier d'Alice
2. **Bob** : Essayer de partager ce dossier avec Charlie
3. Vérifier erreur "Folder or contact not found"

**Résultat attendu** : ✅ Non-owner ne peut pas partager

## 🔍 Tests Backend (cURL)

### Get Public Key

```bash
# Doit nécessiter authentification
curl -X GET https://gauzian.pupin.fr/api/contacts/get_public_key/bob@example.com \
  -H "Authorization: Bearer <token>" \
  -v

# Sans auth → 401 Unauthorized
curl -X GET https://gauzian.pupin.fr/api/contacts/get_public_key/bob@example.com -v
```

### Share Folder

```bash
curl -X POST https://gauzian.pupin.fr/api/drive/share_folder \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "folder_id": "uuid-here",
    "contact_id": "bob-uuid",
    "encrypted_item_key": "base64-encrypted-key",
    "access_level": "editor"
  }'
```

### Share File

```bash
curl -X POST https://gauzian.pupin.fr/api/drive/share_file \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "uuid-here",
    "contact_id": "bob-uuid",
    "encrypted_item_key": "base64-encrypted-key",
    "access_level": "viewer"
  }'
```

## 📊 Tests SQL (Vérification DB)

### Vérifier Propagation Dossiers

```sql
-- Après partage de "Photos" (uuid1) avec Bob (uuid2)
SELECT
    f.id as folder_id,
    f.encrypted_metadata,
    fa.user_id,
    fa.access_level
FROM folders f
JOIN folder_access fa ON fa.folder_id = f.id
WHERE fa.user_id = 'uuid2'  -- Bob
ORDER BY f.created_at;

-- Doit afficher :
-- - Photos (partagé)
-- - Vacances (propagé)
-- - Famille (propagé)
```

### Vérifier Propagation Fichiers

```sql
-- Vérifier que les fichiers dans le dossier partagé sont accessibles
SELECT
    f.id as file_id,
    f.encrypted_metadata,
    fa.user_id,
    fa.access_level,
    fa.folder_id
FROM files f
JOIN file_access fa ON fa.file_id = f.id
WHERE fa.user_id = 'uuid2'  -- Bob
ORDER BY f.created_at;

-- Doit afficher tous les fichiers dans Photos/* et sous-dossiers
```

## 🐛 Debugging

### Logs Backend

```bash
# Erreurs de partage
ssh vps 'kubectl logs -n gauzian -l app=backend | grep "Failed to share"'

# Vérification validations
ssh vps 'kubectl logs -n gauzian -l app=backend | grep "Invalid access level"'
ssh vps 'kubectl logs -n gauzian -l app=backend | grep "Cannot share"'
```

### Logs Frontend (Browser Console)

```javascript
// Vérifier appels API
// Network tab → Filter "share"

// Console → Vérifier erreurs
// Devrait afficher :
// - "Successfully shared folder with X contact(s)"
// OU
// - "Error sharing item: ..."
```

### Erreurs Communes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `User not found` | Email n'existe pas en base | Vérifier email correct |
| `Cannot share with yourself` | contact_id == user_id | Utiliser email différent |
| `Invalid access level` | Niveau != owner/editor/viewer | Utiliser enum valide |
| `Folder or contact not found` | Pas ownership OU folder inexistant | Vérifier permissions |
| `encryptWithPublicKey is not defined` | Import manquant | Vérifier crypto.ts importé |
| `Item not found in local list` | `liste_decrypted_items` vide | Recharger page |

## ✅ Checklist Validation

- [ ] Backend compile sans erreur (`cargo build --release`)
- [ ] Frontend compile sans erreur (`npm run build`)
- [ ] Tests unitaires backend passent (`cargo test`)
- [ ] Pods K8s démarrent correctement
- [ ] Partage dossier simple fonctionne
- [ ] Propagation sous-dossiers fonctionne
- [ ] Propagation fichiers fonctionne
- [ ] Partage fichier individuel fonctionne
- [ ] Partage multi-contacts fonctionne
- [ ] Email invalide rejeté
- [ ] Doublon contact rejeté
- [ ] Auto-partage bloqué
- [ ] Contact inexistant détecté
- [ ] Non-owner ne peut pas partager
- [ ] Clés déchiffrées correctement par destinataire

## 📝 Notes

- Les clés privées ne doivent **jamais** apparaître dans les logs
- Toutes les requêtes de partage nécessitent authentification JWT
- Le rechiffrement se fait côté client (E2EE préservé)
- La propagation est automatique et immédiate (1 transaction SQL)
- Les erreurs sont loggées backend avec `tracing::error!`

---

**Dernière mise à jour** : 2026-01-25
