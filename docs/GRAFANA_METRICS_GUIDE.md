# Guide Complet des Métriques Grafana - GAUZIAN

**Date**: 2026-02-15
**Usage**: Référence pour créer des dashboards Grafana avec Prometheus

Ce guide liste **TOUTES** les métriques disponibles pour monitoring GAUZIAN :
- ✅ Métriques custom Rust (gauzian_back)
- ✅ Métriques Node Exporter (système)
- ✅ Métriques Kubernetes (pods, containers)
- ✅ Exemples de requêtes PromQL pour chaque métrique

---

## Table des Matières

1. [Métriques Custom Rust (Application)](#1-métriques-custom-rust-application)
2. [Métriques Node Exporter (Système)](#2-métriques-node-exporter-système)
3. [Métriques Kubernetes](#3-métriques-kubernetes)
4. [Templates de Panels Grafana](#4-templates-de-panels-grafana)
5. [Dashboards Recommandés](#5-dashboards-recommandés)

---

## 1. Métriques Custom Rust (Application)

Ces métriques sont exposées par `gauzian_back` sur `/metrics` (bloqué publiquement, accessible via Prometheus scraping interne).

### 📊 HTTP / Requêtes

#### `http_requests_total` (Counter)
**Description**: Nombre total de requêtes HTTP par endpoint, méthode et status code.

**Unité Grafana**: `reqps` (requests per second) ou `short` (nombre)

**Thresholds**: N/A (métrique brute, utiliser taux d'erreur plutôt)

**Labels**:
- `method` : GET, POST, PUT, DELETE, etc.
- `endpoint` : `/auth/login`, `/drive/file/:id`, `/agenda/events`, etc.
- `status` : 200, 401, 404, 500, etc.

**Requêtes PromQL**:
```promql
# Rate de requêtes par seconde (global)
rate(http_requests_total[5m])

# Rate par endpoint
sum(rate(http_requests_total[5m])) by (endpoint)

# Taux d'erreurs (4xx + 5xx)
sum(rate(http_requests_total{status=~"4..|5.."}[5m])) by (endpoint)

# Top 5 endpoints les plus utilisés
topk(5, sum(rate(http_requests_total[5m])) by (endpoint))

# Success rate (2xx + 3xx)
sum(rate(http_requests_total{status=~"2..|3.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
```

---

#### `http_request_duration_seconds` (Histogram)
**Description**: Distribution de la durée des requêtes HTTP (latence).

**Unité Grafana**: `s` (seconds) ou `ms` (milliseconds) - multiplier par 1000 pour ms

**Thresholds** (P95 en ms):
- 🟢 Vert : < 100ms (excellent)
- 🟠 Orange : 100-500ms (acceptable)
- 🔴 Rouge : > 500ms (critique)

**Labels**:
- `method` : GET, POST, etc.
- `endpoint` : route normalisée

**Buckets**: 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0 secondes

**Requêtes PromQL**:
```promql
# Latence P50 (médiane) par endpoint
histogram_quantile(0.5, rate(http_request_duration_seconds_bucket[5m]))

# Latence P95 (95e percentile) - SLA critique
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Latence P99 (worst case)
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Latence moyenne par endpoint
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Top 5 endpoints les plus lents (P95)
topk(5, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le)))
```

---

#### `http_connections_active` (Gauge)
**Description**: Nombre de connexions HTTP actuellement actives (en cours de traitement).

**Unité Grafana**: `short` (nombre entier)

**Thresholds**:
- 🟢 Vert : < 50 (normal)
- 🟠 Orange : 50-100 (charge élevée)
- 🔴 Rouge : > 100 (saturation)

**Requêtes PromQL**:
```promql
# Connexions actives en temps réel
http_connections_active

# Moyenne sur 5 minutes
avg_over_time(http_connections_active[5m])

# Max sur 1 heure (pic de charge)
max_over_time(http_connections_active[1h])
```

---

### 📁 Fichiers / Uploads

#### `file_uploads_total` (Counter)
**Description**: Nombre total d'uploads de fichiers.

**Unité Grafana**: `short` (nombre) ou `ops` (operations per second avec rate())

**Thresholds** (taux de succès en %):
- 🟢 Vert : > 95% (excellent)
- 🟠 Orange : 90-95% (attention)
- 🔴 Rouge : < 90% (critique)

**Labels**:
- `status` : `success`, `failed`, `aborted`

**Requêtes PromQL**:
```promql
# Rate d'uploads par seconde
rate(file_uploads_total[5m])

# Total uploads réussis (compteur brut)
file_uploads_total{status="success"}

# Taux de succès des uploads
rate(file_uploads_total{status="success"}[5m]) / rate(file_uploads_total[5m]) * 100

# Nombre d'échecs d'upload sur 1h
increase(file_uploads_total{status="failed"}[1h])
```

---

#### `file_downloads_total` (Counter)
**Description**: Nombre total de downloads de fichiers.

**Unité Grafana**: `short` (nombre) ou `ops` (operations per second avec rate())

**Thresholds** (taux de succès en %):
- 🟢 Vert : > 98% (excellent)
- 🟠 Orange : 95-98% (attention)
- 🔴 Rouge : < 95% (critique)

**Labels**:
- `status` : `success`, `failed`

**Requêtes PromQL**:
```promql
# Rate de downloads par seconde
rate(file_downloads_total[5m])

# Total downloads réussis aujourd'hui
increase(file_downloads_total{status="success"}[24h])

# Ratio upload/download
rate(file_uploads_total{status="success"}[5m]) / rate(file_downloads_total{status="success"}[5m])
```

---

#### `file_upload_bytes_total` (Counter)
**Description**: Taille totale en bytes des fichiers uploadés.

**Unité Grafana**: `bytes` (auto-converti en KB/MB/GB) ou `Bps` (bytes per second avec rate())

**Thresholds** (bandwidth en MBps):
- 🟢 Vert : > 10 MBps (bon débit)
- 🟠 Orange : 5-10 MBps (moyen)
- 🔴 Rouge : < 5 MBps (lent - vérifier réseau/S3)

**Labels**:
- `status` : `success`, `failed`

**Requêtes PromQL**:
```promql
# Bande passante upload (bytes/sec) → convertir en MB/s
rate(file_upload_bytes_total{status="success"}[5m]) / 1024 / 1024

# Total data uploadée aujourd'hui (en GB)
increase(file_upload_bytes_total{status="success"}[24h]) / 1024 / 1024 / 1024

# Taille moyenne d'un fichier uploadé
rate(file_upload_bytes_total{status="success"}[5m]) / rate(file_uploads_total{status="success"}[5m])
```

---

#### `chunk_upload_duration_seconds` (Histogram)
**Description**: Durée d'upload des chunks individuels (5MB typiquement).

**Unité Grafana**: `s` (seconds) ou `ms` (milliseconds)

**Thresholds** (P95 en secondes):
- 🟢 Vert : < 2s (excellent)
- 🟠 Orange : 2-5s (acceptable)
- 🔴 Rouge : > 5s (lent - vérifier S3/réseau)

**Labels**:
- `status` : `success`, `failed`

**Buckets**: 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0 secondes

**Requêtes PromQL**:
```promql
# Latence P95 des uploads de chunks
histogram_quantile(0.95, rate(chunk_upload_duration_seconds_bucket[5m]))

# Durée moyenne d'upload d'un chunk
rate(chunk_upload_duration_seconds_sum[5m]) / rate(chunk_upload_duration_seconds_count[5m])

# Taux de chunks uploadés avec succès
rate(chunk_upload_duration_seconds_count{status="success"}[5m]) / rate(chunk_upload_duration_seconds_count[5m]) * 100
```

---

#### `chunk_download_duration_seconds` (Histogram)
**Description**: Durée de download des chunks individuels.

**Unité Grafana**: `s` (seconds) ou `ms` (milliseconds)

**Thresholds** (P95 en secondes):
- 🟢 Vert : < 1s (excellent)
- 🟠 Orange : 1-3s (acceptable)
- 🔴 Rouge : > 3s (lent - vérifier S3/réseau)

**Labels**:
- `status` : `success`, `failed`

**Requêtes PromQL**:
```promql
# Latence P95 des downloads de chunks
histogram_quantile(0.95, rate(chunk_download_duration_seconds_bucket[5m]))

# Comparaison upload vs download (latence)
histogram_quantile(0.95, rate(chunk_upload_duration_seconds_bucket[5m])) - histogram_quantile(0.95, rate(chunk_download_duration_seconds_bucket[5m]))
```

---

### 🔐 Authentification

#### `auth_attempts_total` (Counter)
**Description**: Nombre de tentatives d'authentification.

**Unité Grafana**: `short` (nombre) ou `ops` (operations per second)

**Thresholds** (taux d'échec login en %):
- 🟢 Vert : < 5% (normal)
- 🟠 Orange : 5-20% (surveillance)
- 🔴 Rouge : > 20% (possible bruteforce - alerter)

**Labels**:
- `type` : `login`, `register`, `autologin`
- `status` : `success`, `failed`

**Requêtes PromQL**:
```promql
# Rate de logins par seconde
rate(auth_attempts_total{type="login"}[5m])

# Taux d'échec de login (bruteforce detection)
rate(auth_attempts_total{type="login", status="failed"}[5m]) / rate(auth_attempts_total{type="login"}[5m]) * 100

# Alerte bruteforce : > 50 échecs/minute
sum(rate(auth_attempts_total{type="login", status="failed"}[1m])) > 0.83

# Nombre de registrations réussies aujourd'hui
increase(auth_attempts_total{type="register", status="success"}[24h])
```

---

### 🗄️ Database (PostgreSQL)

#### `db_pool_connections_active` (Gauge)
**Description**: Nombre de connexions DB actuellement actives (en cours d'utilisation).

**Unité Grafana**: `short` (nombre entier)

**Thresholds** (utilisation du pool en %):
- 🟢 Vert : < 70% du max (normal)
- 🟠 Orange : 70-90% du max (charge élevée)
- 🔴 Rouge : > 90% du max (saturation - scale up ou optimiser queries)

**Requêtes PromQL**:
```promql
# Connexions actives
db_pool_connections_active

# Utilisation du pool (%)
(db_pool_connections_active / db_pool_connections_max) * 100

# Alerte : pool saturé
(db_pool_connections_active / db_pool_connections_max) * 100 > 90
```

---

#### `db_pool_connections_idle` (Gauge)
**Description**: Nombre de connexions DB idle (disponibles dans le pool).

**Unité Grafana**: `short` (nombre entier)

**Requêtes PromQL**:
```promql
# Connexions idle
db_pool_connections_idle

# Ratio idle/total
db_pool_connections_idle / db_pool_connections_max
```

---

#### `db_pool_connections_max` (Gauge)
**Description**: Nombre maximum de connexions configurées dans le pool.

**Unité Grafana**: `short` (nombre entier)

**Requêtes PromQL**:
```promql
# Max connexions (constant)
db_pool_connections_max
```

---

#### `db_queries_total` (Counter) - ⚠️ Non Implémenté
**Description**: Nombre total de requêtes DB.

**Status**: ❌ **Non implémenté** (trop invasif - nécessite wrapper 100+ queries)

**Alternative**: Utiliser les métriques pool ci-dessus ou postgres_exporter

**Unité Grafana**: `short` (nombre) ou `qps` (queries per second avec rate())

**Thresholds** (taux d'erreur DB en %):
- 🟢 Vert : < 1% (excellent)
- 🟠 Orange : 1-5% (attention)
- 🔴 Rouge : > 5% (critique - problème DB)

**Labels**:
- `query_type` : `select`, `insert`, `update`, `delete`
- `status` : `success`, `failed`

**Requêtes PromQL**:
```promql
# Rate de requêtes DB par seconde
rate(db_queries_total[5m])

# Répartition par type de requête
sum(rate(db_queries_total[5m])) by (query_type)

# Taux d'erreur DB
rate(db_queries_total{status="failed"}[5m]) / rate(db_queries_total[5m]) * 100

# Ratio lecture/écriture
rate(db_queries_total{query_type="select"}[5m]) / rate(db_queries_total{query_type=~"insert|update|delete"}[5m])
```

---

#### `db_query_duration_seconds` (Histogram) - ⚠️ Non Implémenté
**Description**: Durée des requêtes DB.

**Status**: ❌ **Non implémenté** (trop invasif - nécessite wrapper 100+ queries)

**Alternative**: Utiliser `pg_stat_statements` PostgreSQL ou postgres_exporter

**Unité Grafana**: `s` (seconds) ou `ms` (milliseconds)

**Thresholds** (P95 en ms):
- 🟢 Vert : < 50ms (excellent)
- 🟠 Orange : 50-200ms (acceptable)
- 🔴 Rouge : > 200ms (slow queries - optimiser indexes)

**Labels**:
- `query_type` : `select`, `insert`, `update`, `delete`

**Buckets**: 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0 secondes

**Requêtes PromQL**:
```promql
# Latence P95 des requêtes DB (CRITICAL pour performance)
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))

# Latence par type de requête
histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket[5m])) by (query_type, le))

# Détection de slow queries (> 100ms)
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 0.1
```

---

### 🪣 S3 / MinIO

#### `s3_operation_duration_seconds` (Histogram)
**Description**: Durée des opérations S3 (PUT, GET, DELETE).

**Unité Grafana**: `s` (seconds) ou `ms` (milliseconds)

**Thresholds** (P95 en ms):
- 🟢 Vert : < 500ms (excellent)
- 🟠 Orange : 500ms-2s (acceptable)
- 🔴 Rouge : > 2s (lent - vérifier MinIO/réseau)

**Labels**:
- `operation` : `put`, `get`, `delete`

**Buckets**: 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0 secondes

**Requêtes PromQL**:
```promql
# Latence P95 des opérations S3
histogram_quantile(0.95, rate(s3_operation_duration_seconds_bucket[5m]))

# Latence par type d'opération
histogram_quantile(0.95, sum(rate(s3_operation_duration_seconds_bucket[5m])) by (operation, le))

# Détection de S3 lent (> 1s P95)
histogram_quantile(0.95, rate(s3_operation_duration_seconds_bucket[5m])) > 1.0
```

---

### 🔴 Redis

#### `redis_operations_total` (Counter)
**Description**: Nombre d'opérations Redis.

**Unité Grafana**: `short` (nombre) ou `ops` (operations per second)

**Thresholds** (cache hit rate en %):
- 🟢 Vert : > 90% (excellent)
- 🟠 Orange : 70-90% (acceptable)
- 🔴 Rouge : < 70% (cache inefficace - revoir stratégie)

**Labels**:
- `operation` : `get`, `set`, `delete`
- `status` : `success`, `failed`

**Requêtes PromQL**:
```promql
# Rate d'opérations Redis par seconde
rate(redis_operations_total[5m])

# Cache hit rate (approximation si Redis utilisé pour cache)
rate(redis_operations_total{operation="get", status="success"}[5m]) / rate(redis_operations_total{operation="get"}[5m]) * 100

# Taux d'erreur Redis
rate(redis_operations_total{status="failed"}[5m]) / rate(redis_operations_total[5m]) * 100
```

---

## 2. Métriques Node Exporter (Système)

Node Exporter expose des métriques système Linux. Installé via DaemonSet K8s (un par nœud).

### 🖥️ CPU

#### `node_cpu_seconds_total`
**Description**: Temps CPU cumulé par mode.

**Unité Grafana**: `percent` (0-100) pour usage CPU, `short` pour load average

**Thresholds** (CPU usage en %):
- 🟢 Vert : < 70% (normal)
- 🟠 Orange : 70-90% (charge élevée)
- 🔴 Rouge : > 90% (saturation - scale up)

**Labels**:
- `mode` : `user`, `system`, `idle`, `iowait`, `irq`, `softirq`, etc.
- `cpu` : Numéro du core (0, 1, 2, ...)

**Requêtes PromQL**:
```promql
# Utilisation CPU totale (%)
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Utilisation CPU par core
100 - (rate(node_cpu_seconds_total{mode="idle"}[5m]) * 100)

# CPU en mode user (applications)
rate(node_cpu_seconds_total{mode="user"}[5m]) * 100

# CPU en attente I/O (disk/network)
rate(node_cpu_seconds_total{mode="iowait"}[5m]) * 100

# Load average (1min, 5min, 15min)
node_load1
node_load5
node_load15
```

---

### 🧠 RAM

#### `node_memory_*`
**Description**: Métriques mémoire système.

**Unité Grafana**: `percent` (0-100) pour usage, `bytes` pour quantités absolues

**Thresholds** (RAM usage en %):
- 🟢 Vert : < 80% (normal)
- 🟠 Orange : 80-95% (attention)
- 🔴 Rouge : > 95% (critique - risque OOM)

**Requêtes PromQL**:
```promql
# RAM utilisée (%)
100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))

# RAM disponible (GB)
node_memory_MemAvailable_bytes / 1024 / 1024 / 1024

# RAM totale (GB)
node_memory_MemTotal_bytes / 1024 / 1024 / 1024

# Swap utilisé (%)
100 * (1 - (node_memory_SwapFree_bytes / node_memory_SwapTotal_bytes))

# RAM cache (GB)
node_memory_Cached_bytes / 1024 / 1024 / 1024

# RAM buffers (GB)
node_memory_Buffers_bytes / 1024 / 1024 / 1024
```

---

### 💾 Disk

#### `node_filesystem_*`
**Description**: Métriques filesystems (montages).

**Unité Grafana**: `percent` (0-100) pour usage, `bytes` pour espace disponible/total

**Thresholds** (Disk usage en %):
- 🟢 Vert : < 80% (normal)
- 🟠 Orange : 80-90% (attention - prévoir nettoyage)
- 🔴 Rouge : > 90% (critique - risque saturation)

**Labels**:
- `mountpoint` : `/`, `/var/lib/kubelet`, etc.
- `device` : `/dev/sda1`, etc.

**Requêtes PromQL**:
```promql
# Disk utilisé (%) par mountpoint
100 * (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))

# Disk libre (GB)
node_filesystem_avail_bytes / 1024 / 1024 / 1024

# Alerte disk > 80%
100 * (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) > 80

# Total disk size (GB)
node_filesystem_size_bytes / 1024 / 1024 / 1024
```

---

#### `node_disk_io_*`
**Description**: I/O disque (lectures/écritures).

**Unité Grafana**: `Bps` (bytes per second) ou `iops` (I/O operations per second)

**Thresholds** (I/O latency en ms):
- 🟢 Vert : < 10ms (SSD rapide)
- 🟠 Orange : 10-50ms (acceptable)
- 🔴 Rouge : > 50ms (disk lent - vérifier I/O wait)

**Requêtes PromQL**:
```promql
# Bytes lus par seconde (MB/s)
rate(node_disk_read_bytes_total[5m]) / 1024 / 1024

# Bytes écrits par seconde (MB/s)
rate(node_disk_written_bytes_total[5m]) / 1024 / 1024

# Opérations I/O par seconde
rate(node_disk_reads_completed_total[5m]) + rate(node_disk_writes_completed_total[5m])

# Latence I/O moyenne (ms)
rate(node_disk_read_time_seconds_total[5m]) / rate(node_disk_reads_completed_total[5m]) * 1000
```

---

### 🌐 Network

#### `node_network_*`
**Description**: Métriques réseau par interface.

**Unité Grafana**: `Bps` (bytes per second) ou `pps` (packets per second)

**Thresholds** (network errors/sec):
- 🟢 Vert : 0 errors (parfait)
- 🟠 Orange : 1-10 errors/sec (surveillance)
- 🔴 Rouge : > 10 errors/sec (problème réseau)

**Labels**:
- `device` : `eth0`, `lo`, `cni0`, etc.

**Requêtes PromQL**:
```promql
# Bandwidth receive (MB/s)
rate(node_network_receive_bytes_total{device!~"lo|veth.*"}[5m]) / 1024 / 1024

# Bandwidth transmit (MB/s)
rate(node_network_transmit_bytes_total{device!~"lo|veth.*"}[5m]) / 1024 / 1024

# Total bandwidth (RX + TX)
(rate(node_network_receive_bytes_total{device!~"lo|veth.*"}[5m]) + rate(node_network_transmit_bytes_total{device!~"lo|veth.*"}[5m])) / 1024 / 1024

# Packets dropped (erreurs réseau)
rate(node_network_receive_drop_total[5m]) + rate(node_network_transmit_drop_total[5m])

# Network errors
rate(node_network_receive_errs_total[5m]) + rate(node_network_transmit_errs_total[5m])
```

---

### ⏱️ Uptime

#### `node_time_seconds`
**Description**: Timestamp Unix actuel du nœud.

**Unité Grafana**: `dateTimeAsIso` ou `s` (seconds)

#### `node_boot_time_seconds`
**Description**: Timestamp du dernier boot.

**Unité Grafana**: `dateTimeAsIso` ou `s` (seconds pour uptime)

**Requêtes PromQL**:
```promql
# Uptime (secondes)
node_time_seconds - node_boot_time_seconds

# Uptime (jours)
(node_time_seconds - node_boot_time_seconds) / 86400

# Uptime (format lisible)
# Utiliser fonction "humanizeDuration" dans Grafana
```

---

## 3. Métriques Kubernetes

Ces métriques sont exposées par **metrics-server** K8s (si installé) ou **cAdvisor**.

### 📦 Pods / Containers

#### `container_cpu_usage_seconds_total`
**Description**: CPU utilisé par container.

**Unité Grafana**: `percent` (0-100) avec rate()

**Thresholds** (CPU usage par pod en %):
- 🟢 Vert : < 50% (requests OK)
- 🟠 Orange : 50-80% (proche limits)
- 🔴 Rouge : > 80% (throttling possible - augmenter limits)

**Labels**:
- `namespace` : `gauzian-v2`, `monitoring`, etc.
- `pod` : Nom du pod
- `container` : Nom du container

**Requêtes PromQL**:
```promql
# CPU usage par pod (%)
sum(rate(container_cpu_usage_seconds_total{namespace="gauzian-v2"}[5m])) by (pod) * 100

# CPU usage backend pods
sum(rate(container_cpu_usage_seconds_total{namespace="gauzian-v2", pod=~"backend-.*"}[5m])) * 100

# Top 5 pods consommant le plus de CPU
topk(5, sum(rate(container_cpu_usage_seconds_total{namespace="gauzian-v2"}[5m])) by (pod))
```

---

#### `container_memory_working_set_bytes`
**Description**: RAM utilisée par container (working set).

**Unité Grafana**: `bytes` (auto-converti en MB/GB)

**Thresholds** (RAM usage par pod en %):
- 🟢 Vert : < 70% de limit (normal)
- 🟠 Orange : 70-90% de limit (surveillance)
- 🔴 Rouge : > 90% de limit (risque OOMKilled)

**Requêtes PromQL**:
```promql
# RAM usage par pod (MB)
sum(container_memory_working_set_bytes{namespace="gauzian-v2"}) by (pod) / 1024 / 1024

# RAM usage backend pods (MB)
sum(container_memory_working_set_bytes{namespace="gauzian-v2", pod=~"backend-.*"}) / 1024 / 1024

# Top 5 pods consommant le plus de RAM
topk(5, sum(container_memory_working_set_bytes{namespace="gauzian-v2"}) by (pod))
```

---

#### `kube_pod_status_phase`
**Description**: État des pods (Running, Pending, Failed, etc.).

**Unité Grafana**: `short` (nombre de pods)

**Requêtes PromQL**:
```promql
# Nombre de pods en Running
count(kube_pod_status_phase{namespace="gauzian-v2", phase="Running"})

# Nombre de pods en Failed/CrashLoopBackOff
count(kube_pod_status_phase{namespace="gauzian-v2", phase=~"Failed|Unknown"})

# Pods non-Running (alerte)
count(kube_pod_status_phase{namespace="gauzian-v2", phase!="Running"}) > 0
```

---

#### `kube_pod_container_status_restarts_total`
**Description**: Nombre de restarts de containers.

**Unité Grafana**: `short` (nombre de restarts)

**Thresholds** (restarts sur 1h):
- 🟢 Vert : 0 restarts (stable)
- 🟠 Orange : 1-3 restarts (surveiller logs)
- 🔴 Rouge : > 3 restarts (CrashLoopBackOff - investiguer)

**Requêtes PromQL**:
```promql
# Restarts sur la dernière heure
increase(kube_pod_container_status_restarts_total{namespace="gauzian-v2"}[1h])

# Alerte : pod redémarre trop souvent
rate(kube_pod_container_status_restarts_total{namespace="gauzian-v2"}[15m]) > 0.05
```

---

## 4. Unités Grafana (Référence Complète)

Grafana supporte de nombreuses unités pour formatter correctement les valeurs. Voici les plus utilisées :

### Temps

| Unité | Description | Exemple |
|-------|-------------|---------|
| `s` | Secondes | 1.5s, 60s |
| `ms` | Millisecondes | 150ms, 1000ms |
| `µs` | Microsecondes | 500µs |
| `ns` | Nanosecondes | 1000ns |
| `dtdurations` | Duration (human) | 1h 30m, 2d 3h |
| `dtdurationms` | Duration depuis ms | 90000ms → 1m 30s |

### Data (Bytes)

| Unité | Description | Exemple |
|-------|-------------|---------|
| `bytes` | Bytes (auto SI) | 1KB, 1.5MB, 2GB |
| `decbytes` | Bytes (décimal) | 1000B, 1500000B |
| `kbytes` | Kilobytes | 1024KB |
| `mbytes` | Megabytes | 512MB |
| `gbytes` | Gigabytes | 2GB |

### Data Rate (Throughput)

| Unité | Description | Exemple |
|-------|-------------|---------|
| `Bps` | Bytes per second | 1.5MBps, 100Bps |
| `KBs` | Kilobytes/s | 512KBs |
| `MBs` | Megabytes/s | 10MBs |
| `GBs` | Gigabytes/s | 1GBs |
| `pps` | Packets per second | 1000pps |

### Nombre / Operations

| Unité | Description | Exemple |
|-------|-------------|---------|
| `short` | Nombre formatté | 1K, 1.5M, 2B |
| `none` | Nombre brut | 1234567 |
| `ops` | Operations/sec | 1.5K ops |
| `reqps` | Requests/sec | 500 reqps |
| `qps` | Queries/sec | 1.2K qps |
| `rps` | Reads/sec | 800 rps |
| `wps` | Writes/sec | 200 wps |
| `iops` | I/O ops/sec | 5K iops |

### Pourcentage

| Unité | Description | Exemple |
|-------|-------------|---------|
| `percent` | Pourcent (0-100) | 75%, 99.9% |
| `percentunit` | Pourcent (0-1) | 0.75 → 75% |

### Dates

| Unité | Description | Exemple |
|-------|-------------|---------|
| `dateTimeAsIso` | ISO 8601 | 2026-02-15T14:30:00Z |
| `dateTimeAsUS` | US format | 02/15/2026 2:30 PM |
| `dateTimeFromNow` | Relatif | 2 hours ago |

### Réseau

| Unité | Description | Exemple |
|-------|-------------|---------|
| `bps` | Bits per second | 100Mbps |
| `Bps` | Bytes per second | 12.5MBps |
| `pps` | Packets per second | 1000pps |

### Temperature

| Unité | Description | Exemple |
|-------|-------------|---------|
| `celsius` | Celsius | 45°C |
| `fahrenheit` | Fahrenheit | 113°F |

### Misc

| Unité | Description | Exemple |
|-------|-------------|---------|
| `locale` | Nombre localisé | 1 234 567 (FR) |
| `velocityms` | Velocity m/s | 15m/s |
| `velocitykmh` | Velocity km/h | 54km/h |

---

## 5. Templates de Panels Grafana

### Configuration des Thresholds dans Grafana

Dans Grafana, pour configurer les seuils (thresholds) :

1. **Panel Editor** → Onglet **Thresholds**
2. **Mode** : `Absolute` (valeur absolue) ou `Percentage` (pourcentage)
3. **Ajouter seuils** :
   - Cliquer **"+ Add threshold"**
   - Entrer la valeur
   - Choisir la couleur (Vert/Orange/Rouge)

**Exemple Configuration Latency P95** :
```
Base: Vert
Threshold 1: 100 (Orange)
Threshold 2: 500 (Rouge)
```

**Exemple Configuration CPU Usage** :
```
Base: Vert
Threshold 1: 70 (Orange)
Threshold 2: 90 (Rouge)
```

**Exemple Configuration Error Rate** :
```
Base: Vert
Threshold 1: 1 (Orange)
Threshold 2: 5 (Rouge)
```

---

### Panel Type: **Graph** (Time Series)

#### Request Rate (Requêtes/sec)

```promql
sum(rate(http_requests_total[5m]))
```

**Config**:
- Visualization: Time series
- Y-axis: Requests/sec
- Legend: `{{method}} {{endpoint}}`

---

#### Latency P95 (ms)

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) * 1000
```

**Config**:
- Visualization: Time series
- Unit: `ms` (milliseconds)
- Y-axis: Milliseconds
- **Thresholds**:
  - Base: Vert
  - 100ms: Orange (warning)
  - 500ms: Rouge (critical)

---

#### Error Rate (%)

```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
```

**Config**:
- Visualization: Time series
- Unit: `percent` (0-100)
- Y-axis: Percent (0-100)
- **Thresholds**:
  - Base: Vert
  - 1%: Orange (warning)
  - 5%: Rouge (critical)

---

### Panel Type: **Stat** (Single Value)

#### Total Requests (Today)

```promql
increase(http_requests_total[24h])
```

**Config**:
- Visualization: Stat
- Unit: short (number)
- Color: Green

---

#### Active Connections

```promql
http_connections_active
```

**Config**:
- Visualization: Stat
- Unit: `short`
- **Thresholds**:
  - Base: Vert
  - 50: Orange (warning)
  - 100: Rouge (critical)

---

### Panel Type: **Gauge**

#### DB Pool Usage (%)

```promql
(db_pool_connections_active / db_pool_connections_max) * 100
```

**Config**:
- Visualization: Gauge
- Unit: `percent` (0-100)
- Min: 0, Max: 100
- **Thresholds**:
  - Base: Vert (0-70%)
  - 70: Orange (70-90%)
  - 90: Rouge (> 90%)

---

#### CPU Usage (%)

```promql
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

**Config**:
- Visualization: Gauge
- Unit: `percent` (0-100)
- Min: 0, Max: 100
- **Thresholds**:
  - Base: Vert (0-70%)
  - 70: Orange (70-90%)
  - 90: Rouge (> 90%)

---

#### RAM Usage (%)

```promql
100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))
```

**Config**:
- Visualization: Gauge
- Unit: `percent` (0-100)
- Min: 0, Max: 100
- **Thresholds**:
  - Base: Vert (0-80%)
  - 80: Orange (80-95%)
  - 95: Rouge (> 95%)

---

### Panel Type: **Table**

#### Top 5 Slowest Endpoints

```promql
topk(5, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le)))
```

**Config**:
- Visualization: Table
- Columns: Endpoint, P95 Latency (ms)
- Sort: Descending

---

## 5. Dashboards Recommandés

### Dashboard 1️⃣ : **Application Overview** (Vue d'ensemble)

**Rows** :

1. **Key Metrics** (Row 1)
   - Total Requests/sec (Stat)
   - Error Rate % (Stat)
   - P95 Latency ms (Stat)
   - Active Connections (Stat)

2. **Traffic** (Row 2)
   - Request Rate par endpoint (Graph)
   - Status Code Distribution (Pie chart)

3. **Performance** (Row 3)
   - Latency P50/P95/P99 (Graph)
   - Slow Queries DB P95 (Graph)

4. **Files** (Row 4)
   - Upload Rate (Graph)
   - Download Rate (Graph)
   - Upload Bandwidth MB/s (Graph)
   - Chunk Upload Latency P95 (Graph)

5. **Auth** (Row 5)
   - Login Success Rate (Graph)
   - Failed Login Attempts (Graph - bruteforce detection)

---

### Dashboard 2️⃣ : **System Resources** (Infrastructure)

**Rows** :

1. **CPU** (Row 1)
   - CPU Usage % (Gauge)
   - CPU by Mode (Graph - user, system, iowait)
   - Load Average 1/5/15 (Graph)

2. **Memory** (Row 2)
   - RAM Usage % (Gauge)
   - RAM Available GB (Graph)
   - Swap Usage % (Gauge)

3. **Disk** (Row 3)
   - Disk Usage % per mountpoint (Gauge)
   - Disk I/O MB/s (Graph)
   - Disk Free GB (Stat)

4. **Network** (Row 4)
   - Bandwidth RX/TX MB/s (Graph)
   - Network Errors (Graph)

5. **Uptime** (Row 5)
   - Server Uptime (Stat)
   - Last Boot Time (Stat)

---

### Dashboard 3️⃣ : **Kubernetes Pods** (Containers)

**Rows** :

1. **Pod Status** (Row 1)
   - Pods Running (Stat)
   - Pods Failed (Stat)
   - Pod Restarts (Table)

2. **Resources** (Row 2)
   - CPU Usage by Pod (Graph)
   - RAM Usage by Pod (Graph)

3. **Backend Scaling** (Row 3)
   - Backend Replicas (HPA) (Stat)
   - Backend CPU % (Graph)
   - Backend RAM MB (Graph)

---

### Dashboard 4️⃣ : **Database & Cache** (Stores)

**Rows** :

1. **PostgreSQL** (Row 1)
   - DB Query Rate (Graph)
   - DB Query Latency P95 (Graph)
   - DB Error Rate % (Stat)
   - Query Distribution (Pie - SELECT/INSERT/UPDATE/DELETE)

2. **Redis** (Row 2)
   - Redis Operations/sec (Graph)
   - Redis Cache Hit Rate % (Stat)
   - Redis Error Rate (Graph)

3. **S3/MinIO** (Row 3)
   - S3 Operation Latency P95 (Graph)
   - S3 Operations by Type (Graph - PUT/GET/DELETE)

---

## 6. Alertes Recommandées

### 🚨 Alertes Critiques

```yaml
# Prometheus AlertManager rules

# High Error Rate
- alert: HighErrorRate
  expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100 > 5
  for: 5m
  annotations:
    summary: "Error rate > 5% for 5 minutes"

# High Latency
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1.0
  for: 5m
  annotations:
    summary: "P95 latency > 1 second"

# Database Slow Queries
- alert: DatabaseSlowQueries
  expr: histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 0.5
  for: 5m
  annotations:
    summary: "DB queries P95 > 500ms"

# Bruteforce Detection
- alert: BruteforceAttack
  expr: sum(rate(auth_attempts_total{type="login", status="failed"}[1m])) > 0.83
  for: 2m
  annotations:
    summary: "50+ failed logins/minute - possible bruteforce"

# High CPU
- alert: HighCPU
  expr: 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
  for: 10m
  annotations:
    summary: "CPU usage > 90% for 10 minutes"

# High RAM
- alert: HighRAM
  expr: 100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 95
  for: 5m
  annotations:
    summary: "RAM usage > 95%"

# Disk Full
- alert: DiskFull
  expr: 100 * (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) > 90
  for: 5m
  annotations:
    summary: "Disk usage > 90%"

# Pod Crashing
- alert: PodCrashing
  expr: rate(kube_pod_container_status_restarts_total{namespace="gauzian-v2"}[15m]) > 0.05
  for: 5m
  annotations:
    summary: "Pod restarting frequently"
```

---

## 7. Exemples de Requêtes Avancées

### RED Method (Rate, Errors, Duration)

```promql
# Rate (requêtes/sec)
sum(rate(http_requests_total[5m]))

# Errors (taux d'erreur %)
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# Duration (latence P95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

---

### USE Method (Utilization, Saturation, Errors)

```promql
# Utilization (CPU %)
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Saturation (load average / cores)
node_load1 / count(node_cpu_seconds_total{mode="idle"})

# Errors (network errors/sec)
rate(node_network_receive_errs_total[5m]) + rate(node_network_transmit_errs_total[5m])
```

---

### Golden Signals (Google SRE)

```promql
# 1. Latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 2. Traffic
sum(rate(http_requests_total[5m]))

# 3. Errors
sum(rate(http_requests_total{status=~"5.."}[5m]))

# 4. Saturation
http_connections_active / 100  # Assume 100 = max capacity
```

---

## 8. Tips Grafana

### Variables Dashboard

Créer des variables pour filtrer dynamiquement :

```
# Variable: namespace
label_values(kube_pod_info, namespace)

# Variable: pod
label_values(kube_pod_info{namespace="$namespace"}, pod)

# Variable: endpoint
label_values(http_requests_total, endpoint)
```

Usage dans requêtes :
```promql
rate(http_requests_total{endpoint="$endpoint"}[5m])
```

---

### Templating Time Ranges

Utiliser `$__rate_interval` au lieu de hardcoder `[5m]` :

```promql
# ✅ Bon (s'adapte à la résolution)
rate(http_requests_total[$__rate_interval])

# ❌ Mauvais (fixe)
rate(http_requests_total[5m])
```

---

### Annotations

Ajouter des annotations pour marquer les déploiements :

```promql
# Query
changes(kube_deployment_status_observed_generation{namespace="gauzian-v2"}[5m]) > 0

# Annotation Title
Deployment: {{deployment}}
```

---

## 9. Export/Import Dashboard JSON

### Export Dashboard Actuel

1. Grafana UI → Dashboard → Settings (⚙️) → JSON Model
2. Copier JSON → sauvegarder dans `gauzian_back/k8s/grafana-dashboards/`

### Import Dashboard

```bash
# Via Grafana UI
Home → Dashboards → Import → Upload JSON file

# Via API (automation)
curl -X POST http://admin:password@grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @dashboard.json
```

---

## 10. Ressources

- **Prometheus Docs** : https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Grafana Dashboards** : https://grafana.com/grafana/dashboards/
- **Node Exporter Metrics** : https://github.com/prometheus/node_exporter
- **PromQL Cheat Sheet** : https://promlabs.com/promql-cheat-sheet/

---

**Dernière mise à jour** : 2026-02-15
**Auteur** : Claude Code + Gael
**Version** : 1.0

---

## Quick Start

Pour démarrer rapidement ton dashboard :

1. **Créer un nouveau dashboard** dans Grafana
2. **Ajouter les 4 panels de base** :
   - Request Rate : `sum(rate(http_requests_total[5m]))`
   - Error Rate : `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100`
   - Latency P95 : `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) * 1000`
   - CPU Usage : `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`

3. **Itérer** en ajoutant progressivement d'autres métriques selon tes besoins !

Bon monitoring ! 📊🚀
