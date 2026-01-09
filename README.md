# GAUZIAN — Cloud souverain, zero-knowledge, haute performance

## Résumé
GAUZIAN est une initiative long-terme visant à construire une suite applicative cloud européenne, pensée d’abord pour les **particuliers** et les **petites entreprises**.

Le cœur de GAUZIAN est un **stockage chiffré de bout en bout (E2EE)** : le serveur ne voit jamais les contenus en clair (**zero-knowledge**). Le backend est développé en **Rust** afin de viser un haut niveau de sûreté et de performance.

Modèle visé : **freenium** (ex. **3 Go gratuits**) + offres payantes.

---

## Objectifs

### Souveraineté & hébergement
- Priorité à des **hébergeurs en France** et à une posture sécurité “by design”.
- Conformité **RGPD** et gouvernance des données alignée UE/France.

### Confidentialité
- **Zéro tracking** : pas de revente de données, pas de profilage publicitaire.
- **E2EE côté client** : chiffrement/déchiffrement réalisé par le client.
- **Zero-knowledge côté serveur** : le serveur stocke et sert des données chiffrées, sans accès au secret.

---

## Produits

### GAUZIAN ID — Identité & sessions
Un socle d’identité pour l’authentification et la gestion des sessions, conçu pour limiter l’exposition et isoler proprement les contextes.

### GZ DRIVE — Stockage de fichiers E2EE
Un moteur de stockage orienté performance, avec des flux I/O adaptés aux fichiers volumineux.

- **Chiffrement E2EE** : le serveur ne peut pas lire les fichiers.
- **Streaming** : upload/download efficaces sans explosion mémoire.
- **Partage** : conçu pour évoluer vers des mécanismes de partage compatibles E2EE.

### GZ MAIL — (mis en pause)
La brique mail est **mise de côté pour le moment** afin de concentrer l’effort sur la sécurité et le stockage.

---

## Architecture (aperçu)

### Pourquoi Rust
- Réduction des classes de vulnérabilités liées à la mémoire.
- Concurrence/latence adaptées aux services cloud.

### Stack (actuelle / cible)
- **Rust** (Edition 2021)
- **PostgreSQL** + **SQLx**
- Composants de sécurité selon besoins : hashing robuste, limitation de débit, etc.

---

## Sécurité & anti-abus

GAUZIAN vise une approche anti-abus efficace sans pratiques intrusives.

- **Rate limiting** et protections contextuelles contre le bruteforce/spam.
- **Isolation** et principe du moindre privilège.
- Objectif : réduire la surface d’attaque et les fuites de données (y compris côté serveur).

---

## Statut

Le projet a été **relancé récemment** pour renforcer l’architecture de sécurité (E2EE/zero-knowledge) et avance activement.

---

> **GAUZIAN** — souveraineté numérique, confidentialité réelle, performance native.
