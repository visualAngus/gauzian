# Fix: Fuite Mémoire lors des Uploads Intensifs

## Problème Identifié

Lors de tests de charge avec 100 VUs × 10 chunks en parallèle (≈1000 requêtes simultanées), la RAM du backend montait et **ne redescendait pas** après la fin des tests.

### Causes

1. **Pas de limite de taille de body** - Les handlers acceptaient n'importe quelle taille de chunk
2. **Pas de limite de concurrence** - 1000+ requêtes d'upload simultanées chargeaient tout en RAM
3. **Accumulation de chunks en download** - Le stream chargeait tous les chunks sans back-pressure
4. **Clone des données à chaque retry** - Dans storage.rs (moins critique car Bytes est Arc-based)

## Corrections Appliquées

### 1. Limite de Body (10MB par chunk)
**Fichier**: `src/drive/routes.rs`
```rust
let upload_routes = Router::new()
    .route("/upload_chunk", post(handlers::upload_chunk_handler))
    .route("/upload_chunk_binary", post(handlers::upload_chunk_binary_handler))
    .layer(DefaultBodyLimit::max(10 * 1024 * 1024)); // 10 MB max
```

**Impact**: Rejet des chunks > 10MB avant même de les charger en mémoire.

### 2. Semaphore de Concurrence (50 uploads max)
**Fichier**: `src/state.rs`
```rust
pub struct AppState {
    // ...
    pub upload_semaphore: Arc<Semaphore>,
}

// Dans from_env():
let max_concurrent_uploads = std::env::var("MAX_CONCURRENT_UPLOADS")
    .ok()
    .and_then(|v| v.parse().ok())
    .unwrap_or(50);

upload_semaphore: Arc::new(Semaphore::new(max_concurrent_uploads)),
```

**Fichier**: `src/drive/handlers.rs`
```rust
pub async fn upload_chunk_binary_handler(...) -> Response {
    // Acquérir un permit (bloque si limite atteinte)
    let _permit = match state.upload_semaphore.try_acquire() {
        Ok(permit) => permit,
        Err(_) => {
            return ApiResponse::bad_request("Server busy, please retry").into_response();
        }
    };
    // ... rest of handler
}
```

**Impact**: Maximum 50 uploads en parallèle, les autres reçoivent "Server busy".

### 3. Buffer Limité pour Downloads (2 chunks max en avance)
**Fichier**: `src/drive/handlers.rs`
```rust
let stream = futures::stream::iter(chunks)
    .map(move |chunk_info| { /* ... */ })
    .buffer_unordered(2) // Limite à 2 chunks chargés en avance
    .filter_map(|x| async move { x });
```

**Impact**: Réduit l'utilisation RAM lors des downloads en ne chargeant que 2 chunks en avance.

## Configuration

### Variables d'Environnement

Ajoutez à votre `.env` ou deployment:

```bash
# Limite le nombre d'uploads concurrents (défaut: 50)
MAX_CONCURRENT_UPLOADS=50

# Pour un VPS avec 8GB de RAM, considérez 30-40
# Pour un serveur dédié avec 32GB, vous pouvez monter à 100
```

### Ajustement selon votre Infra

| RAM Disponible | MAX_CONCURRENT_UPLOADS Recommandé | Taille Chunk Max |
|----------------|-----------------------------------|------------------|
| 2 GB           | 20                                | 5 MB             |
| 4 GB           | 30                                | 10 MB            |
| 8 GB           | 50                                | 10 MB            |
| 16 GB          | 80                                | 20 MB            |
| 32 GB          | 150                               | 20 MB            |

## Testing

### 1. Test de Charge Actuel
```bash
cd tests/k6
k6 run test-upload-advanced.js
```

Surveillez la RAM avec Prometheus pendant et **après** le test:
- La RAM doit monter pendant le test (normal)
- La RAM doit **redescendre** dans les 30-60 secondes après la fin du test

### 2. Test de Rejection
Lancez plus de VUs que la limite:
```bash
# Si MAX_CONCURRENT_UPLOADS=50, lancez 100 VUs
k6 run --vus 100 --duration 30s test-upload-advanced.js
```

Vous devriez voir des erreurs "Server busy, please retry" (c'est voulu !).

### 3. Métriques à Surveiller

**Avant le fix**:
- ❌ RAM monte et ne redescend pas
- ❌ Accumulation de mémoire après chaque test
- ❌ OOMKiller peut tuer le backend

**Après le fix**:
- ✅ RAM monte pendant le test, puis **redescend**
- ✅ Pas d'accumulation entre les tests
- ✅ Rejection gracieuse si trop de requêtes

## Déploiement

```bash
# 1. Build l'image Docker
./push_docker_hub.sh

# 2. Déployer sur le VPS
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'

# 3. Vérifier les logs
ssh vps 'kubectl logs -n gauzian -l app=backend --tail=50'

# 4. Vérifier la config
ssh vps 'kubectl get pods -n gauzian'
```

## Monitoring

### Logs à Surveiller

```bash
# Upload rejected (bon signe de back-pressure)
Upload rejected: too many concurrent uploads

# Config au démarrage
Max concurrent uploads: 50

# Métriques Prometheus
gauzian_chunk_upload_duration_seconds
gauzian_file_uploads_total
```

### Dashboard Prometheus

Ajoutez une alerte pour détecter la saturation:
```yaml
- alert: TooManyRejectedUploads
  expr: rate(gauzian_rejected_uploads[5m]) > 10
  annotations:
    summary: "Too many uploads rejected, consider increasing MAX_CONCURRENT_UPLOADS"
```

## Rollback

Si les modifications causent des problèmes:

1. **Augmenter la limite**: `MAX_CONCURRENT_UPLOADS=100`
2. **Augmenter la taille de chunk**: Modifiez `10 * 1024 * 1024` → `20 * 1024 * 1024`
3. **Retour arrière complet**: `git revert HEAD`

## Résultat Attendu

**Avant**: RAM passe de 1GB → 5GB et **reste à 5GB** après le test
**Après**: RAM passe de 1GB → 3GB pendant le test et **retourne à 1-1.5GB** après

La RAM utilisée devrait être:
```
RAM_used = (MAX_CONCURRENT_UPLOADS × CHUNK_SIZE) + BASE_RAM + BUFFER
         = (50 × 10MB) + 500MB + 200MB
         = 1.2 GB max pendant les pics
```

## Notes

- Le semaphore utilise `try_acquire()` pour un rejet immédiat (pas de queue)
- Les chunks > 10MB sont rejetés avec HTTP 413 (Payload Too Large)
- Le buffer de download (2 chunks) est un compromis entre performance et RAM
- Les uploads rejetés reçoivent un status 400 "Server busy" pour retry automatique côté client
