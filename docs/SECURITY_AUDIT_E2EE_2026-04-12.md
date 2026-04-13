# Audit de Sécurité E2EE — Gauzian

**Date** : 2026-04-12  
**Scope** : Implémentation E2EE complète (crypto.ts, drive handlers, schéma DB, partage)  
**Auditeur** : Claude Code (analyse statique)

---

## Résumé Exécutif

| Sévérité | Nombre |
|---|---|
| 🔴 CRITIQUE | 2 |
| 🟠 HIGH | 4 |
| 🟡 MEDIUM | 4 |
| 🔵 LOW | 2 |
| ✅ Positifs | 10+ |

L'architecture E2EE de Gauzian est **fondamentalement correcte** : bons algorithmes, bonne séparation des responsabilités, zero-knowledge respecté. Les vulnérabilités identifiées sont des détails d'implémentation, pas des failles architecturales.

---

## Primitives Cryptographiques

| Primitif | Configuration | Conformité |
|---|---|---|
| RSA-OAEP | 4096 bits, SHA-256, e=65537 | ✅ NIST SP800-131Ar2 |
| AES-GCM | 256 bits, IV 12 bytes aléatoire | ✅ NIST SP800-38D |
| PBKDF2 | SHA-256, 310 000 itérations, sel 16 bytes | ✅ OWASP 2024 |
| GCM auth tag | 128 bits (défaut Web Crypto API) | ✅ |
| RNG | `window.crypto.getRandomValues` | ✅ CSPRNG |

Aucun algorithme faible (pas de CBC, ECB, SHA-1 pour OAEP, MD5).

---

## Schéma DB — Migrations versionnées ✅

Les colonnes `access_level`, `is_deleted`, `is_accepted` qui n'apparaissent pas dans la migration initiale sont bien ajoutées par des migrations ultérieures correctement versionnées :

| Migration | Ajout |
|---|---|
| `20260109111113_add_access_level.sql` | `access_level TEXT DEFAULT 'read'` sur file_access / folder_access |
| `20260116151108_is_delet_and_is_fully_upload.sql` | `is_deleted`, `is_fully_uploaded` |
| `20260219120000_add_is_accepted.sql` | `is_accepted`, `is_root_anchor` |

L'owner est inséré explicitement avec `access_level = 'owner'` et `is_accepted = TRUE` — le default `'read'` / `FALSE` ne s'applique qu'aux partages en attente d'acceptation. Correct.

---

## Vulnérabilités

---

### 🔴 V1 — `clearAllKeys` : logout silencieusement raté

**Fichier** : `gauzianFront/app/utils/crypto.ts:547`

```typescript
req.onblocked = () => resolve(); // ← résout sans avoir effacé
```

`indexedDB.deleteDatabase` est **bloqué** si un autre onglet a la DB ouverte. La fonction retourne `Promise.resolved` sans avoir supprimé les clés. Au logout, les clés privées restent en IndexedDB.

**Impact** : Accès aux clés après logout via un autre onglet resté ouvert ou via XSS persistant.

**Correction** : Appeler `store.clear()` via une transaction avant `deleteDatabase`. Ne pas dépendre du succès de `deleteDatabase` pour la sécurité.

---

### 🔴 V2 — Race condition dans le partage batch

**Fichier** : `gauzianMain/docs/SHARING_E2EE_SOLUTION.md`, `gauzianFront/app/composables/drive/useAutoShare.js`

Le flow de partage est :
1. Fetch récursif de la hiérarchie (N+1 requêtes)
2. Déchiffrement de toutes les clés localement
3. Rechiffrement pour le destinataire
4. Envoi du batch au backend

**Problème** : Un fichier uploadé dans le dossier **entre les étapes 1 et 4** n'est pas inclus dans le batch. Le destinataire a la clé du dossier parent mais pas celle du fichier → données inaccessibles silencieusement.

**Correction** : Le backend devrait retourner la liste des items effectivement couverts par le batch et détecter les orphelins via une transaction `SERIALIZABLE` ou un verrou de dossier pendant le partage.

---

### 🟠 V3 — Propagation silencieusement partielle

**Fichier** : `gauzianFront/app/composables/drive/useAutoShare.js:59`

```javascript
} catch (error) {
  console.error(`Failed to encrypt key for user ${user.username}:`, error)
  // ← continue vers le prochain utilisateur
}
```

Si le chiffrement RSA échoue pour un co-propriétaire (clé publique corrompue, timeout), le fichier est uploadé **sans entrée `file_access` pour cet utilisateur**. La fonction retourne `{ success: true }` si au moins un utilisateur a réussi.

**Correction** : Exposer `{ success: bool, failedUsers: string[] }`. Afficher une alerte UX si `failedUsers.length > 0`.

---

### 🟠 V4 — Confiance aveugle dans la clé publique du destinataire (TOFU)

**Flux** : `GET /contacts/get_public_key/{user_id}` → rechiffrement côté client

Le frontend récupère la clé publique du destinataire depuis le serveur. Si le backend est compromis, il peut substituer n'importe quelle clé — le client n'a aucun moyen de vérifier l'authenticité.

**Impact** : L'opérateur du serveur peut potentiellement déchiffrer tout fichier partagé en substituant sa propre clé publique lors d'un partage.

**Mitigation actuelle** : TOFU implicite (acceptable en phase MVP).  
**Correction long terme** : Afficher le fingerprint SHA-256 de la clé avant confirmation du partage. Permettre vérification hors-bande.

---

### 🟠 V5 — Deux APIs AES-GCM incompatibles coexistent

**Fichier** : `gauzianFront/app/utils/crypto.ts`

```typescript
// Format 1 : IV EMBARQUÉ dans le résultat
encryptSimpleDataWithDataKey(data, key) → base64("IV||ciphertext")
decryptSimpleDataWithDataKey(combined_b64, key)

// Format 2 : IV SÉPARÉ
encryptDataWithDataKey(data, key) → { cipherText: string, iv: string }
decryptDataWithDataKey(cipherText_b64, iv_b64, key)
```

Mixer les deux (`decryptSimpleDataWithDataKey` sur un output de `encryptDataWithDataKey`) produit une erreur cryptographique indistinguable d'une mauvaise clé. Aucun marqueur dans le ciphertext ne distingue les deux formats.

**Risque** : une future intégration qui se trompe de fonction passe en tests (pas d'erreur syntaxique) mais corrompt silencieusement les données.

**Correction** : Documenter explicitement quel format est utilisé pour quel type de donnée (métadonnées vs chunks). Ou unifier en un seul format avec un magic byte de version.

---

### 🟠 V6 — Absence de forward secrecy

Si la clé privée RSA d'un utilisateur est compromise (password bruteforcé, fuite device), **tous les fichiers passés et futurs** chiffrés pour cet utilisateur sont déchiffrables. Il n'existe pas de mécanisme de rotation de clés de données ni de re-chiffrement périodique.

**Note** : C'est une limitation architecturale classique des systèmes E2EE sans session keys. À documenter dans les limitations connues.

---

### 🟡 V7 — Expiry IndexedDB : clé publique sans expiration

**Fichier** : `gauzianFront/app/utils/crypto.ts:287-299`

```typescript
// Clé privée : expire après 90 jours ✅
idbPut({ id: "user_private_key", key, expires: Date.now() + 90j })

// Clé publique : jamais d'expiry ❌
idbPut({ id: "user_public_key", key })
```

`getKeyStatus()` ne vérifie que `user_private_key`. Quand la clé privée expire, la clé publique orpheline reste indéfiniment. État incohérent possible.

---

### 🟡 V8 — Upload dans un dossier partagé non encore accepté

**Fichier** : `gauzianBack/src/drive/repo.rs:305-316`

`initialize_file_in_db` vérifie l'accès au dossier parent avec `is_deleted = FALSE` uniquement — pas `is_accepted = TRUE`. Cela permet d'uploader un fichier dans un dossier partagé dont l'invitation n'a pas encore été acceptée.

**Impact** : Mineur. Le fichier créé a bien `is_accepted = TRUE` pour l'uploader. Mais le fichier apparaîtra dans le dossier d'un share pending, ce qui peut être confus.

---

### 🟡 V9 — `chunk_index` sans validation de plage

**Fichier** : `gauzianBack/src/drive/handlers.rs:269-276`

L'index de chunk est parsé comme `i32` mais sa valeur n'est pas bornée (négatif, `i32::MAX` acceptés). Un utilisateur authentifié pourrait uploader des chunks avec des indices arbitraires et perturber la reconstruction du fichier au téléchargement.

---

### 🟡 V10 — `bytes_to_text_or_b64` : comportement dual non déterministe

**Fichier** : `gauzianBack/src/drive/repo.rs:11-15`

```rust
fn bytes_to_text_or_b64(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) if !s.trim().is_empty() => s.to_string(), // si UTF-8 valide → as-is
        _ => base64::engine::general_purpose::STANDARD.encode(bytes), // sinon → base64
    }
}
```

Les `encrypted_metadata` et `encrypted_file_key` stockés en `BYTEA` peuvent être retournés soit tels quels (si le frontend les a envoyés déjà en base64 = UTF-8 valide), soit re-encodés en base64 (si envoyés en binaire). Format de retour non-déterministe selon la méthode d'insertion.

---

### 🔵 V11 — `s3_id` exposé dans la réponse upload chunk

**Fichier** : `gauzianBack/src/drive/handlers.rs:340-347`

Le chemin S3 interne (`s3_id`) est retourné dans la réponse de chaque upload de chunk. Révèle la structure de stockage MinIO à tout utilisateur authentifié. Mineur si MinIO n'est pas accessible publiquement.

---

### 🔵 V12 — Recovery key non révocable sans regénérer le keypair

**Fichier** : `gauzianFront/app/utils/crypto.ts:136-178`

La recovery key est une clé AES-256 brute en base64 (256 bits d'entropie, résistante au bruteforce). Cependant, il n'existe pas de mécanisme pour révoquer/changer la recovery key sans regénérer l'intégralité du keypair RSA et rechiffrer toutes les clés de données. Si la recovery key est compromise (screenshot, clipboard), l'utilisateur ne peut pas la changer facilement.

---

## Points Positifs

✅ **Web Crypto API native** — aucune dépendance crypto externe (surface supply-chain nulle)  
✅ **`extractable: false` sur la clé privée** — `exportKey()` bloqué par le navigateur même en cas de XSS  
✅ **IV aléatoire par opération** — `window.crypto.getRandomValues` à chaque chiffrement  
✅ **`assertClient()`** — protège contre exécution accidentelle côté SSR Nuxt  
✅ **`toArrayBuffer()` copie profonde** — évite les bugs de vues partielles (offset != 0)  
✅ **Contrôle d'accès via `file_access`/`folder_access`** — IDOR protégé côté backend  
✅ **Owner inséré explicitement** avec `access_level = 'owner'`, `is_accepted = TRUE`  
✅ **Rate limiting sur l'auth** (Redis, par email)  
✅ **SameSite=Strict sur les cookies JWT**  
✅ **Clé privée jamais transmise au serveur** — seulement `encrypted_private_key` + sel + IV  
✅ **Semaphore sur les uploads** — protection contre flood de chunks concurrents  
✅ **Sanitization `Content-Disposition`** — protection header injection au download  

---

## Tableau de Priorité

| ID | Sévérité | Effort | Fichier |
|---|---|---|---|
| V1 | 🔴 CRITIQUE | Faible | `crypto.ts:547` |
| V2 | 🔴 CRITIQUE | Élevé | `useAutoShare.js` + backend |
| V3 | 🟠 HIGH | Faible | `useAutoShare.js:59` |
| V4 | 🟠 HIGH | Moyen | Architecture partage |
| V5 | 🟠 HIGH | Moyen | `crypto.ts` |
| V6 | 🟠 HIGH | Très élevé | Architecture globale |
| V7 | 🟡 MEDIUM | Faible | `crypto.ts:294` |
| V8 | 🟡 MEDIUM | Faible | `repo.rs:306` |
| V9 | 🟡 MEDIUM | Faible | `handlers.rs:269` |
| V10 | 🟡 MEDIUM | Moyen | `repo.rs:11` |
| V11 | 🔵 LOW | Faible | `handlers.rs:340` |
| V12 | 🔵 LOW | Élevé | Architecture recovery |

---

**Généré par** : Claude Code — analyse statique  
**Périmètre** : gauzianFront/app/utils/crypto.ts · gauzianBack/src/drive/ · gauzianBack/migrations/ · gauzianMain/docs/SHARING_E2EE_SOLUTION.md
