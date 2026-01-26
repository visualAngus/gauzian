# Implémentation du Partage de Fichiers et Dossiers

## 📋 Résumé

Cette mise à jour implémente un système complet de partage de fichiers et dossiers avec chiffrement de bout en bout (E2EE), validations de sécurité, et propagation automatique des permissions.

## ✅ Fonctionnalités Implémentées

### Backend (Rust)

#### 1. **Partage de Dossiers** (`drive.rs:share_folder_with_contact`)
- ✅ Validation stricte du niveau d'accès (`owner`, `editor`, `viewer`)
- ✅ Vérification de l'existence du contact
- ✅ Interdiction de se partager avec soi-même
- ✅ Vérification des permissions du propriétaire
- ✅ **Propagation récursive** : tous les sous-dossiers héritent automatiquement des permissions
- ✅ **Partage automatique des fichiers** : tous les fichiers du dossier et sous-dossiers sont partagés
- ✅ Gestion des doublons avec `ON CONFLICT`
- ✅ Support du soft-delete (`is_deleted = FALSE`)

#### 2. **Partage de Fichiers** (`drive.rs:share_file_with_contact`)
- ✅ Validation stricte du niveau d'accès
- ✅ Vérification de l'existence du contact
- ✅ Interdiction de se partager avec soi-même
- ✅ Vérification des permissions du propriétaire
- ✅ Récupération automatique du `folder_id`
- ✅ Gestion des doublons

#### 3. **Handlers HTTP** (`handlers.rs`)
- ✅ `share_folder_handler` : endpoint pour partager un dossier
- ✅ `share_file_handler` : endpoint pour partager un fichier
- ✅ Gestion des erreurs avec types appropriés (404, 400, 500)
- ✅ Logging des erreurs

#### 4. **Routes** (`routes.rs`)
- ✅ `POST /drive/share_folder` : partage de dossier
- ✅ `POST /drive/share_file` : partage de fichier
- ✅ `GET /contacts/get_public_key/:email` : récupération de clé publique (maintenant avec authentification)

### Frontend (Vue.js / Nuxt)

#### 1. **Composant de Partage** (`ShareItem.vue`)
- ✅ Validation d'email RFC 5322 compliant
- ✅ Prévention des doublons de contacts
- ✅ Vérification minimum d'un contact avant partage
- ✅ Sélection du niveau d'accès (lecture, écriture, admin)
- ✅ Interface utilisateur moderne avec chips pour les contacts
- ✅ Feedback visuel (validation email en temps réel)

#### 2. **Logique de Partage** (`useFileActions.js:shareItemServer`)
- ✅ Récupération sécurisée des métadonnées de l'item
- ✅ Déchiffrement de la clé de l'item avec la clé privée de l'utilisateur
- ✅ Récupération des clés publiques des contacts via API
- ✅ Rechiffrement de la clé pour chaque contact avec sa clé publique
- ✅ Envoi parallèle des requêtes de partage (Promise.all)
- ✅ Gestion granulaire des erreurs par contact
- ✅ Logging détaillé des succès/échecs

#### 3. **Utilitaires Crypto** (`crypto.ts`)
- ✅ `importPublicKeyFromPem()` : Import de clés publiques PEM
- ✅ `encryptWithPublicKey()` : Chiffrement avec clé publique arbitraire
- ✅ Support du format PEM standard
- ✅ Gestion correcte des types TypeScript

#### 4. **Interface Utilisateur** (`drive.vue`)
- ✅ Intégration du composant ShareItem
- ✅ Gestion du state de partage (`isSharing`, `shareItemTarget`)
- ✅ Feedback utilisateur après partage (succès/erreur)
- ✅ Rafraîchissement automatique après partage
- ✅ Support du menu contextuel (clic droit)

## 🔒 Sécurité

### Validations Backend
1. **Access Level** : Enum strict (`owner`, `editor`, `viewer`)
2. **Contact Existence** : Vérification en base de données
3. **Self-sharing** : Impossible de se partager avec soi-même
4. **Ownership** : Seul le propriétaire peut partager
5. **Authentication** : Tous les endpoints requièrent un JWT valide

### Chiffrement E2EE
1. **Clé de l'item** : Déchiffrée avec la clé privée du propriétaire
2. **Rechiffrement** : Pour chaque contact avec sa clé publique
3. **Transit sécurisé** : Les clés déchiffrées ne transitent jamais sur le réseau
4. **Stockage** : Chaque utilisateur ne peut déchiffrer que les clés qu'il possède

### Protection OWASP
- ✅ **Injection SQL** : Requêtes paramétrées avec SQLx
- ✅ **User Enumeration** : Authentication requise sur `get_public_key`
- ✅ **IDOR** : Vérification des permissions sur chaque action
- ✅ **Input Validation** : Email regex RFC 5322, enum access_level

## 📊 Schéma de Partage

```
┌─────────────┐
│   Alice     │ Owner
│  (User 1)   │
└──────┬──────┘
       │
       │ Partage dossier "Photos" avec Bob
       │ avec access_level = "editor"
       ▼
┌─────────────────────────────────────────┐
│  1. Récupération clé publique de Bob    │
│  2. Déchiffrement clé dossier (privée)  │
│  3. Rechiffrement clé (publique Bob)    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │  folder_access │
         ├────────────────┤
         │ folder_id: Photos
         │ user_id: Bob
         │ encrypted_folder_key: [key encrypted with Bob's public key]
         │ access_level: editor
         └────────────────┘
                  │
                  │ PROPAGATION AUTOMATIQUE
                  ▼
    ┌─────────────────────────────┐
    │  Sous-dossiers de "Photos"  │
    │  - Vacances/                │
    │  - Famille/                 │
    └─────────────┬───────────────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │  Fichiers dans Photos/*     │
    │  - IMG_001.jpg              │
    │  - IMG_002.jpg              │
    │  - Vacances/plage.jpg       │
    └─────────────────────────────┘
                  │
                  │ Bob peut maintenant déchiffrer tout
                  ▼
         ┌────────────────┐
         │      Bob       │
         │    (User 2)    │
         └────────────────┘
```

## 🚀 API Endpoints

### POST /drive/share_folder
Partage un dossier avec un contact.

**Request:**
```json
{
  "folder_id": "uuid",
  "contact_id": "uuid",
  "encrypted_item_key": "base64_encrypted_key",
  "access_level": "owner" | "editor" | "viewer"
}
```

**Response:**
```json
{
  "success": true,
  "data": "Folder shared successfully"
}
```

### POST /drive/share_file
Partage un fichier avec un contact.

**Request:**
```json
{
  "file_id": "uuid",
  "contact_id": "uuid",
  "encrypted_item_key": "base64_encrypted_key",
  "access_level": "owner" | "editor" | "viewer"
}
```

**Response:**
```json
{
  "success": true,
  "data": "File shared successfully"
}
```

### GET /contacts/get_public_key/{email}
Récupère la clé publique d'un utilisateur (authentification requise).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "Bob",
    "public_key": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

## 🧪 Tests Recommandés

### Tests Unitaires
1. Validation d'email avec cas limites
2. Prévention doublons de contacts
3. Chiffrement/déchiffrement avec clé publique
4. Validation access_level backend

### Tests d'Intégration
1. Partage dossier → Vérifier propagation sous-dossiers
2. Partage dossier → Vérifier propagation fichiers
3. Partage avec contact inexistant → Erreur 404
4. Partage avec soi-même → Erreur 400
5. Partage sans ownership → Erreur 404

### Tests E2E
1. Alice partage dossier avec Bob
2. Bob peut voir et déchiffrer le dossier partagé
3. Bob peut voir et déchiffrer les sous-dossiers
4. Bob peut voir et déchiffrer les fichiers
5. Bob ne peut pas partager si access_level != owner

## 📝 Notes Techniques

### Propagation Récursive SQL
```sql
WITH RECURSIVE folder_tree AS (
    -- Enfants directs du dossier partagé
    SELECT id FROM folders WHERE parent_folder_id = $1

    UNION ALL

    -- Descendants récursifs
    SELECT f.id FROM folders f
    JOIN folder_tree ft ON f.parent_folder_id = ft.id
)
-- Insert permissions pour tous les descendants
INSERT INTO folder_access (...)
SELECT ... FROM folder_tree
```

### Rechiffrement des Clés
1. **Propriétaire déchiffre** : `itemKey = decrypt(encrypted_key, owner_private_key)`
2. **Rechiffrement par contact** : `encrypted_key_for_bob = encrypt(itemKey, bob_public_key)`
3. **Stockage** : `folder_access.encrypted_folder_key = encrypted_key_for_bob`

### Performance
- ✅ Batch insert pour propagation (1 requête pour tous les sous-dossiers)
- ✅ Promise.all pour partage multi-contacts (parallèle)
- ⚠️ TODO: Endpoint batch pour récupérer plusieurs clés publiques

## 🐛 Bugs Connus / TODO

- [ ] Remplacer `alert()` par un système de notifications toast
- [ ] Ajouter endpoint batch `POST /contacts/get_public_keys_batch`
- [ ] Ajouter pagination pour dossiers avec beaucoup de fichiers
- [ ] Ajouter gestion des permissions (read/write enforcement)
- [ ] Ajouter un écran de gestion des partages (qui a accès à quoi)
- [ ] Ajouter possibilité de révoquer un partage

## 🎯 Améliorations Futures

1. **Notifications** : Notifier les contacts quand un élément est partagé
2. **Gestion des conflits** : Gérer les modifications simultanées
3. **Historique** : Tracker qui a partagé quoi et quand
4. **Quotas** : Limiter le nombre de partages par utilisateur
5. **Expiration** : Partages temporaires avec date d'expiration
6. **Liens publics** : Générer des liens de partage public (E2EE)

## 📚 Fichiers Modifiés

### Backend
- `gauzian_back/src/drive.rs` (+150 lignes)
- `gauzian_back/src/handlers.rs` (+50 lignes)
- `gauzian_back/src/routes.rs` (+2 lignes)

### Frontend
- `gauzian_front/app/components/ShareItem.vue` (~50 lignes modifiées)
- `gauzian_front/app/composables/drive/useFileActions.js` (+100 lignes)
- `gauzian_front/app/utils/crypto.ts` (+50 lignes)
- `gauzian_front/app/pages/drive.vue` (+20 lignes modifiées)

## 🔐 Checklist de Sécurité

- [x] Tous les endpoints requièrent authentification
- [x] Validation des niveaux d'accès (enum)
- [x] Vérification de l'existence des contacts
- [x] Interdiction de self-sharing
- [x] Vérification des permissions propriétaire
- [x] Requêtes SQL paramétrées (anti-injection)
- [x] Chiffrement E2EE préservé
- [x] Validation email RFC compliant
- [x] Logging des erreurs
- [x] Gestion des erreurs avec types HTTP appropriés

---

**Date de mise à jour** : 2026-01-25
**Version** : 1.0.0
**Auteur** : Claude Sonnet 4.5
