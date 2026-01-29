# GAUZIAN — Cloud souverain, zero-knowledge, haute performance

[![Rust](https://img.shields.io/badge/Backend-Rust-orange?logo=rust)](https://www.rust-lang.org/)
[![Nuxt](https://img.shields.io/badge/Frontend-Nuxt%204-00DC82?logo=nuxt.js)](https://nuxt.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()
[![Status](https://img.shields.io/badge/Status-Active%20Development-green)]()

## 🎯 Vision

GAUZIAN est une initiative long-terme visant à construire une **suite applicative cloud européenne**, pensée d'abord pour les **particuliers** et les **petites entreprises**.

Le cœur de GAUZIAN est un **stockage chiffré de bout en bout (E2EE)** : le serveur ne voit jamais les contenus en clair (**zero-knowledge**). L'architecture évolue actuellement d'un **monolithe Rust** vers une **architecture microservices** pour une scalabilité et une maintenabilité optimales.

**Modèle économique** : Freemium (3 Go gratuits) + offres payantes.

---

## 🔐 Principes Fondamentaux

### Souveraineté & Hébergement
- 🇫🇷 **Hébergement exclusif en France** avec conformité RGPD stricte
- 🛡️ **Sécurité "by design"** : chaque composant est pensé pour la protection des données
- 📜 **Gouvernance alignée UE/France** : respect total de la législation européenne

### Confidentialité Zero-Knowledge
- 🚫 **Zéro tracking** : aucune revente de données, aucun profilage publicitaire
- 🔒 **E2EE côté client** : chiffrement/déchiffrement exclusivement par le client (RSA-4096 + AES-256-GCM)
- 👁️ **Zero-knowledge serveur** : le serveur ne voit que des données chiffrées, jamais le contenu en clair
- 🔑 **Clés non-extractables** : stockage sécurisé dans IndexedDB avec CryptoKey API

---

## 🚀 Produits & Services

### ✅ GAUZIAN ID — Identité & Sessions
Socle d'authentification robuste avec JWT + Redis pour la révocation de tokens.
- Argon2id pour le hachage des mots de passe
- Protection anti-bruteforce et rate limiting
- Gestion des sessions avec isolation par contexte

### ✅ GZ DRIVE — Stockage E2EE (En Production)
Moteur de stockage haute performance avec upload/download par chunks.

**Fonctionnalités actuelles :**
- ✅ Chiffrement E2EE : le serveur ne peut pas lire les fichiers
- ✅ Streaming optimisé : gestion de fichiers volumineux sans explosion mémoire
- ✅ Partage sécurisé : mécanisme de rechiffrement par destinataire avec propagation automatique
- ✅ Corbeille avec soft-delete
- ✅ Gestion des permissions granulaires (owner/editor/viewer)
- ✅ Architecture par chunks avec S3/MinIO backend
- ✅ Retry automatique avec backoff exponentiel

**Performances :**
- Upload/download avec retry automatique (3 tentatives)
- Health checks Kubernetes pour zero-downtime deployments
- Optimisation bande passante : endpoint minimal pour partage (réduction 80-95%)

### 🔜 GZ AGENDA — Organisation & Productivité (À venir)
**Prochain service en développement** : calendrier intelligent E2EE pour la gestion du temps et des rendez-vous.

**Fonctionnalités prévues :**
- 📅 Calendrier personnel chiffré de bout en bout
- 🤝 Partage d'événements avec rechiffrement par destinataire
- 🔔 Rappels et notifications
- 🔗 Intégration native avec GZ DRIVE pour les pièces jointes
- 🌐 Support CalDAV pour synchronisation avec clients tiers

### ⏸️ GZ MAIL — Messagerie Sécurisée (Mis en pause)
Service de mail chiffré (SMTP/IMAP) actuellement en pause pour concentrer les efforts sur le stockage et l'agenda.

---

## 🏗️ Architecture

### Transition vers les Microservices

**Architecture actuelle (Monolithe Rust)** :
```
┌─────────────────────────────────────┐
│     Axum Backend (Rust)             │
│  ┌──────────┬──────────┬─────────┐  │
│  │   Auth   │  Drive   │  Contacts│ │
│  └──────────┴──────────┴─────────┘  │
│         PostgreSQL + Redis           │
└─────────────────────────────────────┘
```

**Architecture cible (Microservices)** :
```
┌──────────────────────────────────────────────┐
│          API Gateway (Traefik)               │
└────┬─────────┬──────────┬──────────┬────────┘
     │         │          │          │
┌────▼────┐ ┌─▼──────┐ ┌─▼──────┐ ┌─▼────────┐
│ Auth    │ │ Drive  │ │ Agenda │ │ Contacts │
│ Service │ │ Service│ │ Service│ │ Service  │
└────┬────┘ └─┬──────┘ └─┬──────┘ └─┬────────┘
     │        │           │           │
     └────────┴───────────┴───────────┘
              Shared PostgreSQL
              Shared Redis
```

**Avantages de la transition :**
- 🔄 **Scalabilité indépendante** : chaque service peut scaler selon ses besoins
- 🛠️ **Déploiement isolé** : mise à jour d'un service sans affecter les autres
- 🧪 **Tests simplifiés** : isolation des responsabilités
- 🚀 **Développement parallèle** : équipes indépendantes par service
- 🔒 **Sécurité renforcée** : isolation des données par service

### Stack Technique

**Backend :**
- 🦀 **Rust** (Edition 2021) avec Axum framework
- 🔐 **SQLx** pour des requêtes SQL vérifiées à la compilation
- 🗄️ **PostgreSQL** pour les métadonnées chiffrées
- ⚡ **Redis** pour la révocation de tokens et le cache
- 📦 **MinIO/S3** pour le stockage des chunks chiffrés

**Frontend :**
- ⚡ **Nuxt 4** (Vue 3) avec TypeScript
- 🔐 **Web Crypto API** pour le chiffrement client-side
- 💾 **IndexedDB** pour le stockage sécurisé des clés

**Infrastructure :**
- 🐳 **Docker** + **Kubernetes** (déploiement production)
- 🔄 **Traefik** comme reverse proxy avec Let's Encrypt automatique
- 📊 **Prometheus** + **Grafana** (monitoring prévu)

### Cryptographie

- **Échange de clés** : RSA-4096 (OAEP padding)
- **Chiffrement fichiers/métadonnées** : AES-256-GCM (nonce unique par opération)
- **Dérivation de clés** : PBKDF2 avec 310,000 itérations (OWASP 2024)
- **Hachage mots de passe** : Argon2id (PHC format)
- **Stockage clés** : CryptoKey API avec clés non-extractables

---

## 🛡️ Sécurité & Anti-abus

### Mesures Implémentées

- ✅ **IDOR Protection** : vérification d'ownership sur tous les endpoints sensibles
- ✅ **Rate Limiting** : protection contre bruteforce et spam
- ✅ **Token Revocation** : blacklist Redis pour invalidation instantanée
- ✅ **Fail-Closed** : en cas d'erreur Redis, authentification refusée (pas de bypass)
- ✅ **SQL Injection** : requêtes paramétrées via SQLx (compile-time checking)
- ✅ **Secure Cookies** : flags `Secure`, `HttpOnly`, `SameSite=Strict`
- ✅ **Health Checks** : probes Kubernetes pour zero-downtime deployments
- ✅ **Audit Logging** : tous les accès sensibles sont tracés

### Tests de Sécurité

Des tests de sécurité exhaustifs (SQLMap, k6 load testing) ont été réalisés et passés avec **succès** sur l'ensemble des endpoints de l'API. Les résultats démontrent la robustesse de l'architecture face aux attaques courantes (injection SQL, IDOR, bruteforce).

---

## 📊 Statut du Projet

### Phase Actuelle : **Production Beta**

**Disponible maintenant :**
- ✅ GZ DRIVE avec partage E2EE et gestion des permissions
- ✅ Infrastructure Kubernetes avec health checks
- ✅ Tests de sécurité automatisés

**En cours de développement :**
- 🔄 Transition vers architecture microservices
- 🔄 GZ AGENDA (calendrier E2EE)
- 🔄 Interface de gestion des partages (révocation d'accès)

**Roadmap 2026 :**
- Q1 : Finalisation microservices + lancement GZ AGENDA beta
- Q2 : Système de notifications E2EE
- Q3 : Application mobile (React Native)
- Q4 : Version 1.0 stable + offres payantes

---

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** : Guide pour Claude Code (structure projet)
- **[DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)** : Journal de développement détaillé
- **[SECURITY_TESTING.md](SECURITY_TESTING.md)** : Guide de test de sécurité
- **Backend** : `gauzian_back/CLAUDE.md`
- **Frontend** : `gauzian_front/CLAUDE.md`

---

## 🤝 Contribution

Le projet est actuellement en développement privé. Les contributions seront ouvertes lors de la version 1.0.

---

## 📜 Licence

Propriétaire © 2026 GAUZIAN. Tous droits réservés.

---

> **GAUZIAN** — La souveraineté numérique n'est pas un slogan, c'est quelque chose que l'on construit, ligne par ligne.
