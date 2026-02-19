# TODO - GAUZIAN

Fichier de suivi des tâches et améliorations pour le projet GAUZIAN.

**Dernière mise à jour** : 2026-02-17

---

## 🔥 Priorité Haute

### 🔐 Sécurité & Architecture

- [ ] **Migrer le frontend vers Authorization headers** (Task #2)
  - **Contexte** : Actuellement le frontend utilise uniquement `credentials: 'include'` pour envoyer les cookies JWT. Pour une architecture REST moderne et sécurisée, il faut migrer vers Authorization headers.
  - **Estimation** : 2-3 heures
  - **Fichiers concernés** : ~15-20 fichiers dans `gauzian_front/app/composables/`
  - **Étapes** :
    1. Modifier `useAuth.js` pour stocker le token en mémoire (ref ou useState)
    2. Créer un helper `fetchWithAuth()` qui ajoute automatiquement le header
    3. Remplacer tous les `credentials: 'include'` par le helper
    4. Tester tous les endpoints (login, upload, download, share, etc.)
    5. Supprimer le support cookies côté backend (retirer Set-Cookie + fallback cookies dans `extract_token_from_headers`)
  - **Bénéfices** :
    - Architecture REST standard (Authorization header)
    - Protection CSRF naturelle (pas de cookies auto-envoyés)
    - Code plus simple (pas de double système)
    - Meilleure sécurité (explicit token passing)
  - **Documentation** : `gauzian_front/README.md`, `gauzian_back/src/auth/services.rs`
  - **Status** : ✅ Backend préparé (priorité Authorization header implémentée), ⏳ Frontend à migrer

---

## 📋 Priorité Moyenne

### 🔐 Sécurité

- [ ] **Implémenter des tokens de refresh** (optionnel)
  - **Contexte** : Actuellement les tokens JWT sont valides 10 jours. Pour une meilleure sécurité, on pourrait implémenter un système de refresh tokens avec des access tokens courts (15-30min).
  - **Estimation** : 4-6 heures
  - **Impact** : Meilleure sécurité (fenêtre d'exposition réduite en cas de vol de token)

- [ ] **Audit de sécurité complet avec OWASP ZAP**
  - **Contexte** : Tester l'application avec un scanner de vulnérabilités automatisé
  - **Estimation** : 2 heures
  - **Référence** : `docs/SECURITY_TESTING.md`

### 🚀 Performance

- [ ] **Optimiser le chargement des gros fichiers**
  - **Contexte** : Améliorer la performance pour les fichiers > 100MB
  - **Estimation** : 3-4 heures

- [ ] **Implémenter le cache Redis pour les métadonnées fréquentes**
  - **Contexte** : Réduire la charge sur PostgreSQL en cachant les métadonnées de dossiers/fichiers
  - **Estimation** : 2-3 heures

### 📊 Monitoring

- [ ] **Ajouter des alertes Prometheus**
  - **Contexte** : Configurer des alertes pour les métriques critiques (error rate, latency P95, DB pool exhaustion)
  - **Estimation** : 1-2 heures
  - **Documentation** : `gauzian_back/k8s/README.md`

---

## 📦 Priorité Basse

### ✨ Features

- [ ] **Implémenter la recherche globale dans Drive**
  - **Contexte** : Recherche full-text dans les noms de fichiers/dossiers
  - **Estimation** : 4-5 heures

- [ ] **Ajouter le support des favoris**
  - **Contexte** : Permettre de marquer des fichiers/dossiers comme favoris
  - **Estimation** : 2-3 heures

- [ ] **Implémenter la prévisualisation de fichiers**
  - **Contexte** : Prévisualisation inline pour images, PDFs, etc.
  - **Estimation** : 6-8 heures

### 🧹 Tech Debt

- [ ] **Refactoriser les composables Drive**
  - **Contexte** : `useFileActions.js` est trop gros (~1000 lignes), le découper en modules plus petits
  - **Estimation** : 3-4 heures

- [ ] **Améliorer la gestion d'erreurs frontend**
  - **Contexte** : Standardiser les messages d'erreur et les codes HTTP
  - **Estimation** : 2-3 heures

---

## ✅ Complété

### 2026-02-17

- [x] **Fix priorité Authorization header dans `extract_token_from_headers()`**
  - **Contexte** : Les tests de sécurité échouaient car le backend vérifiait les cookies avant le header Authorization
  - **Solution** : Inverser l'ordre de vérification (Authorization first, cookies fallback)
  - **Commit** : `fix(auth): Prioritize Authorization header over cookies in token extraction`
  - **Fichier** : `gauzian_back/src/auth/services.rs:81-104`
  - **Tests** : ✅ Tous les tests de sécurité passent (`tests/security/scripts/auth_bypass_test.py`)

- [x] **Implémenter le rate limiting pour prévenir les attaques brute-force**
  - **Contexte** : Aucune protection contre les attaques brute-force sur `/login`
  - **Solution** : Rate limiting Redis (5 tentatives max, 15min de blocage)
  - **Fichiers** : `gauzian_back/src/auth/services.rs`, `gauzian_back/src/auth/handlers.rs`
  - **Tests** : ✅ HTTP 429 après 5 tentatives échouées

- [x] **Renforcer la validation JWT**
  - **Contexte** : JWT acceptait des signatures invalides, algorithmes confus, tokens expirés
  - **Solution** : Configuration stricte de `jsonwebtoken::Validation`
  - **Fichier** : `gauzian_back/src/auth/services.rs:67-77`
  - **Tests** : ✅ Tous les tests de vulnérabilités JWT passent

- [x] **Créer une suite de tests de sécurité automatisés**
  - **Scripts** : `tests/security/scripts/auth_bypass_test.py`
  - **Couverture** : Signature tampering, algorithm confusion, expired tokens, logout bypass, brute-force
  - **Documentation** : `tests/README.md`

---

## 📝 Notes

- **Production** : https://gauzian.pupin.fr
- **Monitoring** : https://grafana.gauzian.pupin.fr
- **Documentation** : Voir `CLAUDE.md` pour la structure complète du projet
- **Journal de bord** : `DEVELOPMENT_LOG.md` (maintenir à jour après chaque modification)

---

## 🎯 Objectifs à Long Terme

- [ ] Support multi-utilisateurs avec gestion de quotas
- [ ] Application mobile (React Native)
- [ ] Sync offline (PWA avec Service Worker)
- [ ] Chiffrement de bout en bout pour l'agenda (déjà en développement)
- [ ] Partage de fichiers avec expiration automatique
- [ ] Audit logs pour la conformité RGPD
