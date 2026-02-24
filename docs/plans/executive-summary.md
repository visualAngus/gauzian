# Gauzian — Executive Summary

## Tagline

*Le Proton Drive français, accessible à tous*

---

## Le Problème

78 % des Français se déclarent préoccupés par la confidentialité de leurs données personnelles (CNIL 2023). Pourtant, le marché français du cloud stockage reste dominé par des acteurs américains ou sous juridiction étrangère — Google Drive, Dropbox, OneDrive — qui conservent l'accès aux fichiers de leurs utilisateurs. Les alternatives chiffrées existantes (Proton Drive, Tresorit) sont soit suisses et premium, soit réservées aux entreprises, laissant un vide : **aucune solution 100 % française, accessible au grand public, avec chiffrement de bout-en-bout (E2EE), et proposée à des tarifs abordables.**

---

## La Solution

Gauzian est un service de stockage cloud 100 % français avec chiffrement zero-knowledge. Le serveur n'a jamais accès au contenu des fichiers : le chiffrement s'effectue côté client (E2EE). Gauzian combine ainsi la confidentialité de Proton Drive avec une tarification accessible et un positionnement grand public.

**Architecture technique :**
- **Backend** : Rust (sécurité mémoire, performances natives)
- **Frontend** : Nuxt 3 / Vue 3 (TypeScript)
- **Infrastructure** : Docker + Kubernetes, VPS OVH France
- **E2EE** : RSA-4096 + AES-256-GCM, chiffrement client-side via Web Crypto API, zéro accès serveur

---

## Marché & Opportunité

Le marché mondial du cloud storage passe de **100 Mds$** (2023) à **190 Mds$** (2028), soit une croissance annuelle composée de 14 %. En France, la sensibilisation à la vie privée numérique s'accélère sous l'impulsion du RGPD et des scandales répétés autour des GAFA.

**Créneau vacant** : une solution E2EE, 100 % française, grand public, à tarifs accessibles.

| Segment | Taille FR | WTP |
|---------|-----------|-----|
| B2C (particuliers privacy-sensibles) | 2–3 M utilisateurs | €3–15/mois |
| B2B (PME secteurs sensibles) | 50 000 PME cibles | €8–20/user/mois |

---

## Positionnement Concurrentiel

| Critère | **Gauzian** | Proton Drive | Tresorit | CryptPad |
|---------|-------------|--------------|----------|----------|
| Origine | 🇫🇷 France | 🇨🇭 Suisse | 🇭🇺 Hongrie | 🇫🇷 France |
| E2EE véritable | ✅ | ✅ | ✅ | ✅ |
| 100% français | ✅ | ❌ | ❌ | ✅ |
| Grand public | ✅ | ✅ | ❌ | ⚠️ |
| Tarif entrée | **€3.99/mois** | €4.99/mois | Enterprise | €0 (50MB) |
| Stockage gratuit | 5 GB | 1 GB | ❌ | 50 MB |

---

## Modèle Économique

**Particuliers**

| Plan | Stockage | Prix/mois | Prix/an |
|------|----------|-----------|---------|
| Free | 5 GB | €0 | — |
| Solo | 50 GB | €3.99 | €35 |
| Plus | 200 GB + versioning 30j | €7.99 | €70 |
| Premium | 1 TB + famille 5 comptes + versioning 90j | €14.99 | €130 |
| Ultra | 3 TB + versioning 180j + support 24h | €24.99 | €220 |

**PME**

| Plan | Utilisateurs | Stockage | Prix/mois |
|------|--------------|----------|-----------|
| Starter | 10 | 500 GB + admin panel | €49 |
| Business | 50 | 2 TB + SSO + audit log + SLA 48h | €199 |
| Enterprise | Sur devis | Sur devis | Sur devis |

---

## Traction & Stade Actuel

- ✅ Backend Rust opérationnel (API Axum, Argon2id, JWT, Redis, PostgreSQL, S3)
- ✅ E2EE implémenté (RSA-4096 + AES-256-GCM, Web Crypto API, 725 lignes crypto.ts)
- ✅ Drive fonctionnel : upload/download chiffré, partage, permissions, corbeille
- ✅ Agenda E2EE (chiffrement des champs calendrier)
- ✅ Tests de sécurité et pentests en cours
- ✅ Infrastructure Docker + Kubernetes prête
- 🔄 **Stade** : prototype avancé / MVP final

---

## Roadmap 6 mois

```
M1          M2          M3          M4          M5          M6
|-----------|-----------|-----------|-----------|-----------|
[Finalisation MVP]  [Beta privée]  [Lancement public]  [Premium + PME]  [Bilan]
 Tests sécu          50-100 users   Product Hunt         SSO + admin       Décision
 Infra stable        Feedback loop  Free + Solo          panel             levée
```

---

## Projections Financières

**Scénario A — Bootstrapped (€0–50k)**

| Période | MRR | ARR |
|---------|-----|-----|
| M6 | €200 | — |
| M12 | €800 | €9 600 |
| M36 | €25 000 | €300 000 |

**Scénario B — Pré-seed €300k**

| Période | MRR | ARR |
|---------|-----|-----|
| M6 | €900 | — |
| M12 | €4 500 | €54 000 |
| M36 | €155 000 | €1 860 000 |

*Hypothèses : conversion Free→Payant 3–5%, ARPU particulier €8/mois, ARPU PME €120/mois*

---

## Équipe

**Fondateur (solo)** — Développeur expert Rust + Node.js/TypeScript + sécurité informatique + DevOps (Docker/k8s). Vision produit E2EE + expérience lancement SaaS.

---

## Besoin de Financement (Scénario B)

**Levée pré-seed cible : €300 000**

| Poste | Montant |
|-------|---------|
| Recrutement (1 dev + 1 growth/ops) | €140 000 |
| Infrastructure managée (Scaleway k8s + DB) | €15 000 |
| Marketing & acquisition | €30 000 |
| Juridique & conformité RGPD | €20 000 |
| Réserve opérationnelle | €95 000 |

---

## Contact

**Gauzian**
[Email] · [Site web] · [GitHub]

*Document confidentiel — Février 2026*
