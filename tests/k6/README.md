# Tests K6 - GAUZIAN

Ce dossier contient les tests de charge pour le backend GAUZIAN.

## Tests Disponibles

### 1. `test-realistic-usage.js` ⭐ **Recommandé pour tester la stabilité**

**But**: Simule des utilisateurs réels qui utilisent l'application normalement

**Profil**:
- 5 → 15 → 30 utilisateurs simultanés (monte progressivement)
- Durée: 10 minutes
- Chaque utilisateur:
  - S'inscrit et se connecte
  - Crée 1-2 dossiers
  - Upload 2-4 fichiers (2-4 chunks chacun, soit 2-4 MB)
  - Liste ses fichiers
  - Télécharge parfois un fichier
  - Temps de réflexion entre actions (1-5s)

**Charge générée**:
- ~150-300 requêtes/minute au pic
- Upload total: ~200-400 MB sur 10 minutes
- Comportement réaliste avec pauses

**Utilisation**:
```bash
k6 run test-realistic-usage.js
```

**Quand l'utiliser**:
- ✅ Test de stabilité long terme
- ✅ Vérifier que la RAM ne leak pas
- ✅ Tester avec une charge continue réaliste
- ✅ Détecter les problèmes de performance utilisateur

---

### 2. `test-upload-advanced.js` 💣 **Test de stress intensif**

**But**: Stresser le serveur avec des uploads massifs en parallèle

**Profil**:
- Monte jusqu'à 100 utilisateurs simultanés
- Durée: 6 minutes
- Chaque utilisateur upload 10 chunks EN PARALLÈLE (très agressif)
- Scénarios mixtes: upload, download, création de dossiers

**Charge générée**:
- ~1000+ requêtes/seconde au pic
- Upload massif en parallèle
- Test les limites du serveur

**Utilisation**:
```bash
k6 run test-upload-advanced.js
```

**Quand l'utiliser**:
- ✅ Trouver la limite maximale du serveur
- ✅ Tester la résistance aux pics de charge
- ✅ Identifier les goulots d'étranglement
- ⚠️ Attention: Peut faire crasher le serveur si mal configuré

---

### 3. `test-complete-stress.js` ⚡ **Stress complet**

**But**: Test de charge complet sur tous les endpoints

**Profil**:
- Monte jusqu'à 50 utilisateurs
- Durée: 5 minutes
- Teste tous les endpoints (auth, drive, folders, etc.)

**Utilisation**:
```bash
k6 run test-complete-stress.js
```

---

## Recommandations d'Usage

### Pour le développement quotidien
```bash
k6 run test-realistic-usage.js --duration 3m --vus 10
```
Test court avec peu d'utilisateurs pour vérifier que tout fonctionne.

### Pour tester la stabilité mémoire
```bash
k6 run test-realistic-usage.js
```
Lance le test complet de 10 minutes et surveille la RAM via Prometheus.

### Pour tester les limites
```bash
k6 run test-upload-advanced.js
```
⚠️ Attention: Peut saturer le serveur. À utiliser avec prudence.

### Pour tester après un déploiement
```bash
k6 run test-realistic-usage.js --duration 5m
```
Test de 5 minutes pour vérifier que le déploiement n'a pas cassé quelque chose.

---

## Métriques à Surveiller

Pendant les tests, surveiller via Prometheus:

### RAM Backend
```
container_memory_usage_bytes{pod=~"backend.*"}
```
**Attendu**:
- Avant test: ~60 Mi
- Pendant test: ~150-300 Mi (pic)
- Après test: Retour à ~60-80 Mi en 2-5 minutes

### Uploads/Downloads
```
gauzian_file_uploads_total
gauzian_file_downloads_total
```

### Connexions actives
```
gauzian_http_connections_active
```

### Durée des requêtes
```
gauzian_http_request_duration_seconds
```

---

## Interprétation des Résultats

### ✅ Succès
- Moins de 5% d'erreurs HTTP
- P95 latence < 3s
- RAM redescend après le test
- Aucun crash/restart de pods

### ⚠️ Attention
- 5-10% d'erreurs
- P95 latence > 3s
- RAM monte mais redescend lentement
- Quelques timeouts

### ❌ Échec
- Plus de 10% d'erreurs
- Crashes/restarts de pods
- RAM ne redescend pas (leak)
- Timeouts fréquents

---

## Configuration K8s Recommandée

Pour supporter `test-realistic-usage.js` (30 users max):
```yaml
resources:
  requests:
    memory: 512Mi
    cpu: 100m
  limits:
    memory: 1Gi
    cpu: 500m

# HPA
minReplicas: 2
maxReplicas: 5
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80
```

Pour supporter `test-upload-advanced.js` (100 users max):
```yaml
resources:
  requests:
    memory: 1Gi
    cpu: 200m
  limits:
    memory: 2Gi
    cpu: 1000m

# HPA
minReplicas: 3
maxReplicas: 10
```

---

## Variables d'Environnement Backend

Pour optimiser les performances pendant les tests:

```bash
# Limite uploads concurrents (ajuster selon RAM)
MAX_CONCURRENT_UPLOADS=30  # Pour test réaliste
MAX_CONCURRENT_UPLOADS=50  # Pour test stress

# Logs (réduire en production)
RUST_LOG=gauzian_back=info  # Moins verbeux
```

---

## Troubleshooting

### "Server busy, please retry"
✅ **Normal** - Le semaphore limite les uploads concurrents
- Augmenter `MAX_CONCURRENT_UPLOADS` si trop fréquent
- Ou réduire le nombre de VUs dans le test

### RAM monte et ne redescend pas
❌ **Memory leak** - Vérifier:
1. Connexions Redis (ConnectionManager actif ?)
2. Connexions DB (pool configuré ?)
3. Buffers S3 (données libérées après upload ?)

### Pods crashent (OOMKilled)
❌ **Pas assez de RAM** - Solutions:
1. Augmenter `resources.limits.memory`
2. Réduire `MAX_CONCURRENT_UPLOADS`
3. Augmenter `minReplicas` (HPA)

### Trop de 503 Service Unavailable
⚠️ **Serveur surchargé** - Solutions:
1. Augmenter les replicas (HPA)
2. Augmenter les ressources CPU
3. Réduire le nombre de VUs dans le test

---

## Exemples de Commandes

### Test rapide de fumée (1 minute)
```bash
k6 run --duration 1m --vus 5 test-realistic-usage.js
```

### Test de stabilité nocturne (30 minutes)
```bash
k6 run --duration 30m --vus 20 test-realistic-usage.js > test-results.txt
```

### Test avec seuils personnalisés
```bash
k6 run \
  --duration 5m \
  --vus 15 \
  --threshold 'http_req_duration{p(95)}<2000' \
  --threshold 'http_req_failed<0.01' \
  test-realistic-usage.js
```

### Test avec output JSON (pour analyse)
```bash
k6 run --out json=results.json test-realistic-usage.js
```

---

## Ressources

- [Documentation K6](https://k6.io/docs/)
- [Métriques Prometheus](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Guide K8s HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
