# Gauzian — Suivi de la Session Étude de Marché & Business Plan

## Statut global
- Session démarrée le : 23 février 2026
- Horizon : MVP + premiers payants en 6 mois
- Fondateur : Solo (dev avancé, VPS OVH)
- Modèle : Freemium + abonnements particuliers + forfaits PME

## Fichiers produits

| Fichier | Statut | Description |
|---------|--------|-------------|
| `docs/plans/research/competitors.md` | ✅ Complet | Analyse concurrentielle (6 acteurs) + positionnement Gauzian |
| `docs/plans/market-study-and-business-plan.md` | ✅ Complet | Étude de marché + business plan (2 scénarios financiers 3 ans) |
| `docs/plans/executive-summary.md` | ✅ Complet | One-pager investisseurs (tarifaire + projections + roadmap) |
| `docs/plans/architecture-technique.md` | ✅ Complet | Architecture backend Rust + frontend Nuxt 3 + moteur E2EE |
| `docs/plans/research/hosting.md` | ✅ Complet | Benchmark hébergeurs FR (OVH vs Scaleway, scénarios coûts) |
| `docs/plans/pitch-deck.md` | ✅ Complet | Pitch deck 10 slides pour investisseurs |
| `docs/plans/progress.md` | ✅ Ce fichier | Journal de session + prochaines étapes |

## Dernières mises à jour — 2026-02-23

| Date | Fichiers créés/modifiés |
|------|------------------------|
| 2026-02-23 | `financial-pack.md` (174 lignes, ~8000 bytes) — Investor financial pack: assumptions, metrics (ARPU €8, CAC €30-40, LTV €240-400), unit economics, funding scenarios (bootstrapped vs €300k pre-seed), 3-year projections, sensitivity analysis, recommended actions |
| 2026-02-23 | `repo-map.md` (227 lignes, ~9500 bytes) — Single-file repo map: directory/file reference with paths, descriptions (1-3 lines), importance levels (High/Medium/Low), audience guide for Founder, DevOps, Security Auditor, Investor |
| 2026-02-23 | `infra-features.md` (413 lignes, 24109 bytes) — Document complet infrastructure et features |
| 2026-02-23 | `pitch-deck-gauzian.md` (214 lignes, 7654 bytes) — Header ajouté, sources, copy-edits applied |
| 2026-02-23 | `docs/plans/pitch-deck.md` (199 lignes, 7595 bytes) — Synchronisé avec pitch-deck-gauzian.md, note de sync ajoutée |
| 2026-02-23 | `docs/plans/landing-page.md` (77 lignes, 2740 bytes) — Created: Hero, Features, Pricing, Beta signup, Footer |
| 2026-02-23 | `docs/plans/press-contacts.md` (54 lignes, 3418 bytes) — Created: 10 contacts presse FR avec pitch suggestions |

---

## Archives — mises à jour précédentes

| Date | Fichiers créés/modifiés |
|------|------------------------|
| 2026-02-23 | `docs/plans/research/hosting.md` (197 lignes, 8517 bytes) — Benchmark hébergeurs FR (OVH vs Scaleway, scénarios coûts) |
| 2026-02-23 | `docs/plans/pitch-deck.md` (191 lignes, 6887 bytes) — Pitch deck 10 slides pour investisseurs |

## Journal des activités

- [✅] 2026-02-23 — Cadrage : objectif (création entreprise), modèle (Freemium), horizon (6 mois)
- [✅] 2026-02-23 — Recherche concurrents (Nextcloud, Proton, Tresorit, CryptPad, Cozy, Infomaniak)
- [✅] 2026-02-23 — Benchmark hébergeurs FR (OVH VPS, Scaleway managed k8s/DB/S3)
- [✅] 2026-02-23 — Rédaction competitors.md (tableau + fiches + positionnement)
- [✅] 2026-02-23 — Rédaction market-study-and-business-plan.md (794 lignes)
- [✅] 2026-02-23 — Rédaction executive-summary.md (one-pager 146 lignes)
- [✅] 2026-02-23 — Analyse architecture gauzianBack (Rust/Axum, auth, drive 32 routes, agenda, E2EE)
- [✅] 2026-02-23 — Analyse architecture gauzianFront (Nuxt 3, crypto.ts 725 lignes RSA-4096+AES-GCM)
- [✅] 2026-02-23 — Rédaction architecture-technique.md (336 lignes)
- [✅] 2026-02-23 — Rédaction research/hosting.md (OVH vs Scaleway, 3 jalons de croissance)
- [✅] 2026-02-23 — Rédaction pitch-deck.md (10 slides investisseurs pré-seed)

## Architecture technique résumée

### Backend (gauzianBack — Rust/Axum)
- 3 modules : auth/ (7 routes), drive/ (32 routes, permissions owner/editor/viewer), agenda/ (E2EE)
- Stack : Axum 0.8.8, SQLx/PostgreSQL, Redis (JWT blacklist), aws-sdk-s3, Argon2id, Prometheus
- Sécurité : JWT HttpOnly+Secure+SameSite, Argon2id passwords, Redis blacklist, upload chunké

### Frontend (gauzianFront — Nuxt 3 / Vue 3 / TypeScript)
- Pages : drive.vue, agenda.vue, login.vue, info.vue
- Moteur E2EE : crypto.ts (725 lignes) — RSA-4096 + AES-256-GCM + PBKDF2 310k iter via Web Crypto API
- Zero-knowledge : serveur ne voit jamais de données en clair

## Points forts produit (pour le business plan)
- ✅ E2EE véritable : RSA-4096 + AES-256-GCM, Web Crypto API native, zero-knowledge
- ✅ Agenda chiffré E2EE (titre, description, lieu)
- ✅ Partage E2EE : re-chiffrement AES key avec clé publique du destinataire
- ✅ Architecture k8s ready dès le MVP
- ✅ Stack Rust = sécurité mémoire compilateur, performances natives
- ✅ Hébergement France (OVH, certifié ISO 27001, ANSSI)

## Prochaines étapes opérationnelles

- [ ] Valider les grilles tarifaires avec tests utilisateurs (landing page A/B)
- [ ] Lancer beta privée (objectif : 50-100 users à M2)
- [ ] Constituer liste contacts presse FR (Next INpact, Numerama, Korben)
- [ ] Prendre RDV BPI France (prêt amorçage, JEI, iLab)
- [ ] Déposer marque "Gauzian" à l'INPI
- [ ] Rédiger CGU / Politique de Confidentialité RGPD
- [ ] Lancer SEO (articles "drive E2EE français", "alternative Dropbox RGPD")
- [ ] Envisager SecNumCloud (ANSSI) à M12-M18

## Notes de contexte (pour nettoyage session)

Ce fichier centralise tous les outputs de la session. En cas de nettoyage de contexte, lire ce fichier en priorité pour reprendre la session avec le plein contexte.

Clés de navigation :
- Business plan complet → `market-study-and-business-plan.md`
- Concurrents → `research/competitors.md`
- Infra → `research/hosting.md`
- Technique → `architecture-technique.md`
- Pitch → `pitch-deck.md`
- One-pager → `executive-summary.md`
