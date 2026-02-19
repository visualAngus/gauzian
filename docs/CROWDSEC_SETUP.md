# Phase 2 : Installation CrowdSec pour Gauzian

## 🇫🇷 Pourquoi CrowdSec ?

- **100% Open Source** (MIT License)
- **Startup française** (Sophia Antipolis)
- **Gratuit** pour usage illimité
- **Self-hosted** sur votre VPS
- **Intelligence collaborative** : Partage anonyme des attaques détectées

## Architecture

```
┌─────────────┐
│   Traefik   │ ← Génère des logs access
└──────┬──────┘
       │
       ↓ (logs)
┌─────────────┐
│  CrowdSec   │ ← Analyse patterns d'attaque
│   Agent     │   (brute-force, scan, etc.)
└──────┬──────┘
       │
       ↓ (décisions de ban)
┌─────────────┐
│  CrowdSec   │ ← API locale
│    LAPI     │   Stocke les décisions
└──────┬──────┘
       │
       ↓ (requêtes de vérification)
┌─────────────┐
│  Bouncer    │ ← Plugin Traefik
│  Traefik    │   Bloque les IP bannies
└─────────────┘
```

## Installation (via Helm)

### 1. Ajouter le repo Helm CrowdSec

```bash
helm repo add crowdsec https://crowdsecurity.github.io/helm-charts
helm repo update
```

### 2. Créer le fichier de configuration `crowdsec-values.yaml`

```yaml
# crowdsec-values.yaml
lapi:
  # Dashboard Web optionnel (utile pour debug)
  dashboard:
    enabled: true
    ingress:
      enabled: true
      annotations:
        traefik.ingress.kubernetes.io/router.entrypoints: websecure
        traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
      host: crowdsec.gauzian.pupin.fr
  # Enroll dans la CTI (Cyber Threat Intelligence) optionnel
  # Partage anonyme des attaques détectées
  env:
    - name: ENROLL_KEY
      value: ""  # Laisser vide ou obtenir une clé sur https://app.crowdsec.net
    - name: ENROLL_INSTANCE_NAME
      value: "gauzian-prod"

agent:
  # Acquisition des logs Traefik
  acquisition:
    - namespace: traefik
      podName: "*"
      program: traefik

  # Collections de scénarios (patterns d'attaque)
  # https://app.crowdsec.net/hub/collections
  collections:
    - crowdsecurity/traefik
    - crowdsecurity/http-cve
    - crowdsecurity/whitelist-good-actors

  # Parsers pour Traefik
  parsers:
    - crowdsecurity/traefik-logs

# Bouncer Traefik (plugin)
# NOTE : Le bouncer se configure via Traefik directement
```

### 3. Installer CrowdSec dans votre cluster

```bash
# Créer le namespace
kubectl create namespace crowdsec

# Installer via Helm
helm install crowdsec crowdsec/crowdsec \
  --namespace crowdsec \
  -f crowdsec-values.yaml
```

### 4. Récupérer la clé API du Bouncer

```bash
# Se connecter au pod LAPI
kubectl exec -n crowdsec -it deployment/crowdsec-lapi -- sh

# Créer une clé API pour le bouncer Traefik
cscli bouncers add traefik-bouncer

# Copier la clé générée (exemple: abc123def456...)
```

### 5. Créer le Secret Kubernetes avec la clé API

```bash
kubectl create secret generic crowdsec-bouncer-key \
  --namespace=gauzian-v2 \
  --from-literal=key=VOTRE_CLE_API_ICI
```

### 6. Ajouter le middleware Bouncer Traefik

Créer `gauzian_back/k8s/crowdsec-middleware.yaml` :

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: crowdsec-bouncer
  namespace: gauzian-v2
spec:
  plugin:
    crowdsec-bouncer-traefik-plugin:
      enabled: true
      crowdsecMode: live
      crowdsecLapiScheme: http
      crowdsecLapiHost: crowdsec-lapi.crowdsec.svc.cluster.local:8080
      crowdsecLapiKey:
        valueFrom:
          secretKeyRef:
            name: crowdsec-bouncer-key
            key: key
      # Optionnel : activer le WAF (AppSec)
      crowdsecAppsecEnabled: true
      crowdsecAppsecHost: crowdsec-lapi.crowdsec.svc.cluster.local:7422
      # Options de ban
      banMode: ban              # ou "captcha" si vous voulez un challenge
      defaultDecisionSeconds: 60
```

### 7. Appliquer le middleware aux routes sensibles

Modifier `gauzian_back/k8s/ingressroute.yaml` :

```yaml
# Exemple : ajouter CrowdSec sur la route /api
- match: Host(`gauzian.pupin.fr`) && PathPrefix(`/api`)
  kind: Rule
  middlewares:
    - name: crowdsec-bouncer        # ← Ajouter en premier !
    - name: rate-limit-api
    - name: inflight-limit
    - name: security-headers
    - name: strip-api-prefix
    - name: compress
  services:
    - name: backend
      port: 8080
```

**Ordre des middlewares important** :
1. `crowdsec-bouncer` (bloque les IP bannies **avant** tout)
2. `rate-limit-*` (limite les requêtes)
3. Autres middlewares

### 8. Activer le plugin Traefik

Dans votre config Traefik (généralement `values.yaml` du Helm chart Traefik) :

```yaml
# Traefik Helm values
experimental:
  plugins:
    crowdsec-bouncer-traefik-plugin:
      moduleName: github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin
      version: v1.3.5  # Vérifier la dernière version sur GitHub
```

Redémarrer Traefik après ajout du plugin :

```bash
kubectl rollout restart deployment -n traefik traefik
```

### 9. Déployer les changements

```bash
kubectl apply -k gauzian_back/k8s/
```

## Vérification

### Vérifier que CrowdSec fonctionne

```bash
# Vérifier les pods
kubectl get pods -n crowdsec

# Voir les décisions de ban
kubectl exec -n crowdsec -it deployment/crowdsec-lapi -- cscli decisions list

# Voir les alertes détectées
kubectl exec -n crowdsec -it deployment/crowdsec-lapi -- cscli alerts list
```

### Tester le blocage

1. **Depuis un autre terminal/machine**, lancez un scan agressif :
```bash
# Attention : NE PAS faire depuis votre IP principale !
for i in {1..100}; do
  curl -s https://gauzian.pupin.fr/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"fake@test.com","password":"wrong"}' > /dev/null
  echo "Request $i"
done
```

2. **Vérifier le ban** :
```bash
kubectl exec -n crowdsec -it deployment/crowdsec-lapi -- cscli decisions list
```

Vous devriez voir votre IP de test bloquée !

## Dashboard Web (optionnel)

Accéder au dashboard Metabase :
```bash
# Port-forward
kubectl port-forward -n crowdsec svc/crowdsec-lapi 3000:3000

# Ouvrir http://localhost:3000
# User: crowdsec@crowdsec.net
# Password: (récupérer via)
kubectl get secret -n crowdsec crowdsec-lapi-secrets -o jsonpath='{.data.METABASE_PASSWORD}' | base64 -d
```

## Inscription CTI (optionnel mais recommandé)

La **Cyber Threat Intelligence** de CrowdSec permet de :
- Recevoir des IP malveillantes détectées par la communauté mondiale
- Partager vos détections (anonymement)
- Bloquer proactivement les attaques connues

1. Créer un compte sur https://app.crowdsec.net
2. Aller dans "Instances" → "Add instance"
3. Copier la clé d'enrollment
4. Ajouter dans `crowdsec-values.yaml` :
```yaml
lapi:
  env:
    - name: ENROLL_KEY
      value: "VOTRE_CLE_ENROLLMENT"
    - name: ENROLL_INSTANCE_NAME
      value: "gauzian-prod"
```
5. Redéployer :
```bash
helm upgrade crowdsec crowdsec/crowdsec \
  --namespace crowdsec \
  -f crowdsec-values.yaml
```

## Maintenance

### Débloquer une IP

```bash
kubectl exec -n crowdsec -it deployment/crowdsec-lapi -- cscli decisions delete --ip 1.2.3.4
```

### Whitelist une IP (votre IP fixe par exemple)

```bash
kubectl exec -n crowdsec -it deployment/crowdsec-lapi -- sh
cscli parsers install crowdsecurity/whitelists
echo "name: my-whitelist
whitelist:
  reason: My office IP
  ip:
    - 1.2.3.4
    - 5.6.7.8/32" > /etc/crowdsec/parsers/s02-enrich/mywhitelist.yaml
cscli parsers list  # Vérifier
exit
kubectl rollout restart -n crowdsec deployment/crowdsec-agent
```

## Ressources

- [Documentation CrowdSec](https://docs.crowdsec.net)
- [Traefik Bouncer GitHub](https://github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin)
- [Hub CrowdSec (collections/scénarios)](https://app.crowdsec.net/hub)
- [Traefik Plugins Catalog](https://plugins.traefik.io/)

## Coût

**100% GRATUIT** 🎉
- Pas de limite de requêtes
- Pas de limite de bans
- Support communautaire via Discord/GitHub
- CTI optionnel gratuit (avec inscription)
