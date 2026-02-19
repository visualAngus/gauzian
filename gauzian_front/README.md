# GAUZIAN Frontend - Nuxt 4 / Vue 3

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Pages & Routes](#pages--routes)
5. [Composables (Composition API)](#composables-composition-api)
6. [Chiffrement Client-Side (crypto.ts)](#chiffrement-client-side-cryptots)
7. [Components](#components)
8. [State Management](#state-management)
9. [API Integration](#api-integration)
10. [Build & Deploy](#build--deploy)
11. [Development Workflow](#development-workflow)
12. [Troubleshooting](#troubleshooting)
13. [Security](#security)

---

## Vue d'Ensemble

**GAUZIAN Frontend** est une application web Nuxt 4 (Vue 3 Composition API) qui implémente un **système de stockage cloud chiffré de bout en bout (E2EE)**.

### Caractéristiques Clés

- ✅ **Zero-Knowledge Encryption** : Le serveur ne voit jamais les données en clair
- ✅ **Client-Side Crypto** : RSA-4096 + AES-256-GCM (Web Crypto API)
- ✅ **File Manager** : Upload/download de fichiers chiffrés par chunks
- ✅ **Folder Hierarchy** : Structure de dossiers avec permissions
- ✅ **Sharing** : Partage E2EE de fichiers/dossiers (RSA key wrapping)
- ✅ **Agenda** : Calendrier partagé avec événements chiffrés
- ✅ **IndexedDB** : Stockage local des clés crypto (non-extractable)

### Stack Technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| **Nuxt** | 4.x | Framework SSR/SPA |
| **Vue** | 3.x | Composition API |
| **Web Crypto API** | Native | RSA/AES encryption |
| **IndexedDB** | Native | Stockage clés cryptographiques |
| **Fetch API** | Native | Requêtes HTTP avec cookies |
| **Docker** | - | Containerization (production) |

---

## Quick Start

### Prérequis

- **Node.js** ≥ 18.x
- **npm** / **pnpm** / **yarn** / **bun**
- **Backend API** en cours d'exécution (voir `/gauzian_back/README.md`)

### Installation

```bash
cd gauzian_front
npm install
```

### Configuration

Créer `.env` (ou configurer via variables d'environnement) :

```bash
# URL de l'API backend (production)
NUXT_PUBLIC_API_URL=https://gauzian.pupin.fr/api

# Développement local
# NUXT_PUBLIC_API_URL=http://localhost:8080
```

### Lancement Développement

```bash
npm run dev
```

Application accessible sur **http://localhost:3000**

### Build Production

```bash
npm run build       # Build optimisé
npm run preview     # Preview du build (port 3000)
```

---

## Architecture

### Structure du Projet

```
gauzian_front/
├── app/                          # Code source Nuxt 4
│   ├── pages/                    # Routes auto-générées
│   │   ├── index.vue             # Page d'accueil (redirect → login ou drive)
│   │   ├── login.vue             # Authentification (login + register)
│   │   ├── drive.vue             # Gestionnaire de fichiers (MAIN APP)
│   │   ├── agenda.vue            # Calendrier partagé
│   │   └── info.vue              # Infos utilisateur + tests crypto
│   │
│   ├── components/               # Composants Vue réutilisables
│   │   ├── AppHeader.vue         # En-tête global (navigation)
│   │   ├── Notification.vue      # Système de notifications toast
│   │   ├── FileItem.vue          # Élément de fichier (grille/liste)
│   │   ├── FolderTreeNode.vue    # Nœud arbre de dossiers
│   │   ├── ShareItem.vue         # Élément dans liste de partage
│   │   ├── InfoItem.vue          # Élément d'information
│   │   ├── EventAgenda.vue       # Événement dans calendrier
│   │   └── agenda/               # Composants spécifiques agenda
│   │       ├── EventModal.vue    # Modal création/édition événement
│   │       ├── EventSearch.vue   # Recherche d'événements
│   │       ├── CategoryManager.vue # Gestion catégories
│   │       ├── AllDayEvents.vue  # Affichage événements journée entière
│   │       ├── CategoryFilter.vue # Filtre par catégorie
│   │       └── AgendaToolbar.vue # Barre d'outils agenda
│   │
│   ├── composables/              # Logique réutilisable (Composition API)
│   │   ├── useAuth.js            # ⭐ Authentification & session
│   │   ├── useNotification.js    # Système de notifications
│   │   ├── useApiUrl.js          # Configuration URL API
│   │   ├── drive/                # Composables Drive
│   │   │   ├── useDriveData.js   # Chargement fichiers/dossiers
│   │   │   ├── useFileActions.js # Actions (upload, delete, rename, etc.)
│   │   │   ├── useSelection.js   # Sélection multiple
│   │   │   ├── useLayout.js      # Grille/Liste view toggle
│   │   │   ├── useInfoPanel.js   # Panneau d'infos latéral
│   │   │   ├── useContextMenu.js # Menu contextuel clic droit
│   │   │   ├── useAutoShare.js   # Partage automatique
│   │   │   └── useTransfers.js   # Gestion uploads/downloads
│   │   └── agenda/               # Composables Agenda
│   │       ├── useEvents.js      # CRUD événements
│   │       ├── useCategories.js  # CRUD catégories
│   │       ├── useNavigation.js  # Navigation calendrier (mois/semaine)
│   │       ├── useView.js        # Affichage (jour/semaine/mois)
│   │       └── useLayout.js      # Layout agenda
│   │
│   ├── utils/                    # Utilitaires
│   │   └── crypto.ts             # ⭐⭐⭐ CORE E2EE (RSA + AES)
│   │
│   ├── directives/               # Directives Vue personnalisées
│   │   └── dropzone.js           # Drag & drop pour upload
│   │
│   ├── layouts/                  # Layouts Nuxt
│   │   └── default.vue           # Layout par défaut
│   │
│   └── app.vue                   # Point d'entrée application
│
├── public/                       # Assets statiques
├── nuxt.config.ts                # Configuration Nuxt
├── package.json                  # Dépendances npm
├── tsconfig.json                 # Configuration TypeScript
├── Dockerfile                    # Image Docker production
└── README.md                     # Ce fichier

```

### Flux de Données

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Vue Components (pages/*.vue, components/*.vue)     │     │
│  └──────────────────┬─────────────────────────────────┘     │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Composables (useAuth, useDriveData, useEvents...)  │     │
│  └──────────────┬────────────────────┬──────────────── ┘    │
│                 │                    │                       │
│                 ▼                    ▼                       │
│  ┌───────────────────────┐  ┌──────────────────────┐        │
│  │   crypto.ts (E2EE)    │  │   Fetch API          │        │
│  │ - RSA-4096            │  │   (HTTP requests)    │        │
│  │ - AES-256-GCM         │  │   + credentials      │        │
│  │ - PBKDF2              │  └──────────┬───────────┘        │
│  │ - IndexedDB storage   │             │                    │
│  └───────────────────────┘             │                    │
│                                         │                    │
└─────────────────────────────────────────┼────────────────────┘
                                          │ HTTPS
                                          ▼
                             ┌────────────────────────┐
                             │   Backend API (Rust)   │
                             │   /api/* endpoints     │
                             └────────────────────────┘
```

---

## Pages & Routes

### 1. `/` (index.vue) - Page d'Accueil

**Rôle** : Redirection intelligente selon état d'authentification.

**Logique** :
```javascript
if (userLoggedIn) {
  navigateTo('/drive')
} else {
  navigateTo('/login')
}
```

---

### 2. `/login` (login.vue) - Authentification

**Fonctionnalités** :
- **Login** : Username/email + mot de passe
- **Register** : Création compte avec génération clés RSA
- **Crypto Bootstrap** : Génération paire RSA-4096 + encrypted_private_key

**Workflow Register** :
1. Utilisateur entre `username`, `email`, `password`
2. Client génère paire RSA-4096 (Web Crypto API)
3. Client dérive clé de chiffrement depuis password (PBKDF2)
4. Client chiffre clé privée RSA avec clé dérivée → `encrypted_private_key`
5. Client envoie au serveur :
   - `username`, `email`, `password_hash` (SHA256 + salt)
   - `encrypted_private_key`, `public_key`, `encrypted_record_key`
6. Serveur stocke (ne peut jamais déchiffrer `encrypted_private_key`)

**Workflow Login** :
1. Utilisateur entre credentials
2. Backend valide, retourne JWT cookie + `encrypted_private_key`, `public_key`
3. Client dérive clé de déchiffrement depuis password
4. Client déchiffre `encrypted_private_key` → récupère clé privée RSA
5. Clés stockées dans IndexedDB (non-extractable)
6. Redirect vers `/drive`

---

### 3. `/drive` (drive.vue) - Gestionnaire de Fichiers

**Page principale** de l'application. Interface type Google Drive / Dropbox.

**Fonctionnalités** :
- 📁 **Arbre de dossiers** (sidebar gauche) avec hiérarchie infinie
- 📄 **Liste de fichiers** (vue grille ou liste)
- ⬆️ **Upload** : Drag & drop ou bouton (fichiers chiffrés par chunks de 5MB)
- ⬇️ **Download** : Récupération chunks S3 → déchiffrement → reconstruction fichier
- ✏️ **Rename** : Fichiers et dossiers (metadata chiffrée)
- 🗑️ **Delete** : Soft delete (corbeille)
- 📤 **Share** : Partage E2EE avec d'autres utilisateurs
- ℹ️ **Info Panel** : Métadonnées, permissions, partages
- 🖱️ **Context Menu** : Clic droit pour actions rapides
- ✅ **Multi-selection** : Sélection multiple avec Ctrl/Shift

**Composables utilisés** :
- `useDriveData` : Chargement fichiers/dossiers depuis API
- `useFileActions` : Upload, delete, rename, move, share
- `useSelection` : Gestion sélection multiple
- `useLayout` : Toggle grille/liste
- `useInfoPanel` : Affichage panneau latéral
- `useContextMenu` : Menu clic droit
- `useTransfers` : Gestion uploads/downloads avec progress

**Sécurité** :
- Tous les noms de fichiers/dossiers sont **chiffrés** (`encrypted_metadata`)
- Le serveur ne connaît **jamais** le nom réel des fichiers
- Seuls `size` et `mime_type` sont en clair (pour filtrage/statistiques)

---

### 4. `/agenda` (agenda.vue) - Calendrier Partagé

**Fonctionnalités** :
- 📅 **Vues multiples** : Jour, Semaine, Mois
- ➕ **Création événements** : Modal avec formulaire
- ✏️ **Édition/Suppression** : Modal contextuel
- 🏷️ **Catégories** : Organisation avec couleurs/icônes
- 👥 **Partage événements** : E2EE avec autres utilisateurs
- 🔍 **Recherche** : Filtrage par titre/catégorie
- 🎨 **Personnalisation** : Couleurs, événements toute journée, multi-jours

**Composables utilisés** :
- `useEvents` : CRUD événements avec chiffrement E2EE
- `useCategories` : Gestion catégories
- `useNavigation` : Navigation calendrier (next/prev month/week)
- `useView` : Toggle vues (jour/semaine/mois)

**Chiffrement** :
- Champs chiffrés : `title`, `description`, `start_day_id`, `end_day_id`, `start_hour`, `end_hour`, `category`, `color`
- Clé : `encrypted_data_key` stockée dans `agenda_events`
- Partage : `encrypted_event_key` dans `agenda_event_participants` (chiffrée avec clé publique participant)

---

### 5. `/info` (info.vue) - Informations Utilisateur

**Rôle** : Affichage infos compte + tests crypto (développement).

**Contenu** :
- Infos utilisateur (username, email)
- Statistiques (fichiers, espace utilisé)
- Tests crypto (encrypt/decrypt pour debugging)

⚠️ **À nettoyer** : Retirer `console.log` avec données sensibles avant production.

---

## Composables (Composition API)

Les **composables** encapsulent la logique réutilisable (état + fonctions). Convention Nuxt : `use*()`.

### Core Composables

#### `useAuth()` - Authentification & Session

**Fichier** : `composables/useAuth.js`

**État** :
```javascript
const user = ref(null)  // User object (username, email)
const isLoggedIn = computed(() => user.value !== null)
```

**Fonctions** :
```javascript
async login(username, password)
async register(username, email, password)
async logout()
async checkAuth()  // Vérifie session au chargement
```

**Usage** :
```vue
<script setup>
const { user, isLoggedIn, login, logout } = useAuth()
</script>
```

---

#### `useDriveData()` - Chargement Fichiers/Dossiers

**Fichier** : `composables/drive/useDriveData.js`

**État** :
```javascript
const files = ref([])
const folders = ref([])
const currentFolder = ref(null)
const loading = ref(false)
```

**Fonctions** :
```javascript
async loadFiles(folderId)    // Charge fichiers du dossier
async loadFolders()          // Charge arbre dossiers
async refreshData()          // Recharge données
```

---

#### `useFileActions()` - Actions Fichiers

**Fichier** : `composables/drive/useFileActions.js`

**Fonctions** :
```javascript
async uploadFile(file, folderId)
async downloadFile(fileId)
async deleteFile(fileId)
async renameFile(fileId, newName)
async moveFile(fileId, targetFolderId)
async shareFile(fileId, userId, accessLevel)
```

**Workflow Upload** :
1. Lire fichier (FileReader API)
2. Générer `file_key` aléatoire (AES-256)
3. Chiffrer fichier avec `file_key` (AES-GCM)
4. Chiffrer metadata (nom, extension) avec `record_key`
5. Diviser en chunks de 5MB
6. Pour chaque chunk :
   - `POST /api/files/{id}/chunks` (multipart/form-data)
7. `POST /api/files/{id}/finalize` (marquer upload complet)

---

#### `useEvents()` - Événements Agenda

**Fichier** : `composables/agenda/useEvents.js`

**État** :
```javascript
const events = ref([])
const selectedEvent = ref(null)
```

**Fonctions** :
```javascript
async createEvent(eventData)
async updateEvent(eventId, eventData)
async deleteEvent(eventId)
async shareEvent(eventId, participantId)
```

**Chiffrement** :
1. Générer `data_key` aléatoire
2. Chiffrer champs sensibles (`title`, `description`, `start_hour`, etc.)
3. Chiffrer `data_key` avec clé publique owner → `encrypted_data_key`
4. Envoyer au serveur (données chiffrées + `encrypted_data_key`)

---

### Utilitaires

#### `useNotification()` - Système de Notifications

**Usage** :
```javascript
const { notify } = useNotification()

notify({ type: 'success', message: 'Fichier uploadé !' })
notify({ type: 'error', message: 'Erreur réseau' })
notify({ type: 'info', message: 'Chargement...' })
```

---

## Chiffrement Client-Side (crypto.ts)

**Fichier** : `app/utils/crypto.ts`

**⭐ CORE du système E2EE**. Toutes les opérations cryptographiques se font ici.

### Algorithmes Utilisés

| Opération | Algorithme | Paramètres |
|-----------|------------|------------|
| **Asymétrique (clés)** | RSA-OAEP | 4096 bits, SHA-256 |
| **Symétrique (données)** | AES-GCM | 256 bits, IV 12 bytes |
| **Dérivation clé** | PBKDF2 | SHA-256, 100k iterations (⚠️ à augmenter à 310k) |
| **Stockage clés** | IndexedDB | CryptoKey non-extractable |

### Fonctions Principales

#### 1. Génération de Clés

```typescript
async function generateKeyPair(): Promise<CryptoKeyPair>
```

Génère paire RSA-4096 pour un nouvel utilisateur (register).

**Retour** :
```javascript
{
  publicKey: CryptoKey,   // Exportable (JWK)
  privateKey: CryptoKey   // Non-extractable (stocké IndexedDB)
}
```

---

#### 2. Chiffrement de Clé Privée

```typescript
async function encryptPrivateKey(
  privateKey: CryptoKey,
  password: string
): Promise<string>
```

Chiffre la clé privée RSA avec une clé dérivée du mot de passe.

**Steps** :
1. Dérive clé AES depuis `password` (PBKDF2, 100k iterations)
2. Exporte `privateKey` en JWK
3. Chiffre JWK avec clé dérivée (AES-GCM)
4. Retourne base64 de : `salt + iv + ciphertext`

---

#### 3. Déchiffrement de Clé Privée

```typescript
async function decryptPrivateKey(
  encryptedPrivateKey: string,
  password: string
): Promise<CryptoKey>
```

Inverse de `encryptPrivateKey`. Utilisé au login.

**Steps** :
1. Decode base64 → extrait `salt`, `iv`, `ciphertext`
2. Dérive clé AES depuis `password` + `salt`
3. Déchiffre `ciphertext` → obtient JWK
4. Importe JWK → retourne `CryptoKey` (non-extractable)

---

#### 4. Chiffrement de Fichier

```typescript
async function encryptFile(
  file: File,
  fileKey: CryptoKey
): Promise<ArrayBuffer>
```

Chiffre le contenu d'un fichier avec AES-256-GCM.

**Usage** :
```javascript
const fileKey = await generateAESKey()  // Clé symétrique aléatoire
const encryptedContent = await encryptFile(file, fileKey)
// Upload encryptedContent + chiffrer fileKey avec RSA pour stockage
```

---

#### 5. Déchiffrement de Fichier

```typescript
async function decryptFile(
  encryptedData: ArrayBuffer,
  fileKey: CryptoKey
): Promise<ArrayBuffer>
```

Inverse de `encryptFile`. Utilisé au download.

---

#### 6. Wrap/Unwrap de Clés (Partage)

```typescript
async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<ArrayBuffer>

async function unwrapKey(
  wrappedKey: ArrayBuffer,
  unwrappingKey: CryptoKey
): Promise<CryptoKey>
```

**Usage** : Partage de fichiers.

**Exemple** :
```javascript
// Owner partage fichier avec user2
const fileKey = await getFileKey(fileId)  // Récupère clé AES du fichier
const user2PublicKey = await fetchPublicKey(user2Id)
const wrappedFileKey = await wrapKey(fileKey, user2PublicKey)

// Envoie wrappedFileKey au serveur → stocké dans file_access.encrypted_file_key

// user2 récupère le fichier
const wrappedFileKey = await fetchWrappedFileKey(fileId)
const myPrivateKey = await getMyPrivateKey()  // Depuis IndexedDB
const fileKey = await unwrapKey(wrappedFileKey, myPrivateKey)
// Peut maintenant déchiffrer le fichier avec fileKey
```

---

### Stockage Clés (IndexedDB)

**Database** : `gauzian-crypto-keys`
**Store** : `keys`

**Clés stockées** :
- `privateKey` : Clé privée RSA (non-extractable)
- `recordKey` : Clé maître pour métadonnées (AES-256)
- Clés de fichiers temporaires (purge après usage)

**Avantages** :
- ✅ **Non-extractable** : Impossible d'exporter les clés via JavaScript
- ✅ **Persistent** : Survit au refresh de page
- ✅ **Isolé** : Par origine (Same-Origin Policy)

**API** :
```javascript
await saveKeyToIndexedDB('privateKey', cryptoKey)
const privateKey = await getKeyFromIndexedDB('privateKey')
await deleteKeyFromIndexedDB('privateKey')
```

---

## Components

### Drive Components

#### `FileItem.vue`

Affichage d'un fichier (grille ou liste).

**Props** :
- `file` : Objet fichier (id, encrypted_metadata, size, mime_type)
- `viewMode` : 'grid' | 'list'
- `selected` : Boolean (sélectionné ou non)

**Events** :
- `@click` : Sélection
- `@dblclick` : Téléchargement
- `@contextmenu` : Menu contextuel

---

#### `FolderTreeNode.vue`

Nœud récursif pour arbre de dossiers (sidebar).

**Props** :
- `folder` : Objet dossier
- `level` : Profondeur (pour indentation)

**Features** :
- 📁 Icône dossier (expand/collapse)
- ➕ Bouton "Nouveau sous-dossier"
- Drag & drop pour déplacer fichiers

---

### Agenda Components

#### `EventModal.vue`

Modal de création/édition d'événement.

**Props** :
- `event` : Événement à éditer (null pour nouveau)
- `isOpen` : Boolean (modal visible)

**Form Fields** :
- Titre, description
- Date/heure début/fin
- Toute journée / Multi-jours
- Catégorie, couleur

**Events** :
- `@save` : Sauvegarde événement
- `@close` : Fermeture modal

---

## State Management

GAUZIAN utilise **Nuxt 3 auto-imports + composables** au lieu de Pinia/Vuex.

### État Global

**Authentification** :
```javascript
// composables/useAuth.js (singleton auto-importé)
const user = ref(null)
const isLoggedIn = computed(() => user.value !== null)
```

**Fichiers/Dossiers** :
```javascript
// composables/drive/useDriveData.js
const files = ref([])
const folders = ref([])
const currentFolder = ref(null)
```

**Événements Agenda** :
```javascript
// composables/agenda/useEvents.js
const events = ref([])
const categories = ref([])
```

### Persistance

- **Session** : JWT cookie (httpOnly, secure)
- **Clés crypto** : IndexedDB (non-extractable CryptoKey)
- **Preferences UI** : localStorage (thème, vue grille/liste)

---

## API Integration

### Configuration

**Fichier** : `composables/useApiUrl.js`

```javascript
const apiUrl = useRuntimeConfig().public.apiUrl || 'http://localhost:8080'
```

**Variable d'environnement** :
```bash
# .env
NUXT_PUBLIC_API_URL=https://gauzian.pupin.fr/api
```

### Requêtes HTTP

**Pattern standard** :

```javascript
const response = await fetch(`${apiUrl}/endpoint`, {
  method: 'POST',
  credentials: 'include',  // ⚠️ CRITIQUE : Envoie cookies (JWT)
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
})

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${await response.text()}`)
}

const result = await response.json()
```

### Endpoints Principaux

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/auth/register` | POST | Créer compte |
| `/auth/login` | POST | Connexion (retourne JWT cookie) |
| `/auth/logout` | POST | Déconnexion (invalide JWT) |
| `/auth/verify` | GET | Vérifier session |
| `/files` | GET | Lister fichiers utilisateur |
| `/files/{id}` | GET | Infos fichier |
| `/files/{id}/download` | GET | Télécharger chunks |
| `/files/initialize` | POST | Initialiser upload |
| `/files/{id}/chunks` | POST | Upload chunk |
| `/files/{id}/finalize` | POST | Finaliser upload |
| `/files/{id}/share` | POST | Partager fichier |
| `/folders` | GET | Lister dossiers |
| `/folders` | POST | Créer dossier |
| `/agenda/events` | GET | Lister événements |
| `/agenda/events` | POST | Créer événement |
| `/agenda/events/{id}` | PUT | Modifier événement |
| `/agenda/events/{id}` | DELETE | Supprimer événement |

**Voir** : `/gauzian_front/API_ENDPOINTS.md` pour détails (agenda endpoints).

---

## Build & Deploy

### Build Development

```bash
npm run dev
```

- Hot reload activé
- Source maps complets
- Logs de debug

### Build Production

```bash
npm run build
```

- Minification JS/CSS
- Tree-shaking
- Code splitting
- Optimisation images

**Output** : `.output/` (Nitro server)

### Preview Production

```bash
npm run preview
```

Lance le serveur Nitro en mode production (port 3000).

---

### Docker Production

**Dockerfile** :

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

**Build & Run** :

```bash
# Build image
docker build -t angusvisual/gauzian-front:dev .

# Run container
docker run -p 3000:3000 \
  -e NUXT_PUBLIC_API_URL=https://gauzian.pupin.fr/api \
  angusvisual/gauzian-front:dev
```

---

### Déploiement VPS (Kubernetes)

Voir `/gauzian_back/k8s/README.md` pour manifests K8s complets.

**Manifest** : `front-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: front
  namespace: gauzian-v2
spec:
  replicas: 2
  selector:
    matchLabels:
      app: front
  template:
    metadata:
      labels:
        app: front
    spec:
      containers:
      - name: front
        image: angusvisual/gauzian-front:dev
        ports:
        - containerPort: 3000
        env:
        - name: NUXT_PUBLIC_API_URL
          value: "https://gauzian.pupin.fr/api"
```

**Deploy** :

```bash
kubectl apply -f gauzian_back/k8s/front-deployment.yaml
kubectl get pods -n gauzian-v2 -l app=front
```

---

## Development Workflow

### 1. Créer une Nouvelle Fonctionnalité

**Exemple** : Ajouter bouton "Favoris" sur fichiers.

#### Étape 1 : Créer Composable

`composables/drive/useFavorites.js` :

```javascript
export const useFavorites = () => {
  const favorites = ref([])

  const toggleFavorite = async (fileId) => {
    const { apiUrl } = useApiUrl()
    const response = await fetch(`${apiUrl}/files/${fileId}/favorite`, {
      method: 'POST',
      credentials: 'include',
    })
    if (response.ok) {
      // Mettre à jour state local
      if (favorites.value.includes(fileId)) {
        favorites.value = favorites.value.filter(id => id !== fileId)
      } else {
        favorites.value.push(fileId)
      }
    }
  }

  return { favorites, toggleFavorite }
}
```

#### Étape 2 : Utiliser dans Component

`components/FileItem.vue` :

```vue
<script setup>
const props = defineProps(['file'])
const { toggleFavorite } = useFavorites()
</script>

<template>
  <div class="file-item">
    <button @click="toggleFavorite(file.id)">⭐</button>
    <!-- Reste du template -->
  </div>
</template>
```

---

### 2. Tester Crypto Localement

Utiliser `/info` page pour tests :

```vue
<script setup>
import { encrypt, decrypt } from '~/utils/crypto'

const testCrypto = async () => {
  const plaintext = 'Hello GAUZIAN!'
  const key = await generateAESKey()

  const encrypted = await encrypt(plaintext, key)
  console.log('Encrypted:', encrypted)

  const decrypted = await decrypt(encrypted, key)
  console.log('Decrypted:', decrypted)

  console.assert(decrypted === plaintext, 'Crypto test failed!')
}
</script>
```

---

## Troubleshooting

### 1. Erreur "Network Error" lors requêtes API

**Symptôme** : `fetch` échoue avec erreur réseau.

**Causes possibles** :
- Backend API non démarré
- URL API incorrecte dans `.env`
- CORS mal configuré

**Solutions** :

```bash
# Vérifier backend en cours
curl http://localhost:8080/health/ready

# Vérifier NUXT_PUBLIC_API_URL
echo $NUXT_PUBLIC_API_URL

# Tester CORS
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://localhost:8080/auth/login
```

---

### 2. Clés Crypto Perdues (IndexedDB vide)

**Symptôme** : Impossible de déchiffrer fichiers après refresh.

**Cause** : IndexedDB cleared (navigation privée, clear cache).

**Solution** :
- En développement : Re-login (récupère `encrypted_private_key` depuis serveur)
- En production : **PERTE DÉFINITIVE** si clé privée perdue (E2EE by design)

**Prévention** :
- Implémenter "Export Private Key" (backup manuel utilisateur)
- Implémenter "Recovery Key" (déjà en DB, à activer dans UI)

---

### 3. Upload Échoue sur Gros Fichiers

**Symptôme** : Upload timeout ou erreur mémoire.

**Cause** : Chunks trop gros ou trop de chunks concurrents.

**Solution** :

```javascript
// useFileActions.js
const CHUNK_SIZE = 5 * 1024 * 1024  // 5MB (réduire si problème)
const MAX_CONCURRENT_UPLOADS = 3    // Limiter concurrence
```

---

### 4. Agenda Events Vides

**Symptôme** : Événements ne s'affichent pas après création.

**Debug** :

```javascript
// composables/agenda/useEvents.js
const createEvent = async (eventData) => {
  console.log('Creating event:', eventData)

  const encrypted = await encryptEventData(eventData)
  console.log('Encrypted event:', encrypted)

  const response = await fetch(`${apiUrl}/agenda/events`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypted),
  })

  console.log('Response:', await response.json())
}
```

**Vérifier** :
- `encrypted_data_key` bien généré
- Champs chiffrés correctement
- Backend retourne 201 Created

---

## Security

### Bonnes Pratiques

✅ **TOUJOURS faire** :
- Chiffrer données sensibles avant envoi au serveur
- Utiliser `credentials: 'include'` pour requêtes authentifiées
- Valider input utilisateur (XSS prevention)
- Générer clés crypto avec Web Crypto API (pas de libs externes)
- Stocker clés dans IndexedDB avec `extractable: false`

❌ **NE JAMAIS faire** :
- Logger clés privées ou clés déchiffrées
- Stocker clés en clair dans localStorage
- Envoyer données en clair au serveur
- Réutiliser IV (Initialization Vector) pour AES-GCM
- Implémenter sa propre crypto (utiliser Web Crypto API)

---

### Issues de Sécurité Connues

**⚠️ À corriger avant production** :

1. **PBKDF2 iterations trop faible** :
   ```typescript
   // crypto.ts - AVANT
   const iterations = 100_000  // ❌ Trop faible

   // APRÈS
   const iterations = 310_000  // ✅ OWASP 2023 recommendation
   ```

2. **Logs sensibles** :
   ```javascript
   // info.vue, crypto.ts - Supprimer tous les console.log avec :
   // - Clés privées
   // - Données déchiffrées
   // - Passwords
   ```

3. **COOKIE_SECURE manquant** :
   ```javascript
   // Backend doit set cookie avec Secure flag en production
   // Vérifier backend config : COOKIE_SECURE=true
   ```

4. **Pas de CSRF protection** :
   ```javascript
   // Implémenter CSRF token pour requêtes state-changing (POST/PUT/DELETE)
   // Ajouter header : X-CSRF-Token
   ```

---

### Audit Crypto

**Checklist** :

- [ ] RSA-4096 (pas RSA-2048)
- [ ] AES-256-GCM (pas AES-CBC)
- [ ] PBKDF2 ≥ 310k iterations
- [ ] IV aléatoire unique par chiffrement
- [ ] Clés IndexedDB non-extractable
- [ ] Pas de console.log avec clés/passwords
- [ ] HTTPS en production (TLS 1.3)
- [ ] Cookies HttpOnly + Secure + SameSite=Strict

---

## Ressources

- **Nuxt Docs** : https://nuxt.com/docs
- **Vue 3 Docs** : https://vuejs.org/guide/introduction.html
- **Web Crypto API** : https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- **IndexedDB** : https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **OWASP Crypto** : https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html

---

**Auteur** : GAUZIAN Development Team
**Dernière mise à jour** : 2026-02-11
**Version** : Nuxt 4.x / Vue 3.x
