# Journal de Développement - GAUZIAN

## 2026-01-25

### [2026-01-25 15:30] - Corrections frontend + détection cycles

**Fichiers modifiés:**

1. **drive.rs**
   - Ajout détection de cycle dans `move_folder` avec CTE récursif
   - Empêche de déplacer un dossier dans un de ses descendants

2. **crypto.ts (frontend)**
   - PBKDF2 iterations: 100,000 → 310,000 (OWASP 2024)

3. **info.vue (frontend)**
   - Supprimé `console.log` des clés privées (lignes 196, 203, 204, 210)
   - Supprimé `console.log` des données chiffrées/déchiffrées

---

### [2026-01-25 15:00] - Migration SHA256 → Argon2

**Fichiers modifiés:**

1. **auth.rs**
   - Ajout import `argon2` avec `PasswordHash`, `PasswordHasher`, `PasswordVerifier`
   - Nouvelle fonction `hash_password()` utilisant Argon2id (format PHC)
   - Fonction legacy `hash_password_sha256_legacy()` conservée pour rétrocompatibilité
   - `verify_password()` supporte maintenant les deux formats (détection automatique via `$argon2`)
   - Supprimé le champ `password` de `NewUser` struct (ne stocke plus le mot de passe en clair)
   - `password_hash` est maintenant un `String` requis (plus `Option<String>`)

2. **handlers.rs**
   - `register_handler` utilise maintenant `auth::hash_password()` avec gestion d'erreur
   - `auth_salt` mis à `None` pour nouveaux utilisateurs (Argon2 inclut le salt dans le hash)

**Compatibilité:**
- Les utilisateurs existants (hash SHA256) peuvent toujours se connecter
- Les nouveaux utilisateurs utilisent Argon2id
- Migration transparente sans intervention utilisateur

---

### [2026-01-25 14:30] - Audit de sécurité et corrections critiques

**Fichiers modifiés:**

1. **auth.rs**
   - Supprimé le log des hash de mots de passe (ligne 201) - CRITIQUE
   - Implémenté fail-closed pour Redis (lignes 57-65) - CRITIQUE
   - Supprimé le log de l'email en clair (ligne 188) - ÉLEVÉE

2. **response.rs**
   - Cookie `secure` maintenant `true` par défaut (configurable via `COOKIE_SECURE=false` pour dev)

3. **handlers.rs**
   - Ajout vérification d'ownership sur `upload_chunk_handler` - CRITIQUE (IDOR fix)
   - Ajout vérification d'ownership sur `download_chunk_handler` - CRITIQUE (IDOR fix)
   - Supprimé `println!` au profit de tracing

4. **CLAUDE.md** (root, backend, frontend)
   - Créés/mis à jour pour documenter le projet

**Failles corrigées:**
- [CRITIQUE] Fuite de hash de mot de passe dans les logs
- [CRITIQUE] IDOR sur upload_chunk (accès fichier d'autrui)
- [CRITIQUE] IDOR sur download_chunk (téléchargement fichier d'autrui)
- [CRITIQUE] Redis fail-open → fail-closed
- [CRITIQUE] Cookie secure=false → secure=true par défaut
- [ÉLEVÉE] Email loggé en clair
- [MOYENNE] println! → tracing

**Failles restantes à corriger:**
- ~~SHA256 → Argon2 pour le hachage de mot de passe~~ ✅ FAIT
- ~~Supprimer champ `password` de `NewUser` struct~~ ✅ FAIT
- ~~Détection de cycles dans `move_folder`~~ ✅ FAIT
- ~~Console.log sensibles côté frontend~~ ✅ FAIT
- ~~PBKDF2 iterations 100k → 310k frontend~~ ✅ FAIT

**Toutes les failles critiques et élevées ont été corrigées.**
