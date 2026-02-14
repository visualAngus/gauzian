# Runbooks Opérationnels - GAUZIAN

Guide procédural pour les opérations de production (déploiement, troubleshooting, incident response, backup/restore, scaling, monitoring).

**Dernière mise à jour** : 2026-02-11

---

## Table des Matières

1. [Deployment](#deployment)
2. [Rollback](#rollback)
3. [Database Operations](#database-operations)
4. [Incident Response](#incident-response)
5. [Scaling](#scaling)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Backup & Restore](#backup--restore)
8. [Security Incidents](#security-incidents)

---

## Deployment

### Déploiement VPS Kubernetes (Production)

**Contexte** : Déployer une nouvelle version du backend ou frontend sur le cluster K8s.

**Prérequis** :
- Accès SSH au VPS
- Docker Hub credentials
- Tests passés (`cargo test`, `npm test`)

**Procédure** :

```bash
# 1. Build et push les images Docker
cd ~/gauzian
./push_docker_hub.sh

# Sortie attendue :
# Building backend image...
# [+] Building 45.2s (12/12) FINISHED
# Pushing to Docker Hub...
# latest: digest: sha256:abc123... size: 1234

# 2. Déployer sur le cluster K8s
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'

# Sortie attendue :
# Pulling latest images...
# Restarting deployments...
# deployment.apps/backend restarted
# deployment.apps/frontend restarted

# 3. Vérifier le déploiement
ssh vps 'kubectl get pods -n gauzian-v2'

# Sortie attendue :
# NAME                        READY   STATUS    RESTARTS   AGE
# backend-5f7d8b9c4d-abc12    1/1     Running   0          30s
# frontend-6c8e9a0f5e-def34   1/1     Running   0          30s
# postgres-0                  1/1     Running   0          5d
# redis-0                     1/1     Running   0          5d

# 4. Vérifier les logs (pas d'erreurs)
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=50'

# 5. Test santé
curl https://api.gauzian.com/health/ready
# Attendu : "OK"

curl https://gauzian.com
# Attendu : 200 OK (page d'accueil)
```

**Rollback** : Voir [Rollback](#rollback) si erreurs critiques.

**Durée estimée** : 5-10 minutes

---

### Déploiement Clever Cloud (Alternatif)

**Contexte** : Déployer sur Clever Cloud (PaaS).

**Procédure** :

```bash
# 1. Build image backend pre-built (optimisé)
cd ~/gauzian
./update-backend-image.sh

# 2. Commit le Dockerfile généré
git add Dockerfile.backend.prebuilt
git commit -m "chore: Update backend image for Clever Cloud"

# 3. Push vers Clever Cloud
git push clever main

# 4. Suivre les logs de déploiement
clever logs --follow

# 5. Vérifier le déploiement
curl https://app-xyz.cleverapps.io/health/ready
# Attendu : "OK"
```

**Durée estimée** : 10-15 minutes (build Clever Cloud)

---

## Rollback

### Rollback VPS K8s

**Contexte** : Le nouveau déploiement cause des erreurs critiques (500, crashes, data loss).

**Décision** : Rollback si **AUCUN** de ces critères n'est rempli :
- Taux d'erreur > 5% (vérifier Grafana)
- Latency P99 > 2s (vérifier Prometheus)
- Crashes répétés (pods en `CrashLoopBackOff`)

**Procédure** :

```bash
# 1. Identifier la dernière version stable
ssh vps 'kubectl rollout history deployment/backend -n gauzian-v2'

# Sortie :
# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         feat(auth): Add 2FA
# 3         fix(drive): Fix chunked upload  ← Actuel (broken)

# 2. Rollback vers révision précédente
ssh vps 'kubectl rollout undo deployment/backend -n gauzian-v2'

# Ou rollback vers révision spécifique
ssh vps 'kubectl rollout undo deployment/backend -n gauzian-v2 --to-revision=2'

# 3. Vérifier le rollback
ssh vps 'kubectl get pods -n gauzian-v2 -l app=backend'

# Attendu :
# NAME                       READY   STATUS    RESTARTS   AGE
# backend-abc123-xyz45       1/1     Running   0          20s

# 4. Vérifier les logs (pas d'erreurs)
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=50'

# 5. Tester l'API
curl https://api.gauzian.com/health/ready
# Attendu : "OK"

# 6. Vérifier Grafana (taux d'erreur doit descendre < 1%)
# URL : https://grafana.gauzian.com/d/gauzian-api
```

**Post-Rollback** :
- [ ] Investiguer la cause du problème (logs, metrics)
- [ ] Créer un GitHub issue avec les détails
- [ ] Fixer le bug dans une nouvelle branch
- [ ] Déployer à nouveau avec fix

**Durée estimée** : 2-5 minutes

---

### Rollback Clever Cloud

**Procédure** :

```bash
# 1. Lister les déploiements récents
clever activity

# 2. Rollback vers un déploiement spécifique
clever restart --commit <commit-sha>

# Ou rollback vers déploiement précédent
clever restart --commit HEAD~1
```

---

## Database Operations

### Appliquer une Migration

**Contexte** : Déployer un changement de schéma DB (nouvelle table, colonne, index).

**Prérequis** :
- Migration testée en local
- Backup DB récent (<24h)

**Procédure** :

```bash
# 1. Vérifier l'état des migrations
ssh vps 'kubectl exec -it postgres-0 -n gauzian-v2 -- psql -U gauzian_user -d gauzian_db -c "\dt"'

# 2. Port-forward PostgreSQL
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &

# 3. Appliquer la migration
cd ~/gauzian/gauzian_back
sqlx migrate run --database-url postgresql://gauzian_user:password@localhost:5432/gauzian_db

# Sortie attendue :
# Applied 20260211120000_add_folder_access_table.up.sql

# 4. Vérifier la migration
sqlx migrate info --database-url postgresql://gauzian_user:password@localhost:5432/gauzian_db

# 5. Tester la nouvelle table
psql postgresql://gauzian_user:password@localhost:5432/gauzian_db \
  -c "SELECT * FROM folder_access LIMIT 5;"

# 6. Redémarrer le backend (recharger le schema)
ssh vps 'kubectl rollout restart deployment/backend -n gauzian-v2'
```

**Rollback Migration** :

```bash
# Revenir en arrière
sqlx migrate revert --database-url postgresql://gauzian_user:password@localhost:5432/gauzian_db
```

**Durée estimée** : 5-10 minutes

---

### Backup Database

**Contexte** : Créer un backup manuel avant une migration critique.

**Procédure** :

```bash
# 1. Port-forward PostgreSQL
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &

# 2. Créer un dump
pg_dump postgresql://gauzian_user:password@localhost:5432/gauzian_db \
  > backups/gauzian_db_$(date +%Y%m%d_%H%M%S).sql

# Sortie :
# backups/gauzian_db_20260211_143000.sql (12 MB)

# 3. Compresser le backup
gzip backups/gauzian_db_20260211_143000.sql

# 4. Uploader vers S3 (ou autre backup storage)
aws s3 cp backups/gauzian_db_20260211_143000.sql.gz \
  s3://gauzian-backups/database/

# 5. Vérifier l'upload
aws s3 ls s3://gauzian-backups/database/
```

**Backup automatique** : Configuré via CronJob K8s (tous les jours à 2h AM).

---

### Restore Database

**Contexte** : Restaurer la DB après une corruption de données ou migration échouée.

**⚠️ IMPORTANT** : Cette opération est **destructive**. Vérifier deux fois avant d'exécuter.

**Procédure** :

```bash
# 1. Arrêter le backend (éviter les écritures)
ssh vps 'kubectl scale deployment/backend -n gauzian-v2 --replicas=0'

# 2. Port-forward PostgreSQL
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &

# 3. Télécharger le backup depuis S3
aws s3 cp s3://gauzian-backups/database/gauzian_db_20260211_143000.sql.gz \
  backups/

# 4. Décompresser
gunzip backups/gauzian_db_20260211_143000.sql.gz

# 5. Dropper la DB actuelle (⚠️ DESTRUCTIVE)
psql postgresql://gauzian_user:password@localhost:5432/postgres \
  -c "DROP DATABASE gauzian_db;"

# 6. Recréer la DB
psql postgresql://gauzian_user:password@localhost:5432/postgres \
  -c "CREATE DATABASE gauzian_db OWNER gauzian_user;"

# 7. Restaurer le dump
psql postgresql://gauzian_user:password@localhost:5432/gauzian_db \
  < backups/gauzian_db_20260211_143000.sql

# 8. Redémarrer le backend
ssh vps 'kubectl scale deployment/backend -n gauzian-v2 --replicas=2'

# 9. Vérifier les logs
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=50'

# 10. Tester l'API
curl https://api.gauzian.com/drive/files -H "Cookie: auth_token=..." | jq
```

**Durée estimée** : 15-30 minutes (dépend de la taille du dump)

---

## Incident Response

### Backend Down (Pods en CrashLoopBackOff)

**Symptômes** :
- `kubectl get pods` montre `CrashLoopBackOff` ou `Error`
- API retourne 502 Bad Gateway

**Diagnostic** :

```bash
# 1. Vérifier les pods
ssh vps 'kubectl get pods -n gauzian-v2 -l app=backend'

# Sortie (problème) :
# NAME                       READY   STATUS             RESTARTS   AGE
# backend-abc123-xyz45       0/1     CrashLoopBackOff   5          3m

# 2. Vérifier les logs
ssh vps 'kubectl logs -n gauzian-v2 backend-abc123-xyz45'

# 3. Vérifier les events
ssh vps 'kubectl describe pod backend-abc123-xyz45 -n gauzian-v2'
```

**Causes communes** :

#### Cause 1 : Database Connection Failed

**Logs** :
```
Error: Failed to connect to database
Connection refused: postgres:5432
```

**Solution** :

```bash
# Vérifier PostgreSQL
ssh vps 'kubectl get pods -n gauzian-v2 -l app=postgres'

# Si postgres down → redémarrer
ssh vps 'kubectl rollout restart statefulset/postgres -n gauzian-v2'
```

#### Cause 2 : Redis Connection Refused

**Logs** :
```
Error: Failed to connect to Redis
Connection refused: redis:6379
```

**Solution** :

```bash
# Vérifier Redis
ssh vps 'kubectl get pods -n gauzian-v2 -l app=redis'

# Si redis down → redémarrer
ssh vps 'kubectl rollout restart statefulset/redis -n gauzian-v2'
```

#### Cause 3 : OOMKilled (Out Of Memory)

**Logs** :
```
Events:
  Type     Reason     Age    From               Message
  ----     ------     ----   ----               -------
  Warning  OOMKilled  2m     kubelet            Container backend was OOMKilled
```

**Solution** :

```bash
# Augmenter memory limit
ssh vps 'kubectl edit deployment/backend -n gauzian-v2'

# Modifier :
# resources:
#   limits:
#     memory: 512Mi  →  1024Mi
```

#### Cause 4 : JWT_SECRET Missing

**Logs** :
```
thread 'main' panicked at 'JWT_SECRET must be set'
```

**Solution** :

```bash
# Vérifier le secret
ssh vps 'kubectl get secret gauzian-secrets -n gauzian-v2 -o yaml'

# Si manquant → créer
ssh vps 'kubectl create secret generic gauzian-secrets -n gauzian-v2 \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=DATABASE_URL=postgresql://...'

# Redémarrer backend
ssh vps 'kubectl rollout restart deployment/backend -n gauzian-v2'
```

---

### High Error Rate (>5%)

**Symptômes** :
- Grafana dashboard montre taux d'erreur > 5%
- Prometheus alert "HighErrorRate" se déclenche

**Diagnostic** :

```bash
# 1. Vérifier les métriques Prometheus
curl https://prometheus.gauzian.com/api/v1/query \
  -d 'query=rate(gauzian_requests_total{status=~"5.."}[5m]) / rate(gauzian_requests_total[5m])' \
  | jq '.data.result[0].value[1]'

# Sortie : "0.087" (8.7% error rate)

# 2. Identifier les endpoints problématiques
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=1000 | grep "ERROR"'

# 3. Vérifier les logs d'erreurs spécifiques
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend | grep "500"'
```

**Causes communes** :

#### Database Pool Exhausted

**Logs** :
```
ERROR: Database pool timeout (all 20 connections in use)
```

**Solution** :

```bash
# Augmenter max_connections
ssh vps 'kubectl edit deployment/backend -n gauzian-v2'

# Ajouter :
# env:
#   - name: DATABASE_MAX_CONNECTIONS
#     value: "30"  # (était 20)
```

#### S3 Bucket Missing

**Logs** :
```
ERROR: S3 bucket 'gauzian-chunks' does not exist
```

**Solution** :

```bash
# Accéder MinIO Console
ssh vps 'kubectl port-forward -n gauzian-v2 svc/minio 9001:9001'

# Ouvrir http://localhost:9001
# Login avec MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
# Créer bucket "gauzian-chunks"
```

---

### High Latency (P99 > 2s)

**Symptômes** :
- Grafana dashboard montre P99 latency > 2s
- Utilisateurs rapportent lenteurs

**Diagnostic** :

```bash
# 1. Vérifier les métriques
curl https://prometheus.gauzian.com/api/v1/query \
  -d 'query=histogram_quantile(0.99, rate(gauzian_request_duration_seconds_bucket[5m]))' \
  | jq

# 2. Identifier les endpoints lents
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend | grep "duration" | sort -k5 -n | tail -20'
```

**Causes communes** :

#### N+1 Query Problem

**Solution** : Optimiser les requêtes SQL (voir logs, ajouter des JOINs).

#### Missing Database Index

**Solution** :

```bash
# Analyser les requêtes lentes
psql $DATABASE_URL -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Créer un indice si nécessaire
psql $DATABASE_URL -c "
CREATE INDEX idx_files_folder_id ON files(folder_id);
"
```

---

## Scaling

### Scaler le Backend Manuellement

**Contexte** : Trafic élevé (Black Friday, campagne marketing).

**Procédure** :

```bash
# 1. Vérifier l'état actuel
ssh vps 'kubectl get hpa -n gauzian-v2'

# Sortie :
# NAME      REFERENCE          TARGETS          MINPODS   MAXPODS   REPLICAS   AGE
# backend   Deployment/backend 45%/50% (CPU)    2         10        2          5d

# 2. Scaler manuellement (override HPA)
ssh vps 'kubectl scale deployment/backend -n gauzian-v2 --replicas=5'

# 3. Vérifier les pods
ssh vps 'kubectl get pods -n gauzian-v2 -l app=backend'

# Attendu :
# NAME                       READY   STATUS    RESTARTS   AGE
# backend-abc123-xyz45       1/1     Running   0          5m
# backend-abc123-xyz46       1/1     Running   0          30s
# backend-abc123-xyz47       1/1     Running   0          30s
# backend-abc123-xyz48       1/1     Running   0          30s
# backend-abc123-xyz49       1/1     Running   0          30s

# 4. Vérifier la distribution du trafic
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=10'
# Chaque pod doit recevoir du trafic

# 5. Restaurer l'autoscaling
ssh vps 'kubectl scale deployment/backend -n gauzian-v2 --replicas=2'
```

**Durée estimée** : 2-3 minutes

---

### Augmenter HPA Max Replicas

**Contexte** : Trafic constamment élevé, HPA à 10/10 replicas.

**Procédure** :

```bash
# 1. Éditer HPA
ssh vps 'kubectl edit hpa backend -n gauzian-v2'

# Modifier :
# spec:
#   maxReplicas: 10  →  20

# 2. Vérifier
ssh vps 'kubectl get hpa -n gauzian-v2'

# Attendu :
# NAME      REFERENCE          TARGETS          MINPODS   MAXPODS   REPLICAS   AGE
# backend   Deployment/backend 45%/50% (CPU)    2         20        5          5d
```

---

### Scaler PostgreSQL (Vertical Scaling)

**Contexte** : CPU/RAM de PostgreSQL saturé.

**Procédure** :

```bash
# 1. Vérifier les ressources actuelles
ssh vps 'kubectl describe pod postgres-0 -n gauzian-v2 | grep -A 5 "Limits"'

# Sortie :
#   Limits:
#     cpu:     1
#     memory:  2Gi

# 2. Éditer le StatefulSet
ssh vps 'kubectl edit statefulset postgres -n gauzian-v2'

# Modifier :
# resources:
#   limits:
#     cpu: 1  →  2
#     memory: 2Gi  →  4Gi

# 3. Redémarrer PostgreSQL (⚠️ downtime ~30s)
ssh vps 'kubectl delete pod postgres-0 -n gauzian-v2'

# 4. Vérifier le redémarrage
ssh vps 'kubectl get pods -n gauzian-v2 -l app=postgres'

# Attendu :
# NAME         READY   STATUS    RESTARTS   AGE
# postgres-0   1/1     Running   0          1m
```

**⚠️ Downtime** : ~30 secondes (temps de redémarrage PostgreSQL).

---

## Monitoring & Alerts

### Vérifier les Métriques Prometheus

**URL** : `https://prometheus.gauzian.com`

**Requêtes utiles** :

```promql
# Taux d'erreur global
rate(gauzian_requests_total{status=~"5.."}[5m]) / rate(gauzian_requests_total[5m])

# Latency P99
histogram_quantile(0.99, rate(gauzian_request_duration_seconds_bucket[5m]))

# DB Pool active connections
gauzian_db_pool_active

# Uploads S3 par minute
rate(gauzian_s3_uploads_total[1m]) * 60

# Memory usage backend
container_memory_usage_bytes{pod=~"backend.*", namespace="gauzian-v2"}
```

---

### Alerts Configurées

**Fichier** : `gauzian_back/k8s/prometheus/alerts.yaml`

| Alert | Condition | Action |
|-------|-----------|--------|
| `HighErrorRate` | Taux d'erreur > 5% pendant 5 min | Vérifier logs backend, rollback si nécessaire |
| `HighLatency` | P99 latency > 2s pendant 5 min | Vérifier slow queries, scaler backend |
| `DatabasePoolExhausted` | `db_pool_active` > 18/20 pendant 5 min | Augmenter `DATABASE_MAX_CONNECTIONS` |
| `RedisDown` | `redis_cache_hits == 0` pendant 5 min | Redémarrer Redis |
| `PodCrashLooping` | Pod en `CrashLoopBackOff` | Vérifier logs, rollback si nécessaire |
| `DiskSpaceLow` | Disk usage > 85% | Nettoyer les logs, augmenter volume |

---

### Grafana Dashboards

**URL** : `https://grafana.gauzian.com`

**Dashboards** :
- `gauzian-api` : Métriques API (latency, error rate, throughput)
- `gauzian-infrastructure` : Métriques K8s (CPU, RAM, disk, network)

**Panels clés** :
- Request rate (par endpoint)
- Error rate (par status code)
- Latency histogram (P50, P95, P99)
- Database connections (active/idle)
- Redis cache hit ratio
- S3 operations (uploads/downloads per minute)

---

## Backup & Restore

### Backup Automatique (CronJob)

**Configuration** : `gauzian_back/k8s/cronjob-backup.yaml`

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: gauzian-v2
spec:
  schedule: "0 2 * * *"  # Tous les jours à 2h AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:17
            command:
            - sh
            - -c
            - |
              pg_dump $DATABASE_URL > /backup/gauzian_db_$(date +%Y%m%d_%H%M%S).sql
              gzip /backup/gauzian_db_*.sql
              aws s3 cp /backup/gauzian_db_*.sql.gz s3://gauzian-backups/database/
```

**Vérifier les backups** :

```bash
# Lister les backups S3
aws s3 ls s3://gauzian-backups/database/

# Sortie :
# 2026-02-10 02:00:15  12345678 gauzian_db_20260210_020000.sql.gz
# 2026-02-11 02:00:18  12456789 gauzian_db_20260211_020000.sql.gz
```

---

### Backup MinIO (Chunks S3)

**Procédure** :

```bash
# 1. Utiliser MinIO Client (mc)
ssh vps 'kubectl port-forward -n gauzian-v2 svc/minio 9000:9000' &

# 2. Configurer mc
mc alias set gauzian-minio http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

# 3. Mirror le bucket vers backup
mc mirror gauzian-minio/gauzian-chunks /backup/minio/gauzian-chunks/

# 4. Uploader vers S3 externe
aws s3 sync /backup/minio/gauzian-chunks/ s3://gauzian-backups/minio/
```

**Fréquence recommandée** : Quotidien (via CronJob).

---

## Security Incidents

### Suspected Data Breach

**Procédure** :

1. **Isoler immédiatement** :

```bash
# Scaler backend à 0 (arrêter tout accès API)
ssh vps 'kubectl scale deployment/backend -n gauzian-v2 --replicas=0'
```

2. **Investiguer** :

```bash
# Vérifier les logs d'accès
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --since=24h | grep "401\|403\|500"'

# Vérifier les connexions DB suspectes
psql $DATABASE_URL -c "
SELECT datname, usename, application_name, client_addr, state, query
FROM pg_stat_activity
WHERE datname = 'gauzian_db';
"
```

3. **Révoquer tous les JWT tokens** :

```bash
# Flush Redis (blacklist tous les tokens)
ssh vps 'kubectl exec -it redis-0 -n gauzian-v2 -- redis-cli FLUSHALL'
```

4. **Changer tous les secrets** :

```bash
# Générer nouveaux secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)

# Update K8s secret
ssh vps 'kubectl create secret generic gauzian-secrets -n gauzian-v2 \
  --from-literal=JWT_SECRET=$NEW_JWT_SECRET \
  --dry-run=client -o yaml | kubectl apply -f -'

# Redémarrer backend
ssh vps 'kubectl rollout restart deployment/backend -n gauzian-v2'
```

5. **Notifier les utilisateurs** :
   - Email de sécurité à tous les utilisateurs
   - Recommander de changer leur mot de passe

6. **Post-mortem** :
   - Documenter l'incident
   - Identifier la cause (XSS, SQL injection, credentials leak, etc.)
   - Implémenter les fixes
   - Créer GitHub issue

---

### Suspected XSS Attack

**Symptômes** :
- Scripts malveillants détectés dans les logs
- Utilisateurs rapportent comportements suspects

**Procédure** :

```bash
# 1. Identifier les payloads XSS dans logs
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend | grep -i "script\|onerror\|onclick"'

# 2. Vérifier les données en DB
psql $DATABASE_URL -c "
SELECT id, encrypted_metadata FROM files
WHERE encrypted_metadata LIKE '%<script%';
"

# 3. Si XSS confirmé → nettoyer les données
# (Attention : données chiffrées, vérifier avec user)

# 4. Déployer fix :
# - Ajouter DOMPurify côté frontend
# - Ajouter validation stricte côté backend
```

---

### Suspected SQL Injection

**Symptômes** :
- Logs montrent requêtes SQL suspectes

**Procédure** :

```bash
# 1. Vérifier les logs d'erreurs SQL
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend | grep "syntax error\|DROP\|DELETE"'

# 2. Vérifier pg_stat_activity
psql $DATABASE_URL -c "
SELECT query FROM pg_stat_activity
WHERE query LIKE '%DROP%' OR query LIKE '%DELETE%';
"

# 3. Si SQL injection confirmée :
# - Rollback immédiatement
# - Restore DB depuis backup
# - Fixer l'endpoint vulnérable (utiliser sqlx::query! avec paramètres bindés)
```

---

## Post-Incident

Après chaque incident, documenter dans `INCIDENTS.md` :

```markdown
# Incident YYYY-MM-DD : [Titre]

**Date** : 2026-02-11 14:30 UTC
**Durée** : 45 minutes
**Gravité** : Critical / High / Medium / Low

## Chronologie

- 14:30 : Alert "HighErrorRate" se déclenche (taux d'erreur 12%)
- 14:35 : Investigation logs → DB pool exhausted
- 14:40 : Augmentation DB_MAX_CONNECTIONS de 20 à 30
- 14:45 : Redémarrage backend
- 15:15 : Taux d'erreur retour à 0.5%

## Cause Racine

Database connection pool exhausted (20/20 connections utilisées).

## Impact

- 12% des requêtes API ont échoué (500 errors)
- ~500 utilisateurs affectés
- Pas de perte de données

## Actions Préventives

- [ ] Augmenter DB_MAX_CONNECTIONS à 30 par défaut
- [ ] Ajouter alert "DB Pool > 80%" (avant épuisement)
- [ ] Optimiser requêtes N+1 (files + folder_access)

## Lessons Learned

- Connection pooling doit être dimensionné pour pic de trafic
- Alerts doivent se déclencher AVANT saturation complète
```

---

**Dernière mise à jour** : 2026-02-11
