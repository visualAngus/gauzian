# Guide Cloudflare Workers - Reverse Proxy pour GAUZIAN

## 🎯 Architecture finale

```
Utilisateur
    ↓
gauzian.com (Cloudflare Workers - Edge)
    ├─ /           → Frontend Clever Cloud
    ├─ /api/*      → Backend Clever Cloud
    └─ Rate limiting, Caching, CDN
```

**Avantages :**
- ✅ Domaine unifié (pas de CORS)
- ✅ Gratuit (10M requêtes/mois)
- ✅ CDN mondial (300+ datacenters)
- ✅ Rate limiting intégré
- ✅ SSL automatique
- ✅ Analytics inclus

---

## 📋 Prérequis

1. Compte Cloudflare (gratuit) : https://dash.cloudflare.com/sign-up
2. Domaine configuré sur Cloudflare (ou utilisez un sous-domaine de workers.dev pour tester)
3. Applications Clever Cloud déployées avec leurs URLs

---

## 🚀 Configuration étape par étape

### Étape 1 : Créer le Worker

1. **Aller sur Cloudflare Dashboard** : https://dash.cloudflare.com
2. **Workers & Pages** (menu gauche) → **Create Application**
3. **Create Worker** → Donner un nom : `gauzian-proxy`
4. **Deploy** (on modifiera le code après)

### Étape 2 : Code du Worker

Cliquez sur **Edit Code** et remplacez tout par ce code :

```javascript
/**
 * Reverse Proxy Cloudflare Worker pour GAUZIAN
 * Route le trafic vers Frontend et Backend Clever Cloud
 */

export default {
  async fetch(request, env) {
    // URLs de vos applications Clever Cloud (à mettre à jour)
    const FRONTEND_URL = env.FRONTEND_URL || 'https://app-yyyyyyyy.cleverapps.io';
    const BACKEND_URL = env.BACKEND_URL || 'https://app-xxxxxxxx.cleverapps.io';

    const url = new URL(request.url);

    // Routing
    let targetUrl;
    let targetOrigin;

    if (url.pathname.startsWith('/api')) {
      // Backend - Retirer le préfixe /api car le backend ne l'a pas dans ses routes
      targetOrigin = BACKEND_URL;
      const backendPath = url.pathname.replace('/api', '') || '/';  // /api/login → /login
      targetUrl = new URL(backendPath + url.search, BACKEND_URL);
    } else {
      // Frontend - Tout le reste
      targetOrigin = FRONTEND_URL;
      targetUrl = new URL(url.pathname + url.search, FRONTEND_URL);
    }

    // Créer la nouvelle requête
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    // Ajouter des headers pour traçabilité
    modifiedRequest.headers.set('X-Forwarded-Host', url.hostname);
    modifiedRequest.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    // Faire la requête vers Clever Cloud
    let response = await fetch(modifiedRequest);

    // Clone pour pouvoir modifier les headers
    response = new Response(response.body, response);

    // Headers de sécurité
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS - Pas nécessaire car même origine, mais au cas où
    response.headers.set('Access-Control-Allow-Origin', url.origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    return response;
  }
};
```

**Cliquez sur "Save and Deploy"**

---

### Étape 3 : Configurer les variables d'environnement

1. Dans le Worker, aller sur **Settings** → **Variables**
2. Ajouter les variables :

```
FRONTEND_URL = https://app-yyyyyyyy.cleverapps.io
BACKEND_URL = https://app-xxxxxxxx.cleverapps.io
```

> ⚠️ **Important** : Remplacez par vos vraies URLs Clever Cloud

3. **Encrypt** (optionnel) et **Save**

---

### Étape 4 : Configurer le domaine custom

#### Option A : Utiliser workers.dev (test rapide)

Votre Worker est disponible sur : `https://gauzian-proxy.your-subdomain.workers.dev`

#### Option B : Utiliser votre domaine (production)

1. **Workers & Pages** → Votre worker → **Settings** → **Triggers**
2. **Add Custom Domain**
3. Entrer : `gauzian.com` ou `app.gauzian.com`
4. Cloudflare configure automatiquement le DNS et le SSL
5. Attendre 1-2 minutes pour la propagation

---

### Étape 5 : Ajouter le Rate Limiting (Optionnel mais recommandé)

Modifier le code du Worker :

```javascript
export default {
  async fetch(request, env, ctx) {
    const FRONTEND_URL = env.FRONTEND_URL || 'https://app-yyyyyyyy.cleverapps.io';
    const BACKEND_URL = env.BACKEND_URL || 'https://app-xxxxxxxx.cleverapps.io';

    const url = new URL(request.url);
    const clientIP = request.headers.get('CF-Connecting-IP');

    // Rate Limiting avec Cloudflare KV (nécessite un namespace KV)
    // Pour l'instant, on peut utiliser un système simple basé sur IP

    // Exemple simple : bloquer plus de 100 req/min par IP sur /api
    if (url.pathname.startsWith('/api')) {
      const rateLimitKey = `ratelimit:${clientIP}`;

      // Note: Nécessite un KV namespace pour la production
      // Pour un test simple, on peut juste logger
      console.log(`API Request from ${clientIP} to ${url.pathname}`);
    }

    // ... reste du code comme avant
    let targetUrl;
    let targetOrigin;

    if (url.pathname.startsWith('/api')) {
      targetOrigin = BACKEND_URL;
      const backendPath = url.pathname.replace('/api', '') || '/';  // /api/login → /login
      targetUrl = new URL(backendPath + url.search, BACKEND_URL);
    } else {
      targetOrigin = FRONTEND_URL;
      targetUrl = new URL(url.pathname + url.search, FRONTEND_URL);
    }

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    modifiedRequest.headers.set('X-Forwarded-Host', url.hostname);
    modifiedRequest.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
    modifiedRequest.headers.set('X-Real-IP', clientIP);

    let response = await fetch(modifiedRequest);
    response = new Response(response.body, response);

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
  }
};
```

---

## ⚙️ Configuration Clever Cloud à mettre à jour

### Frontend (gauzian_front)

**Variables d'environnement sur Clever Cloud :**
```bash
CC_DOCKERFILE=Dockerfile.frontend
NUXT_PUBLIC_API_URL=/api  # 👈 Important : chemin relatif, pas l'URL complète
NODE_ENV=production
```

> **Note** : Comme le Worker gère le routing, le frontend doit appeler `/api` (chemin relatif), pas une URL absolue.

### Backend (gauzian_back)

**Variables d'environnement sur Clever Cloud :**
```bash
CC_DOCKERFILE=Dockerfile.backend
DATABASE_URL=postgres://...
REDIS_URL=redis://...
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=gauzian
JWT_SECRET=...
RUST_LOG=gauzian_back=info
```

> **Note** : Pas besoin de configurer CORS car le Worker fait office de reverse proxy (même origine).

---

## 🧪 Test de l'installation

### 1. Tester le Worker

```bash
# Frontend
curl https://gauzian-proxy.your-subdomain.workers.dev/

# Backend API
curl https://gauzian-proxy.your-subdomain.workers.dev/api/health/ready
```

### 2. Tester depuis le navigateur

1. Ouvrir : `https://gauzian-proxy.your-subdomain.workers.dev`
2. Se connecter
3. Vérifier dans DevTools → Network que les requêtes API passent par `/api`

### 3. Vérifier les Analytics

1. Cloudflare Dashboard → **Workers & Pages** → Votre worker
2. **Metrics** : Voir le trafic, latence, erreurs
3. Gratuit et en temps réel !

---

## 🔒 Rate Limiting avancé (Production)

Pour un vrai rate limiting en production, utilisez **Cloudflare Rate Limiting Rules** :

1. **Security** → **WAF** → **Rate Limiting Rules**
2. **Create Rule**
3. Configuration exemple :

```
Rule Name: API Rate Limit
Expression: (http.request.uri.path contains "/api")
Requests: 100 requests per 1 minute
Action: Block
```

Ou utilisez **Cloudflare KV** pour un contrôle plus fin dans le Worker code.

---

## 📊 Monitoring

### Analytics inclus (gratuit)

- **Requests** : Nombre de requêtes
- **Success rate** : % de succès
- **Errors** : Erreurs 4xx/5xx
- **Duration** : Latence moyenne
- **CPU Time** : Temps de calcul

### Logs en temps réel

```bash
# Installer Wrangler CLI
npm install -g wrangler

# Login
wrangler login

# Voir les logs
wrangler tail gauzian-proxy
```

---

## 💰 Coûts

**Plan Gratuit (Workers Free) :**
- 100,000 requêtes/jour
- 10 ms CPU time par requête
- Largement suffisant pour commencer

**Plan Payant (Workers Paid - $5/mois) :**
- 10 millions de requêtes/mois incluses
- $0.50 par million supplémentaire
- 50 ms CPU time par requête

---

## 🎯 Checklist finale

- [ ] Worker créé et code déployé
- [ ] Variables `FRONTEND_URL` et `BACKEND_URL` configurées
- [ ] Domaine custom configuré (optionnel pour test)
- [ ] `NUXT_PUBLIC_API_URL=/api` sur Clever Cloud Frontend
- [ ] Test : Frontend accessible
- [ ] Test : Backend API accessible via `/api`
- [ ] Test : Login/upload fonctionnent
- [ ] Analytics configuré et vérifié

---

## 🆘 Troubleshooting

### Le Worker retourne 522 (Timeout)

**Cause** : Clever Cloud met trop de temps à répondre
**Solution** : Vérifier les logs Clever Cloud, augmenter les ressources

### CORS Errors

**Cause** : Le frontend utilise encore une URL absolue
**Solution** : Vérifier que `NUXT_PUBLIC_API_URL=/api` (pas d'URL complète)

### 404 sur /api

**Cause** : Le routing du Worker ne matche pas
**Solution** : Vérifier les logs du Worker : `wrangler tail gauzian-proxy`

---

## 📚 Ressources

- Documentation Cloudflare Workers : https://developers.cloudflare.com/workers/
- Wrangler CLI : https://developers.cloudflare.com/workers/wrangler/
- Rate Limiting : https://developers.cloudflare.com/workers/runtime-apis/kv/
- Support Cloudflare : https://community.cloudflare.com/

---

**Vous êtes prêt ! 🚀**

Une fois les URLs Clever Cloud obtenues, vous avez juste à :
1. Créer le Worker (5 min)
2. Mettre les URLs dans les variables
3. C'est tout !
