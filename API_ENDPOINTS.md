# Endpoints API - Agenda GAUZIAN

Ce document liste tous les endpoints API nécessaires pour l'agenda. Tous les appels doivent être authentifiés (credentials: 'include').

## Base URL
```
/api/agenda
```

---

## Événements

### GET /api/agenda/events
Récupérer les événements de l'utilisateur connecté dans un intervalle donné

**Query Parameters:**
- `startDayId` (required) - Début de l'intervalle (nombre de jours depuis le 1er janvier 2020)
- `endDayId` (required) - Fin de l'intervalle (nombre de jours depuis le 1er janvier 2020)

**Example:**
```
GET /api/agenda/events?startDayId=2200&endDayId=2230
```

**Response:**
```json
[
  {
    "id": 1,
    "title": "Meeting with Team",
    "description": "Discuss Q1 goals",
    "dayId": 2,
    "startDayId": 2,
    "endDayId": 2,
    "startHour": 10,
    "endHour": 11,
    "isAllDay": false,
    "isMultiDay": false,
    "category": "meeting",
    "color": "blue",
    "createdAt": "2026-02-01T10:00:00Z",
    "updatedAt": "2026-02-01T10:00:00Z"
  }
]
```

**Note:** Retourne uniquement les événements où `startDayId` ou `endDayId` intersecte avec l'intervalle demandé. Pour les événements multi-jours, l'événement est inclus si une partie chevauche l'intervalle.

**Fichier:** `gauzian_front/app/composables/agenda/useEvents.js:12`

---

### POST /api/agenda/events
Créer un nouvel événement

**Request Body:**
```json
{
  "title": "Nouvel événement",
  "description": "Description optionnelle",
  "dayId": 2,
  "startDayId": 2,
  "endDayId": 3,
  "startHour": 10,
  "endHour": 11,
  "isAllDay": false,
  "isMultiDay": true,
  "category": "meeting",
  "color": "blue"
}
```

**Response:**
```json
{
  "id": 123,
  "title": "Nouvel événement",
  "description": "Description optionnelle",
  "dayId": 2,
  "startDayId": 2,
  "endDayId": 3,
  "startHour": 10,
  "endHour": 11,
  "isAllDay": false,
  "isMultiDay": true,
  "category": "meeting",
  "color": "blue",
  "createdAt": "2026-02-01T10:00:00Z",
  "updatedAt": "2026-02-01T10:00:00Z"
}
```

**Fichier:** `gauzian_front/app/composables/agenda/useEvents.js:116`

---

### PUT /api/agenda/events/:id
Mettre à jour un événement existant

**Request Body:**
```json
{
  "title": "Titre modifié",
  "description": "Nouvelle description",
  "startHour": 11,
  "endHour": 12
}
```

**Response:**
```json
{
  "id": 123,
  "title": "Titre modifié",
  "description": "Nouvelle description",
  "dayId": 2,
  "startDayId": 2,
  "endDayId": 2,
  "startHour": 11,
  "endHour": 12,
  "isAllDay": false,
  "isMultiDay": false,
  "category": "meeting",
  "color": "blue",
  "createdAt": "2026-02-01T10:00:00Z",
  "updatedAt": "2026-02-01T11:00:00Z"
}
```

**Fichier:** `gauzian_front/app/composables/agenda/useEvents.js:160`

---

### DELETE /api/agenda/events/:id
Supprimer un événement

**Response:**
```json
{
  "success": true,
  "message": "Événement supprimé"
}
```

**Fichier:** `gauzian_front/app/composables/agenda/useEvents.js:173`

---

## Catégories

### GET /api/agenda/categories
Récupérer toutes les catégories de l'utilisateur (prédéfinies + personnalisées)

**Response:**
```json
[
  {
    "id": "meeting",
    "name": "Réunion",
    "color": "blue",
    "icon": "RE",
    "description": "Meetings et rendez-vous professionnels",
    "custom": false
  },
  {
    "id": "custom_1234567890",
    "name": "Ma catégorie",
    "color": "pink",
    "icon": "MC",
    "description": "Ma catégorie personnalisée",
    "custom": true
  }
]
```

**Fichier:** `gauzian_front/app/composables/agenda/useCategories.js:3`

---

### POST /api/agenda/categories
Créer une nouvelle catégorie personnalisée

**Request Body:**
```json
{
  "name": "Ma nouvelle catégorie",
  "color": "pink",
  "icon": "MC",
  "description": "Description de ma catégorie"
}
```

**Response:**
```json
{
  "id": "custom_1234567890",
  "name": "Ma nouvelle catégorie",
  "color": "pink",
  "icon": "MC",
  "description": "Description de ma catégorie",
  "custom": true
}
```

**Fichier:** `gauzian_front/app/composables/agenda/useCategories.js:168`

---

### PUT /api/agenda/categories/:id
Mettre à jour une catégorie

**Request Body:**
```json
{
  "name": "Nom modifié",
  "color": "purple",
  "icon": "NM",
  "description": "Nouvelle description"
}
```

**Response:**
```json
{
  "id": "custom_1234567890",
  "name": "Nom modifié",
  "color": "purple",
  "icon": "NM",
  "description": "Nouvelle description",
  "custom": true
}
```

**Fichier:** `gauzian_front/app/composables/agenda/useCategories.js:194`

---

### DELETE /api/agenda/categories/:id
Supprimer une catégorie

**Response:**
```json
{
  "success": true,
  "message": "Catégorie supprimée"
}
```

**Note:** Les événements utilisant cette catégorie devraient être migrés vers la catégorie "other"

**Fichier:** `gauzian_front/app/composables/agenda/useCategories.js:183`

---

## Notes d'implémentation

### Authentication
Tous les endpoints nécessitent une authentification. Les requêtes doivent inclure:
```javascript
{
  credentials: 'include', // Pour les cookies
  headers: {
    'Content-Type': 'application/json'
  }
}
```

### dayId
Le `dayId` est calculé comme le nombre de jours depuis le 1er janvier 2020 (epoch).
Voir `gauzian_front/app/composables/agenda/useNavigation.js:288` pour la conversion.

### Intervalle de chargement
**Important:** Toujours spécifier `start_day_id` et `end_day_id` lors du chargement des événements pour limiter la quantité de données transférées.

**Recommandations:**
- Vue mensuelle : charger le mois courant (ex: `start_day_id=2200`, `end_day_id=2230`)
- Vue hebdomadaire : charger la semaine courante ± 1 semaine (tampon)
- Vue journalière : charger le jour courant ± 3 jours (tampon)

**Exemple de calcul:**
```javascript
// Charger le mois de février 2026
const startDayId = dayIdFromDate(new Date('2026-02-01')); // 2222
const endDayId = dayIdFromDate(new Date('2026-02-28'));   // 2249

const response = await fetch(`/api/agenda/events?startDayId=${startDayId}&endDayId=${endDayId}`, {
    credentials: 'include'
});
```

### Événements multi-jours
- `isMultiDay: true` quand `startDayId !== endDayId`
- Les événements multi-jours sont automatiquement segmentés côté front
- Chaque segment couvrant 0h-24h devient automatiquement `isAllDay: true`

### Couleurs disponibles
- `blue`, `green`, `red`, `orange`, `purple`, `teal`, `pink`, `gray`

### Catégories par défaut
Les catégories suivantes doivent être présentes par défaut pour chaque utilisateur:
- `meeting` (Réunion) - blue
- `project` (Projet) - green
- `deadline` (Deadline) - orange
- `urgent` (Urgent) - red
- `personal` (Personnel) - purple
- `learning` (Formation) - teal
- `special` (Spécial) - pink
- `blocked` (Bloqué) - gray
- `other` (Autre) - blue

### Gestion d'erreurs
Tous les endpoints doivent retourner des erreurs HTTP appropriées:
- `400` - Bad Request (données invalides)
- `401` - Unauthorized (non authentifié)
- `403` - Forbidden (pas les droits)
- `404` - Not Found (ressource introuvable)
- `500` - Internal Server Error

Format des erreurs:
```json
{
  "error": "Message d'erreur descriptif"
}
```
