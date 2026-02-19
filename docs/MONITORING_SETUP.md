# Installation Monitoring Stack (Prometheus + Grafana)

## 🎯 Architecture

```
Backend Rust (/metrics)
    ↓
Prometheus (scrape toutes les 15s)
    ↓
Grafana (dashboards + alertes)
```

## 📊 Métriques Disponibles

Votre backend expose déjà **17 métriques Prometheus** :

### HTTP
- `http_requests_total` - Total des requêtes par method/endpoint/status
- `http_request_duration_seconds` - Latence des requêtes (histogramme)
- `http_connections_active` - Connexions actives

### Métier
- `file_uploads_total` - Uploads réussis/échoués
- `file_downloads_total` - Downloads réussis/échoués
- `file_upload_bytes_total` - Octets uploadés
- `chunk_upload_duration_seconds` - Durée upload chunks
- `chunk_download_duration_seconds` - Durée download chunks
- `auth_attempts_total` - Tentatives d'auth (login/register/autologin)

### Infrastructure
- `s3_operation_duration_seconds` - Latence S3 (put/get/delete)
- `redis_operations_total` - Opérations Redis
- `db_queries_total` - Requêtes DB par type
- `db_query_duration_seconds` - Latence DB

## 🚀 Installation

### 1. Déployer le Monitoring

```bash
# Créer le namespace
kubectl apply -f gauzian_back/k8s/monitoring-namespace.yaml

# Déployer Prometheus
kubectl apply -f gauzian_back/k8s/prometheus-config.yaml
kubectl apply -f gauzian_back/k8s/prometheus-deployment.yaml

# Déployer Grafana
kubectl apply -f gauzian_back/k8s/grafana-datasources.yaml
kubectl apply -f gauzian_back/k8s/grafana-dashboards-provider.yaml
kubectl apply -f gauzian_back/k8s/grafana-dashboard-gauzian.yaml
kubectl apply -f gauzian_back/k8s/grafana-deployment.yaml

# Exposer via Traefik
kubectl apply -f gauzian_back/k8s/grafana-ingress.yaml
```

### 2. Vérifier que tout fonctionne

```bash
# Vérifier les pods
kubectl get pods -n monitoring

# Devrait afficher :
# NAME                          READY   STATUS    RESTARTS   AGE
# prometheus-xxx                1/1     Running   0          30s
# grafana-xxx                   1/1     Running   0          30s

# Vérifier les PVCs
kubectl get pvc -n monitoring

# Vérifier que Prometheus scrape le backend
kubectl logs -n monitoring deployment/prometheus | grep gauzian-backend
```

### 3. Accéder aux Interfaces

**Grafana** : https://grafana.gauzian.pupin.fr
- Username : `admin`
- Password : `ChangeMe123!` (à changer dans `grafana-deployment.yaml` !)

**Prometheus** : https://prometheus.gauzian.pupin.fr

### 4. Changer le Mot de Passe Admin Grafana

```bash
# Modifier le secret
kubectl edit secret grafana-credentials -n monitoring

# Ou via commande :
kubectl create secret generic grafana-credentials \
  --namespace=monitoring \
  --from-literal=admin-password=VotreNouveauMotDePasse \
  --dry-run=client -o yaml | kubectl apply -f -

# Redémarrer Grafana
kubectl rollout restart deployment/grafana -n monitoring
```

## 📈 Dashboards Préconfigurés

### Dashboard "Gauzian - Overview"

Automatiquement provisionné avec 14 panneaux :

1. **Requêtes HTTP/s** - Par méthode (GET, POST, etc.)
2. **Connexions Actives** - Nombre de connexions en temps réel
3. **Taux de Succès** - % de requêtes 2xx (seuils : rouge <95%, jaune <99%, vert ≥99%)
4. **Latence p50/p95/p99** - Percentiles de latence en ms
5. **Uploads de Fichiers** - Compteur sur 1h
6. **Downloads de Fichiers** - Compteur sur 1h
7. **Bytes Uploadés** - Total (formaté en KB/MB/GB)
8. **Tentatives d'Auth** - Par type (login/register) et status
9. **Durée S3 (p95)** - Gauge avec seuils (vert <1s, jaune <3s, rouge ≥3s)
10. **Top 10 Endpoints** - Par latence p95 (tableau)
11. **Erreurs 4xx/5xx** - Graphe des erreurs par seconde
12. **Upload Chunks (p95)** - Latence d'upload des chunks
13. **Opérations Redis** - Par opération et status
14. **Durée DB (p95)** - Par type de requête (SELECT/INSERT/UPDATE)

## 🔔 Créer des Alertes (optionnel)

Grafana permet de créer des alertes sur les métriques. Exemples :

### Alerte : Taux d'erreur élevé

1. Aller dans le panneau "Taux de Succès HTTP"
2. Cliquer sur "Edit" → "Alert"
3. Configurer :
   - Condition : `WHEN avg() OF query(A, 5m) IS BELOW 95`
   - Contact point : Email, Slack, Discord, etc.

### Alerte : Latence élevée

1. Panneau "Latence p95"
2. Condition : `WHEN avg() OF query(B, 5m) IS ABOVE 1000` (1s)

### Alerte : Authentifications échouées

1. Panneau "Tentatives d'Auth"
2. Condition : `WHEN sum() OF query(failed, 5m) IS ABOVE 10`

## 📦 Exporters Additionnels (optionnel)

### PostgreSQL Exporter

```bash
# Ajouter dans gauzian_back/k8s/postgres-deployment.yaml
# Ajouter un sidecar container :
- name: postgres-exporter
  image: prometheuscommunity/postgres-exporter:v0.15.0
  env:
    - name: DATA_SOURCE_NAME
      value: "postgresql://user:password@localhost:5432/gauzian?sslmode=disable"
  ports:
    - containerPort: 9187
      name: metrics
```

### Redis Exporter

```bash
# Ajouter dans gauzian_back/k8s/redis-deployment.yaml
- name: redis-exporter
  image: oliver006/redis_exporter:v1.55.0
  env:
    - name: REDIS_ADDR
      value: "redis://localhost:6379"
  ports:
    - containerPort: 9121
      name: metrics
```

### MinIO Metrics

MinIO expose déjà des métriques sur `/minio/v2/metrics/cluster`.
Vérifier que Prometheus les scrape :

```bash
kubectl logs -n monitoring deployment/prometheus | grep minio
```

## 🔍 Requêtes PromQL Utiles

### Top 10 endpoints les plus lents
```promql
topk(10, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)))
```

### Taux d'erreur par endpoint
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) by (endpoint) / sum(rate(http_requests_total[5m])) by (endpoint) * 100
```

### Débit upload en MB/s
```promql
sum(rate(file_upload_bytes_total[1m])) / 1024 / 1024
```

### Taux de succès authentification
```promql
sum(rate(auth_attempts_total{status="success"}[5m])) / sum(rate(auth_attempts_total[5m])) * 100
```

## 🎨 Personnaliser les Dashboards

Les dashboards sont éditables directement dans Grafana :
1. Ouvrir le dashboard
2. Cliquer sur l'icône ⚙️ (Settings) en haut à droite
3. Modifier les panneaux, ajouter des variables, etc.
4. Sauvegarder

Les modifications sont persistées dans le PVC Grafana.

## 🧹 Maintenance

### Voir l'espace disque utilisé par Prometheus

```bash
kubectl exec -n monitoring deployment/prometheus -- du -sh /prometheus
```

### Nettoyer les anciennes données (>30j)

Les données sont automatiquement supprimées après 30 jours (voir `--storage.tsdb.retention.time=30d`).

Pour changer la rétention :
```bash
kubectl edit deployment prometheus -n monitoring
# Modifier : --storage.tsdb.retention.time=15d
```

### Backup des dashboards Grafana

```bash
# Exporter tous les dashboards
kubectl exec -n monitoring deployment/grafana -- \
  sqlite3 /var/lib/grafana/grafana.db ".dump" > grafana-backup.sql
```

## 🌐 DNS

Ajouter les entrées DNS :
- `grafana.gauzian.pupin.fr` → IP de votre VPS
- `prometheus.gauzian.pupin.fr` → IP de votre VPS

## 🔒 Sécurité

### Restreindre l'accès à Prometheus

Prometheus expose toutes les métriques sans auth. Pour restreindre :

```yaml
# Créer un middleware BasicAuth
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: prometheus-auth
  namespace: monitoring
spec:
  basicAuth:
    secret: prometheus-auth-secret
---
apiVersion: v1
kind: Secret
metadata:
  name: prometheus-auth-secret
  namespace: monitoring
type: Opaque
stringData:
  users: |
    admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/
    # Générer avec : htpasswd -n admin
```

Puis ajouter dans `grafana-ingress.yaml` :
```yaml
middlewares:
  - name: prometheus-auth
  - name: security-headers
    namespace: gauzian-v2
```

## 📚 Ressources

- [Prometheus Query Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
