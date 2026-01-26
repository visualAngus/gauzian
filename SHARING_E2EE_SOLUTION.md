# Solution E2EE pour le Partage avec Propagation

## 🔴 Le Problème Initial

Lors du partage d'un dossier, le backend ne peut pas rechiffrer les clés des sous-dossiers et fichiers car :

1. **E2EE oblige** : Les clés déchiffrées ne peuvent exister QUE côté client
2. **Chaque item a sa propre clé** : "Photos" a une clé, "Vacances" en a une autre
3. **Le backend ne voit que des clés chiffrées** : Il ne peut pas les déchiffrer pour les rechiffrer

### Tentative Incorrecte (Backend-only)

```
Alice partage "Photos" avec Bob
├── Backend reçoit : encrypted_key_for_bob (clé de "Photos" chiffrée)
├── Backend essaie de propager cette MÊME clé aux sous-dossiers
│   ├── Vacances/ ❌ (a sa propre clé différente)
│   └── Famille/  ❌ (a sa propre clé différente)
└── Bob ne peut déchiffrer que "Photos", pas les sous-dossiers
```

## ✅ La Solution : Batch Rechiffrement Frontend

Le **frontend** doit :
1. Récupérer TOUS les sous-dossiers et fichiers récursivement
2. Déchiffrer TOUTES leurs clés avec la clé privée d'Alice
3. Rechiffrer CHAQUE clé avec la clé publique de Bob
4. Envoyer TOUTES les clés rechiffrées au backend en un batch

### Architecture Correcte

```
┌─────────────┐
│   ALICE     │
│  (Frontend) │
└──────┬──────┘
       │
       │ 1. Partage "Photos" avec Bob
       │
       ▼
┌────────────────────────────────────────┐
│  Étape 1 : Récupération Récursive     │
│                                        │
│  GET /drive/folder_contents/photos    │
│    ├── Vacances/ (folder_id: uuid1)   │
│    └── Famille/  (folder_id: uuid2)   │
│                                        │
│  GET /drive/folder_contents/uuid1     │
│    └── plage.jpg (file_id: uuid3)     │
│                                        │
│  GET /drive/folder_contents/uuid2     │
│    └── noel.jpg (file_id: uuid4)      │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  Étape 2 : Déchiffrement (Alice)      │
│                                        │
│  decrypt(Photos.encrypted_key)         │
│    → photos_key_clear                  │
│                                        │
│  decrypt(Vacances.encrypted_key)       │
│    → vacances_key_clear                │
│                                        │
│  decrypt(plage.jpg.encrypted_key)      │
│    → plage_key_clear                   │
│                                        │
│  ... (pour tous les items)             │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  Étape 3 : Rechiffrement (Bob)        │
│                                        │
│  GET /contacts/get_public_key/bob      │
│    → bob_public_key                    │
│                                        │
│  encrypt(photos_key_clear, bob_pub)    │
│    → photos_key_for_bob                │
│                                        │
│  encrypt(vacances_key_clear, bob_pub)  │
│    → vacances_key_for_bob              │
│                                        │
│  encrypt(plage_key_clear, bob_pub)     │
│    → plage_key_for_bob                 │
│                                        │
│  ... (pour tous les items)             │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  Étape 4 : Envoi Batch au Backend     │
│                                        │
│  POST /drive/share_folder_batch        │
│  {                                     │
│    folder_id: "photos",                │
│    contact_id: "bob_uuid",             │
│    access_level: "editor",             │
│    folder_keys: [                      │
│      {                                 │
│        folder_id: "photos",            │
│        encrypted_folder_key: photos_key_for_bob
│      },                                │
│      {                                 │
│        folder_id: "vacances",          │
│        encrypted_folder_key: vacances_key_for_bob
│      },                                │
│      ...                               │
│    ],                                  │
│    file_keys: [                        │
│      {                                 │
│        file_id: "plage.jpg",           │
│        encrypted_file_key: plage_key_for_bob
│      },                                │
│      ...                               │
│    ]                                   │
│  }                                     │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│  Backend : Insertion en Base           │
│                                        │
│  BEGIN TRANSACTION;                    │
│                                        │
│  -- Pour chaque dossier               │
│  INSERT INTO folder_access (           │
│    folder_id, user_id,                 │
│    encrypted_folder_key, access_level  │
│  ) VALUES ...                          │
│  ON CONFLICT DO UPDATE                 │
│                                        │
│  -- Pour chaque fichier                │
│  INSERT INTO file_access (             │
│    file_id, user_id, folder_id,        │
│    encrypted_file_key, access_level    │
│  ) VALUES ...                          │
│  ON CONFLICT DO UPDATE                 │
│                                        │
│  COMMIT;                               │
└────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│    BOB      │
│  (Frontend) │
│             │
│  ✅ Peut déchiffrer :                  │
│     - Photos/                          │
│     - Vacances/                        │
│     - Famille/                         │
│     - plage.jpg                        │
│     - noel.jpg                         │
└─────────────┘
```

## 📝 Implémentation

### Backend (Rust)

#### 1. Nouvelles Structures (`handlers.rs`)

```rust
#[derive(Deserialize)]
pub struct FolderKeyBatch {
    pub folder_id: Uuid,
    pub encrypted_folder_key: String,
}

#[derive(Deserialize)]
pub struct FileKeyBatch {
    pub file_id: Uuid,
    pub encrypted_file_key: String,
}

#[derive(Deserialize)]
pub struct ShareFolderBatchRequest {
    pub folder_id: Uuid,
    pub contact_id: Uuid,
    pub access_level: String,
    pub folder_keys: Vec<FolderKeyBatch>,
    pub file_keys: Vec<FileKeyBatch>,
}
```

#### 2. Nouveau Endpoint

```rust
POST /drive/share_folder_batch
```

Accepte :
- ID du dossier principal
- ID du contact
- Niveau d'accès
- **Liste de TOUTES les clés de dossiers rechiffrées**
- **Liste de TOUTES les clés de fichiers rechiffrées**

#### 3. Logique Backend (`drive.rs:share_folder_batch`)

```rust
pub async fn share_folder_batch(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    contact_user_id: Uuid,
    access_level: &str,
    folder_keys: Vec<(Uuid, String)>,
    file_keys: Vec<(Uuid, String)>,
) -> Result<(), sqlx::Error>
```

- Valide access_level
- Vérifie existence du contact
- Vérifie ownership sur le dossier principal
- **Insert en batch** toutes les clés de dossiers
- **Insert en batch** toutes les clés de fichiers
- Transaction atomique

### Frontend (JavaScript)

#### 1. Récupération Récursive

```javascript
const getSubfoldersRecursive = async (folderId) => {
    const subfolders = [];

    // Récupérer enfants directs
    const res = await fetch(`${API_URL}/drive/folder_contents/${folderId}`);
    const data = await res.json();
    const folders = data.data?.folders || [];

    subfolders.push(...folders);

    // Récursion pour chaque sous-dossier
    for (const folder of folders) {
        const deeperFolders = await getSubfoldersRecursive(folder.folder_id);
        subfolders.push(...deeperFolders);
    }

    return subfolders;
};
```

#### 2. Rechiffrement et Envoi

```javascript
// Récupérer tous les sous-dossiers
const subfolders = await getSubfoldersRecursive(itemId);
const allFolders = [mainFolder, ...subfolders];

// Récupérer tous les fichiers
const allFiles = await getFilesRecursive(itemId, allFolderIds);

// Pour chaque contact
for (const contact of contactsList) {
    // Rechiffrer toutes les clés de dossiers
    const folderKeys = [];
    for (const folder of allFolders) {
        const folderDataKey = await decryptWithStoredPrivateKey(
            folder.encrypted_folder_key
        );
        const encryptedForContact = await encryptWithPublicKey(
            contact.public_key,
            folderDataKey
        );
        folderKeys.push({
            folder_id: folder.folder_id,
            encrypted_folder_key: encryptedForContact,
        });
    }

    // Rechiffrer toutes les clés de fichiers
    const fileKeys = [];
    for (const file of allFiles) {
        const fileDataKey = await decryptWithStoredPrivateKey(
            file.encrypted_file_key
        );
        const encryptedForContact = await encryptWithPublicKey(
            contact.public_key,
            fileDataKey
        );
        fileKeys.push({
            file_id: file.file_id,
            encrypted_file_key: encryptedForContact,
        });
    }

    // Envoyer le batch
    await fetch(`${API_URL}/drive/share_folder_batch`, {
        method: "POST",
        body: JSON.stringify({
            folder_id: itemId,
            contact_id: contact.contact_id,
            access_level: accessLevel,
            folder_keys: folderKeys,
            file_keys: fileKeys,
        }),
    });
}
```

## 🔒 Sécurité

### ✅ Ce qui est Préservé

1. **E2EE Maintenu** : Les clés en clair ne transitent JAMAIS sur le réseau
2. **Clés Individuelles** : Chaque item conserve sa propre clé de chiffrement
3. **Isolation** : Bob ne peut déchiffrer que ce qu'Alice a partagé
4. **Validation** : Backend vérifie ownership et permissions

### ✅ Validations Backend

1. **Access Level** : Enum strict (`owner`, `editor`, `viewer`)
2. **Contact Existe** : Vérification en DB
3. **Anti-self-sharing** : Impossible de se partager avec soi-même
4. **Ownership** : Seul le propriétaire peut partager
5. **Transaction Atomique** : Tout réussit ou tout échoue

## 📊 Performance

### Complexité

Pour un dossier avec :
- N sous-dossiers
- M fichiers
- C contacts

**Requêtes** :
- `N+1` requêtes pour récupérer la hiérarchie (1 par niveau)
- `C` requêtes de partage (1 par contact)
- `C` transactions SQL (batch insert)

**Opérations Crypto** :
- `(N+M) * C` déchiffrements (Alice)
- `(N+M) * C` rechiffrements (Bob)

### Exemple Concret

Partage de "Projets" (10 sous-dossiers, 50 fichiers) avec 2 contacts :

```
Requêtes API : ~12 (récupération hiérarchie + 2 partages)
Déchiffrements : 60 * 2 = 120
Rechiffrements : 60 * 2 = 120
Durée estimée : 2-5 secondes
```

### Optimisations Possibles

1. **Cache Local** : Garder la hiérarchie en mémoire
2. **WebWorkers** : Crypto en arrière-plan
3. **Batch Clés Publiques** : Récupérer plusieurs clés publiques en 1 requête
4. **Compression** : Compresser le payload JSON pour gros dossiers

## 🧪 Tests

### Scénario 1 : Partage Simple

1. Alice crée "Photos" avec 2 sous-dossiers et 3 fichiers
2. Alice partage avec Bob (viewer)
3. Bob se connecte
4. Vérifier : Bob voit tous les dossiers et fichiers
5. Vérifier : Bob peut télécharger et déchiffrer tous les fichiers

### Scénario 2 : Hiérarchie Profonde

```
Projet/
├── Docs/
│   ├── Specs/
│   │   └── spec.pdf
│   └── README.md
└── Code/
    ├── src/
    │   └── main.js
    └── tests/
        └── test.js
```

1. Alice partage "Projet" avec Bob
2. Vérifier : Tous les niveaux accessibles
3. Vérifier : Tous les fichiers déchiffrables

### Scénario 3 : Multi-contacts

1. Alice partage "Photos" avec Bob, Charlie, David
2. Vérifier : Les 3 peuvent accéder
3. Vérifier : Chacun a ses propres clés rechiffrées

## ⚠️ Limitations Actuelles

1. **Performance** : Gros dossiers (1000+ fichiers) peuvent être lents
2. **UX** : Pas de barre de progression pendant le rechiffrement
3. **Réseau** : Pas de retry automatique en cas d'échec
4. **Cache** : Hiérarchie re-fetchée à chaque partage

## 🚀 Améliorations Futures

- [ ] Barre de progression pour gros dossiers
- [ ] WebWorkers pour crypto parallèle
- [ ] Cache de la hiérarchie
- [ ] Retry automatique
- [ ] Compression payload
- [ ] Partage incrémental (notification + on-demand)

---

**Date** : 2026-01-25
**Version** : 2.0 (Batch E2EE)
