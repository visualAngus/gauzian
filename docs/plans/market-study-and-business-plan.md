# Étude de Marché et Plan d'Affaires — Gauzian

## Résumé Exécutif

### Vision Produit

**Gauzian** est le premier service de stockage cloud 100% français proposant un chiffrement de bout en bout (E2EE ou End-to-End Encryption) accessible au grand public et aux petites et moyennes entreprises. La proposition de valeur fondatrice peut se résumer ainsi : « Tes fichiers, chiffrés, sur des serveurs français. Même nous ne pouvons pas les lire. »

Dans un contexte où les données des utilisateurs français sont massivement hébergées sur des clouds américains (Google Drive, Apple iCloud, Microsoft OneDrive, Dropbox) et où les affaires Snowden, PRISM, Schrems II et le Cloud Act ont révélé les failles de protection, Gauzian répond à un besoin croissant de souveraineté numérique. Le fondateur propose une Alternative française crédible, sécurisée et accessible financièrement.

### Problème Résolu

Les particuliers et les PME françaises font face à un dilemme cornélien lorsqu'il s'agit de stocker leurs données dans le cloud. D'un côté, les solutions américaines grand public (Google Drive, iCloud, Dropbox) offrent une expérience utilisateur irréprochable, une capacité de stockage généreux, et des tarifs imbattables. Mais ces solutions impliquent le stockage des données sur des serveurs soumis au droit américain (Cloud Act), avec un chiffrement qui n'est pas de bout en bout et qui permet au prestataire d'accéder au contenu des fichiers.

De l'autre côté, les solutions E2EE existantes (Proton Drive, Tresorit) offrent un niveau de sécurité maximal mais présentent des limitations significatives : tarifs élevés (Proton), orientation exclusively enterprise (Tresorit), absence d'hébergement français, ou complexité technique (Nextcloud auto-hébergé). Le marché français manque cruellement d'une solution offrant simultanément le chiffrement de bout en bout, l'hébergement en France, et un tarif accessible au grand public.

### Solution Proposée

Gauzian combine trois éléments jusqu'alors disjoints sur le marché français :

1. **Chiffrement E2EE véritable** — Zéro accès serveur aux données (modèle zero-knowledge), clés de chiffrement générées et gérées exclusivement côté client, chiffrement AES-256 pour les fichiers, pas de métadonnées exposées
2. **Hébergement 100% français** — Serveurs exclusively situés en France (OVH), conformité native avec la doctrine cloud de confiance ANSSI, pas de risque d'extraterritorialité juridique
3. **Accessibilité tarifaire** — Offre gratuite limitée (5 Go), tarifs grand public starting à €3.99/mois, forfaits PME starting à €49/mois, rapport qualité-prix compétitif avec les solutions non-E2EE

### Cibles

- **Grand public (B2C)** : Particuliers français soucieux de leur vie privée, utilisateurs intensifs de cloud (photos, documents personnels, sauvegardes), professionnels indépendants
- **PME françaises (B2B)** : Petites et moyennes entreprises (5-250 salariés) dans les secteurs sensibles (santé, droit, finance, comptabilité, ressources humaines, conseil), contraintes par le RGPD et la confidentialité client

### Modèle Économique

Le modèle économique repose sur un approche Freemium éprouvée dans le SaaS :

- **Offre gratuite** : 5 Go, 1 appareil, fonctions de base, pour attirer et convertir les utilisateurs
- **Abonnements particuliers** : 4 plans (Solo €3.99/mois, Plus €7.99/mois, Premium €14.99/mois, Ultra €24.99/mois) avec stockage croissant, fonctionnalités avancées, et support différencié
- **Forfaits PME** : 3 niveaux (Starter €49/mois, Business €199/mois, Enterprise sur devis) avec stockage partagé, fonctionnalités d'administration, et SLA

### Stade Actuel du Projet

Le développement est avancé. Le fondateur, développeur solo, a constitué un prototype fonctionnel avec les briques techniques suivantes :

- **Backend** : Langage Rust, reconnu pour sa sécurité mémoire et ses performances natives, choix stratégique pour un produit centré sur la sécurité
- **Frontend** : Node.js avec framework moderne, interface web responsive, applications mobiles et desktop à venir
- **Infrastructure** : Docker pour la conteneurisation, Kubernetes (k8s) pour l'orchestration et la scalabilité, actuellement sur VPS OVH
- **Sécurité** : Tests E2EE en cours, architecture zero-knowledge validée conceptuellement

Le prototype est opérationnel pour les fonctionnalités core (upload, download, chiffrement/déchiffrement client-side). Les 6 prochains mois seront consacrés à la finalisation du MVP, aux tests de sécurité, au lancement beta, et à l'acquisition des premiers utilisateurs payants.

### Équipe

Le fondateur est un développeur expérimenté avec expertise en sécurité informatique et en développement back-end et front-end. C'est un profil rare combinant compétences techniques (Rust, Node.js, k8s) et vision produit. La structure juridique envisagée est une SASU (Société par Actions Simplifiée Unipersonnelle), adaptée au démarrage solo avec flexibilité pour une levée de fonds ultérieure.

### Besoin de Financement

Deux scénarios sont envisageables selon l'ambition et le rythme de croissance souhaités :

**Scénario A — Bootstrapped (€0-50k)** : Approche minimale viable, coûts maîtrisés, croissance organique privilégiée.break-even visé à M18-24. Convient si le fondateur privilégie l'indépendance et la validation produit avant d'engager des fonds externes.

**Scénario B — Pré-seed (€200k-500k)** : Accélération de la croissance, recrutement de 2 personnes (développeur + growth/ops), marketing paid, infrastructure managée. Croissance plus rapide, MRR cible €155k à M36. Convient si le founder vise une part de marché significative avant l'entrée de concurrents.

### Horizon

Le délai de mise sur le marché est fixé à 6 mois, avec les jalons suivants :

- **M0-M1** : Finalisation MVP, tests sécurité, infrastructure stable
- **M2** : Beta privée (50-100 utilisateurs), feedback loop
- **M3** : Lancement public, offre gratuite + Solo actifs
- **M4-M5** : Déploiement plans premium et offre PME
- **M6** : Bilan, décision levée de fonds, préparation scaling

---

## Partie 1 — Étude de Marché

### 1.1 Contexte et Macro-tendances

#### Croissance du Marché Mondial du Cloud Storage

Le marché mondial du stockage cloud connaît une expansion soutenue et devrait nearly doubler sur la période 2023-2028. Les projections de Gartner et IDC estiment une croissance du marché global du cloud storage de aproximadamente $100 milliards en 2023 à $190 milliards en 2028, avec un taux de croissance annuel composé (CAGR) d'environ 14%. Cette croissance est portée par la digitalisation accélérée post-COVID, la proliferation des objets connectés générant toujours plus de données, et la migration des entreprises vers le cloud.

Le segment du stockage cloud sécurisé (chiffrement, conformité) croît plus rapidement que le marché global, dopé par les réglementations (RGPD, HIPAA, CCPA) et les scandales繰り返し (Cambridge Analytica, violations de données chez Facebook, Google). Les entreprises allouent un budget croissant à la sécurité des données, ce qui crée une opportunité pour les offreurs de solutions E2EE.

#### Contexte Français : Souveraineté Numérique

La France compte 68 millions d'habitants, 38 millions d'internautes actifs, et environ 3,4 millions de petites et moyennes entreprises. Le pays dispose d'un écosystème tech dynamique, d'une tradition de protection des données personnelles (CNIL, précurseur mondial), et d'une volonté politique affirmée de souveraineté numérique.

La doctrine cloud de confiance de l'ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information), publiée en 2021 et mise à jour en 2022, définit des exigences strictes pour les systèmes d'information sensibles des administrations et des opérateurs d'importance vitale. Le label « SecNumCloud » certifie les prestataires cloud respectant ces exigences. Bien que ce label soit principalement destiné aux grandes infrastructures, il témoigne d'une Direction politique claire : favoriser un cloud européen et français.

#### Événements Catalyseurs

Plusieurs événements ont sensibilisé le grand public et les entreprises françaises aux enjeux de souveraineté et de protection des données :

- **Affaire Snowden (2013)** : Révélations sur les programmes de surveillance massifs de la NSA américaine, dont PRISM permettant l'accès aux données des utilisateurs de Google, Facebook, Apple, Microsoft
- **Invalidation du Safe Harbor (2016)** : La Cour de Justice de l'Union européenne invalide l'accord Safe Harbor encadrant le transfert de données UE-États-Unis
- **Arrêt Schrems II (2020)** : Invalidation du Privacy Shield, imposant aux entreprises de mettre en place des mécanismes complémentaires pour justifier les transferts de données vers les États-Unis
- **Cloud Act (2018)** : Loi américaine permettant aux autorités fédérales de demander à toute entreprise américaine (y compris ses filiales européennes) de communiquer des données, sans necessarily notifier l'utilisateur concerné
- **Sanctions RGPD croissantes** : Amazon (€746M en 2022), Meta (€1,2Md cumulés), Google (milliers de millions), WhatsApp — les amendes démontrent la réalité des risques
- **Crise sanitaire COVID-19** : Accélération massive du télétravail, explosion de l'usage des outils numériques, prise de conscience collective de la dépendance aux plateformes américaines

#### Tendances de Fond

Plusieurs tendances de fond soutiennent la demande pour des solutions E2EE :

- **Maturité grand public du E2EE** : Les technologies de chiffrement, longtemps réservées aux experts, sont désormais mainstream (Signal pour la messagerie, ProtonMail pour les emails, Tor pour la navigation). Les utilisateurs comprennent et valorisent le concept de « zero-knowledge »
- **Zéro Trust** : Le modèle de sécurité « zero trust » (ne faire confiance à aucune entité par défaut) gagne les entreprises et influence les critères d'achat de solutions cloud
- **Sensibilité post-COVID** : La массification du télétravail a élargi la surface d'attaque et la conscience des risques cyber
- **Souveraineté numérique** : Le concept devient mainstream, porté par les médias, les politiques, et les entreprises elles-mêmes

### 1.2 Segmentation du Marché

#### Segment B2C (Particuliers)

**Taille du marché en France :** Environ 10 à 15 millions de Français utilisent un service de stockage cloud personnel, principalement Google Drive (inclus avec le compte Gmail), Apple iCloud (inclus avec les appareils Apple), Microsoft OneDrive (inclus avec Microsoft 365), et Dropbox. Ce chiffre inclut les utilisateurs actifs (qui utilisent régulièrement le service) et les utilisateurs passifs (qui ont un compte mais n'utilisent pas activement le service).

**Marché addressable (SAM) :** Gauzian cible en priorité les 2 à 3 millions d'utilisateurs français « privacy-sensibles », c'est-à-dire ceux qui :

- Sont préoccupés par la protection de leurs données personnelles (sondage CNIL 2023 : 78% des Français)
- Cherchent une alternative aux GAFAM sans nécessairement être des experts techniques
- Sont prêts à payer un supplément pour un service européen ou français
- Ont des besoins spécifiques : professionnels indépendants, journalistes, militants, parents soucieux des données de leurs enfants, professions libérales

**Willingness to pay :** Les études de marché et les benchmarks concurrentiels suggèrent une propension à payer de €3 à €15 par mois pour un service de qualité avec E2EE. Cette fourchette est cohérente avec les tarifs de Proton Drive (€4.99-9.99/mois) et les offres premium des GAFAM (iCloud+ 200Go à €2.99/mois, Google One 100Go à €1.99/mois — mais ces derniers ne sont pas E2EE).

#### Segment B2B (PME Françaises)

**Taille du marché en France :** La France compte environ 3,4 millions de PME (au sens de la définition européenne : moins de 250 salariés et moins de €50M de chiffre d'affaires), dont environ 150,000 entreprises de 10 salariés ou plus. Ces entreprises constituent le cœur de cible B2B de Gauzian.

**Marché addressable (SAM) :** Gauzian cible en priorité les 50,000 PME françaises actives dans les secteurs suivants :

- Santé (médecins, infirmiers, cliniques, Laboratoires, éditeurs de logiciels santé) — soumises au secret professionnel et potentiellement à la certification HDS
- Juridique (avocats, notaires, huissiers, offices notariaux) — soumises au secret professionnel et à la déontologie
- Finance et comptabilité (cabinets comptables, experts-comptables, conseillerings financiers) — données financières sensibles de leurs clients
- Ressources humaines (cabinets de recrutement, gestionnaires de paie) — données personnelles des salariés
- Conseil et expertise (conseillers en stratégie, consultants, auditeurs) — données stratégiques de leurs clients
- Associations et ONG — données personnelles de leurs membres et donateurs

**Willingness to pay :** Les PME françaises du segment ciblé sont disposées à payer entre €8 et €20 par utilisateur et par mois pour une solution managée sécurisée et conforme RGPD. Cette fourchette est cohérente avec les tarifs de Tresorit (€20+/utilisateur/mois) en entrée de gamme et les budgets typiques alloués à la stack logicielle (la plupart des PME françaises dépensent entre €50 et €200/mois en logiciels).

### 1.3 Analyse de la Demande

#### Données Consommateurs

Les enquêtes et sondages convergent vers une préoccupation majeure des Français pour la protection de leurs données personnelles :

- **Baromètre confiance numérique CNIL 2023** : 78% des Français se déclarent préoccupés par la protection de leurs données personnelles sur Internet
- **Sondage IFOP 2023** : 60% des Français ne font pas confiance aux entreprises américaines (Google, Facebook, Amazon, Apple, Microsoft) pour protéger leurs données personnelles
- **Étude Deloitte 2023** : 67% des consommateurs français seraient prêts à changer de service si leur fournisseur actuel était reconnu coupable d'une violation de données
- **Rapport INSEE 2024** : 82% des ménages français utilisent Internet pour gérer leurs documents administratifs (impôts, santé, retraite), un usage sensible

#### Données Entreprises

Le segment B2B présente des drivers de demande structurels :

- **Rapport CESIN 2023** : 45% des entreprises françaises ont été victimes d'une cyberattaque en 2023, dont une partie par l'exploitation de données cloud mal sécurisées
- **Enquête AMRAE 2024** : La cybersécurité est devenue le premier risque identifié par les dirigeants d'entreprise français, devant les risques financiers et environnementaux
- **Obligations RGPD** : Les entreprises doivent démontrer une « sécurité appropriée » des données personnelles (article 32 RGPD), ce qui inclut potentiellement le chiffrement
- **Marchés publics** : De plus en plus d'appels d'offres publics exigent un hébergement en France et une conformité RGPD stricte

#### Opportunité Réglementaire

Le cadre réglementaire français et européen crée plusieurs opportunités :

- **RGPD** : Règlementation contraignante avec sanctions pouvant atteindre 4% du chiffre d'affaires mondial, pousse les entreprises à sécuriser leurs traitements
- **Directive NIS2** : Élargit les obligations de cybersécurité aux PME dans les secteurs critiques
- **Certification HDS** : Pour les hébergeurs de données de santé, ouvre l'accès au marché de la santé numérique
- **Marchés publics** : Exigences croissantes de souveraineté (hébergeur français, clause de résidence des données)

### 1.4 Analyse Concurrentielle

#### Vue d'Ensemble des Concurrents

Le marché du stockage cloud E2EE en France peut être segmenté selon deux axes : le niveau de chiffrement (server-side vs client-side/E2EE) et l'accessibilité (expert/pro vs grand public). Cette analyse fait l'objet d'un document dédié (`competitors.md`) mais une synthèse est présentée ici.

#### Map Concurrentielle

| | Server-side encryption | Client-side E2EE |
|---|---|---|
| **Expert / Pro** | Nextcloud (self-hosted) | Tresorit, CryptPad (enterprise) |
| **Grand public** | kDrive, Cozy/Twake | Proton Drive (Suisse), Gauzian (positionnement cible) |

#### Synthèse Concurrentielle

Le créneau visé par Gauzian — **E2EE + France + Abordable + Grand public** — est actuellement vacant :

- **Proton Drive** propose l'E2EE et la qualité, mais est suisse (pas français) et Positionné premium
- **Tresorit** propose l'E2EE et la conformité, mais est exclusively enterprise (€20+/utilisateur/mois)
- **Nextcloud** propose le contrôle et l'open-source, mais nécessite des compétences techniques
- **CryptPad** est français et E2EE, mais-orientation collaboration (pas stockage pur)
- **kDrive** est suisse et abordable, mais n'a pas d'E2EE (server-side only)
- **Cozy/Twake** est français, mais n'a pas d'E2EE et cible principalement les entreprises

### 1.5 Analyse SWOT

#### Forces (Strengths)

1. **Vrai E2EE** — Chiffrement client-side avec architecture zero-knowledge, même les administrateurs ne peuvent pas accéder aux données des utilisateurs
2. **100% français** — Hébergement, entreprise, juridique, langue — un différenciateur fort dans le contexte de souveraineté
3. **Prix accessible** — Segmentation tarifaire pensée pour le grand public (€3.99/mois) et les PME (€49/mois), compétitive vs les alternatives non-E2EE
4. **Stack moderne** — Rust pour le backend (sécurité, performance), Node.js pour le frontend, k8s pour la scalabilité
5. **Fondateur expert** — Compétences techniques rares (Rust + sécurité + full-stack), vision produit claire, coût marginal nul

#### Faiblesses (Weaknesses)

1. **Solo founder** — Limitation des ressources, absence de regard externe, charge de travail considérable
2. **Notoriété nulle** — Absence de brand awareness, difficulté d'acquisition initiale, absence de crédibilité établie
3. **Support limité** — En phase initiale, absence d'équipe support dédiée, risque d'insatisfaction client
4. **Fonctionnalités réduites** — MVP focalisé sur l'essentiel, moins de fonctionnalités que les acteurs établis
5. **Capitaux limités** — Contrainte budget, impossibilité de rivaliser en marketing paid avec les GAFAM

#### Opportunités (Opportunities)

1. **Réglementation favorable** — RGPD, doctrine ANSSI, exigences de souveraineté créent une demande structurelle
2. **Sensibilité croissante** — Post-Snowden, post-Schrems II, post-COVID, les utilisateurs sont plus conscients des enjeux
3. **Marché PME sous-équipé** — Les PME françaises sont souvent mal servies par les solutions E2EE (trop chères ou trop complexes)
4. **Maturité E2EE grand public** — Les technologies sont prêtes, les utilisateurs comprennent le concept, les outils sont thérapeut
5. **Absence de concurrent français** — Le créneau E2EE + France + Abordable est vacant et attend un acteur

#### Menaces (Threats)

1. **Concurrents bien financés** — Proton lève des fonds massivement, Tresorit a les moyens de Swiss Post, les GAFAM peuvent intégrer l'E2EE
2. **Manque de confiance nouveaux acteurs** — Les utilisateurs ont plutôt tendance à faire confiance aux marques établies
3. **Coûts d'infrastructure croissants** — Le stockage cloud a des économies d'échelle défavorables aux petits acteurs
4. **Complexité réglementaire** — Évolution des normes, exigences de certification, coût de la conformité
5. **Évolutions technologiques** — Quantique pourrait rendre certains chiffrements obsolètes, nécessite veille active

### 1.6 Analyse des 5 Forces de Porter

#### Pouvoir des Fournisseurs

**Évaluation : Faible**

Le marché des fournisseurs d'infrastructure cloud est concurrentiel avec peu de barrières à changer de prestataire. OVH et Scaleway sont les leaders français, avec des alternatives européennes (Exoscale, Clever Cloud) et mondiales (AWS, Google Cloud, Azure). En cas de hausse des tarifs ou de dégradation de service, Gauzian peut migrer vers un autre provider sans friction excessive. Le seul élément captif est le numéro AS (autonomous system) et la réputation « cloud français », mais plusieurs acteurs peuvent répondre à ce critère.

#### Pouvoir des Clients

**Évaluation : Modéré**

Les clients ont un pouvoir de négociation limité individuellement (particuliers) mais peuvent l'exercer collectivement (avis, réseaux sociaux). Le coût de changement (switching cost) est modéré : exporter des données d'un cloud à un autre prend du temps mais reste techniquement possible. Une fois les données sur Gauzian, les utilisateurs développent une dépendance positive (effets de réseau marginaux). La sensibilité au prix est variable selon les segments.

#### Nouveaux Entrants

**Évaluation : Faible à modéré**

La barrière technique pour lancer un service de stockage cloud est relativement faible (APIs object storage, solutions clé en main), mais la barrière de confiance et de réputation est très élevée. Les nouveaux entrants doivent prouver leur sécurité, leur fiabilité, et leur longévité — des要素 difficiles à établir pour un acteur inconnu. Le temps nécessaire pour atteindre une taille critique (plusieurs centaines de milliers d'utilisateurs) représente également une barrière temporelle.

#### Produits de Substitution

**Élevé — Nombreux substituts**

Les utilisateurs peuvent choisir de ne pas utiliser de service cloud dédié : stockage sur disque dur externe, NAS personnel, serveur auto-hébergé. Les GAFAM offrent des alternatives « good enough » avec une meilleure UX et des tarifs plus bas, bien que sans E2EE. La valeur ajoutée de Gauzian (E2EE + France + Abordable) doit être suffisamment claire pour justifier le choix.

#### Rivalité Concurrentielle

**Forte sur le segment B2C, Modérée sur le segment E2EE niche**

Sur le marché global du stockage cloud, la rivalité est intense (GAFAM, Dropbox, Box). Sur le segment spécifique E2EE avec hébergement européen, la rivalité est plus modérée (Proton, Tresorit, CryptPad). Gauzian doit éviter l'affrontement direct avec les GAFAM et plutôt se différencier sur la valeur (sécurité, souveraineté).

---

## Partie 2 — Produit et Positionnement

### 2.1 Description du Produit

#### Définition

**Gauzian** est un service de stockage cloud (drive) sécurisé avec chiffrement de bout en bout (E2EE), hébergé à 100% en France, et accessible au grand public comme aux petites et moyennes entreprises.

#### Fonctionnalités MVP

Le produit minimum viable (MVP) inclut les fonctionnalités core nécessaires à une proposition de valeur crédible :

1. **Upload et download chiffrés** — Les fichiers sont chiffrés localement sur l'appareil de l'utilisateur avant transmission au serveur. Le déchiffrement s'effectue également localement lors du téléchargement. Le serveur ne voit que des données chiffrées illisibles.

2. **Gestion des clés de chiffrement** — Chaque utilisateur génère sa propre clé privée (ou phrase de chiffrement) qui ne quitte jamais son appareil. Le serveur stocke uniquement les clés publiques et les données chiffrées. La perte de la phrase de chiffrement équivaut à une perte permanente des données.

3. **Interface web intuitive** — Une application web responsive permettant d'uploader, parcourir, télécharger, et organiser ses fichiers dans une arborescence de dossiers. Design épuré, fluide, accessible sur mobile et desktop.

4. **Partage sécurisé** — Création de liens de partage chiffrés avec options de protection : mot de passe, date d'expiration, limite de téléchargements. Le lien permet au destinataire de déchiffrer le fichier sans que le serveur n'intervienne.

5. **Synchronisation multi-appareils** — Synchronisation automatique des fichiers entre les appareils de l'utilisateur (ordinateur fixe, ordinateur portable, smartphone). Les fichiers modifiés localement sont chiffrés et uploadés automatiquement.

#### Fonctionnalités Différenciantes (Roadmap)

Au-delà du MVP, les fonctionnalités suivantes distinguent Gauzian des concurrents :

1. **Zéro accès serveur aux données** — Architecture truly zero-knowledge, auditée et vérifiable. Pas de métadonnées暴露 (noms de fichiers, dates, taille) sur le serveur.

2. **Gestion des clés locales ou HSM** — Option avancée pour les utilisateurs experts de gérer leurs clés dans un HSM (Hardware Security Module) ou un gestionnaire de clés externe.

3. **Audit log E2EE** — Journal d'activité chiffré permettant aux administrateurs PME de suivre les accès aux fichiers sans compromettre la confidentialité.

4. **Conformité RGPD native** — Droit à l'effacement automatisé, portabilité des données (export chiffré), gestion des consentements, registre des traitements.

5. **Intégrations natives** — Connecteurs pour import depuis Google Drive, Dropbox, OneDrive, et export vers les outils bureautiques.

#### Stack Technique

Le choix de la stack technique reflète les priorités du projet : sécurité, performance, maintenabilité, et scalabilité.

**Backend — Rust :** Le langage Rust a été choisi pour ses propriétés uniques de sécurité mémoire (pas de buffer overflows, pas de null pointer dereferences), ses performances comparables au C/C++, et son système de types puissant. Rust est de plus en plus adopté pour les systèmes critiques et les produits de sécurité. Le backend Gauzian gère le stockage objet, l'authentification, la gestion des métadonnées (chiffrées), et les APIs.

**Frontend — Node.js :** Le frontend web utilise Node.js avec un framework moderne (React ou Vue.js), permettant une interface réactive et une expérience utilisateur fluide. Les applications mobiles (iOS, Android) et desktop (Windows, macOS, Linux) seront développées en parallèle ou en aval.

**Infrastructure — Docker + Kubernetes :** Docker assure la conteneurisation des services pour un déploiement reproductible et une isolation. Kubernetes (k8s) orchestrent les conteneurs, gèrent le scaling automatique, et permettent une haute disponibilité. L'infrastructure est actuellement sur VPS OVH (au départ), avec possibilité de migrer vers un cluster managé (Scaleway, OVHcloud Managed k8s) à mesure que la charge augmente.

**Hébergement — OVHcloud :** OVHcloud est le leader européen de l'hébergement, avec des data centers en France (Roubaix, Gravelines, Strasbourg, Paris), une certification SecNumCloud en cours, et des tarifs compétitifs. OVH offre des garanties de résidence des données en France, essentielles pour la proposition de valeur Gauzian.

### 2.2 Proposition de Valeur

#### Pour le Grand Public

**Positionnement :** « Tes fichiers, chiffrés, sur des serveurs français. Même nous ne pouvons pas les lire. »

Cette phrase capte l'essence de la proposition : protection des données personnelles (chiffrement), hébergement national (servers français), et transparence (nous ne pouvons pas lire vos données). C'est un message clair, accessible, et différenciant.

**Bénéfices utilisateurs :**

- **Tranquillité d'esprit** — Vos photos de famille, vos documents administratifs, vos données médicales ne sont pas accessibles à des tiers, ni à Gauzian, ni aux gouvernements étrangers
- **Simplicité** — Pas besoin d'être expert en cryptographie ; le chiffrement fonctionne automatiquement en arrière-plan
- **Souveraineté** — Vous soutenez un acteur français et contribuez à la souveraineté numérique européenne

#### Pour les PME

**Positionnement :** « Stockez et partagez vos documents sensibles en conformité RGPD, sans cloud américain. »

Ce message s'adresse directement aux responsables informatiques et dirigeants de PME soucieux de protéger leurs données et celles de leurs clients.

**Bénéfices entreprises :**

- **Conformité RGPD** — Données hébergées en France, chiffrement E2EE, documentation complète pour les audits
- **Protection des données clients** — Engagement contractuel de chiffrement zero-knowledge, pas de risque d'accès par des tiers
- **Réponse aux appels d'offres** — Capacité à répondre aux exigences de souveraineté des marchés publics et des donneurs d'ordre

### 2.3 Grille Tarifaire Recommandée

#### Tarifs Particuliers

| Plan | Stockage | Appareils | Fonctionnalités | Tarif mensuel | Tarif annuel |
|------|----------|------------|------------------|---------------|--------------|
| **Free** | 5 Go | 1 | Upload/download de base, partage simple | €0 | €0 |
| **Solo** | 50 Go | 3 | Partage sécurisé avec mot de passe, support email | €3.99 | €35 |
| **Plus** | 200 Go | Illimités | Versioning 30 jours, partage avancé, historique | €7.99 | €70 |
| **Premium** | 1 To | Illimités | Versioning 90 jours, support prioritaire, famille (5 comptes) | €14.99 | €130 |
| **Ultra** | 3 To | Illimités | Versionnement 180 jours, support prioritaire 24h | €24.99 | €220 |

**Logique tarifaire :**

- Le plan Free attire les utilisateurs et permet de valider le produit (onboarding, switch costs)
- Solo à €3.99/mois cible l'utilisateur conscient des enjeux privacy qui est prêt à payer un petit montant
- Plus à €7.99/mois est le cœur de cible B2C (rapport qualité-prix excellent)
- Premium et Ultra ciblent les power users avec des besoins importants (photographes, vidéo, sauvegardes)

#### Tarifs PME

| Plan | Utilisateurs | Stockage | Fonctionnalités | Tarif |
|------|--------------|----------|------------------|-------|
| **Starter** | jusqu'à 10 | 500 Go mutualisé | Panneau admin, SSO basique (Google/Office), support email | €49/mois |
| **Business** | jusqu'à 50 | 2 To | SSO avancé (SAML, OIDC), audit log, support SLA 48h | €199/mois |
| **Enterprise** | 50+ | Custom | SSO complet, formation, SLA 24h, account manager, facturation annuelle | Sur devis |

**Logique tarifaire :**

- Starter à €49/mois (soit €4.90/user) est compétitif avec les solutions non-E2EE et accessible aux petites structures
- Business à €199/mois (soit ~€4/user) apporte les fonctionnalités de contrôle nécessaires aux moyennes entreprises
- Enterprise sur devis permet de cibler les grandes organisations avec des besoins spécifiques

---

## Partie 3 — Stratégie Go-to-Market

### 3.1 Canaux d'Acquisition

#### SEO et Contenu (Long terme, faible coût)

La stratégie de contenu vise à capturer les requêtes de recherche des utilisateurs découverte :

- **Articles de blog** : « Comment protéger ses fichiers avec le chiffrement de bout en bout », « Pourquoi choisir un drive français », « Alternative à Google Drive RGPD », « Drive E2EE : ce qu'il faut savoir »
- **Guides pratiques** : « Migrer de Google Drive vers un cloud sécurisé », « Chiffrement zero-knowledge : mode d'emploi »
- **Lexique et définitions** : Positionnement sur les requêtes informationnelles autour de la privacy, du chiffrement, de la souveraineté

L'investissement SEO est faible (coût de production de contenu) mais les résultats sont différés (6-12 mois). C'est un levier durable qui génère un traffic qualifié avec un coût d'acquisition (CAC) faible.

#### Communautés Tech et Privacy (Court terme, effet viral)

Les communautés tech et privacy sont des canaux privilégiés pour trouver les early adopters :

- **Reddit** : r/france, r/privacy, r/datahoarder, r/selfhosted — présence active, réponses aux questions, partage d'expérience
- **GitHub** : Contribution open-source, publication du code (si open-source), engagement avec les développeurs
- **Mastodon** : Fediverse, instances tech et privacy, engagement organique
- **Forums** : Ubuntu.fr, Debian-fr, Hardware.fr — communautés tech françaises historiquement actives

#### Réseaux Sociaux

- **LinkedIn** : Ciblage PME, posts sur la conformité RGPD, articles de fond sur la souveraineté numérique
- **Twitter/X** : Écosystème tech et privacy, veille concurrentielle, engagement avec les influenceurs cybersécurité
- **YouTube** : Tutoriels d'utilisation, interviews, behind-the-scenes — format engageant pour le public tech

#### Partenariats Stratégiques

Les partenariats permettent d'accéder à des audiences qualifiés :

- **Associations de presse indépendante** : Contributeurs soucieux de leurs sources,泄露的风险
- **Barreaux d'avocats** : Avocats, notaires, huissiers — besoins de confidentialité déontologique
- **Syndicats médicaux** : Médecins, infirmiers, professions de santé — secret professionnel
- **ESN locales** : Sociétés de services numériques françaises, prescripteurs auprès de leurs clients

#### Relations Presse et Médias Tech

La presse tech française est un canal performant pour construire la notoriété :

- **Next INpact** : Média de référence sur le numérique, sensibilité aux enjeux de privacy et souveraineté
- **Numerama** : Large audience tech grand public, sujets accessibility
- **Korben** : Blog influent tech et sécurité, communauté engaged
- **Le Monde Informatique** : Ciblage décideurs IT, B2B

#### Programme Ambassadeurs

Un programme d'ambassadeurs permet de multiplier les canaux d'acquisition par le bouche-à-oreille :

- **Early adopters** : 50-100 premiers utilisateurs avec accès beta, invités à partager leur retour
- **Codes promo** : Codes de réduction personnalisés (10-20% de réduction) à partager
- **Commission** : Rétrocommission sur les parrainages aboutissant à un abonnement payant (10% du premier an)

### 3.2 Stratégie de Conversion

#### Tunnel d'Acquisition

Le tunnel de conversion suit une logique SaaS classique :

1. **Découverte** — L'utilisateur découvre Gauzian via un article de blog, un commentaire Reddit, un article de presse, ou un bouche-à-oreille
2. **Essai (Free)** — L'utilisateur crée un compte gratuit (5 Go), teste l'interface, vérifie le chiffrement, invite un ami
3. **Conversion (Payant)** — Lorsque les besoins de l'utilisateur dépassent l'offre gratuite (stockage, appareils, fonctionnalités), il souscrit à un plan payant

#### Onboarding

L'onboarding vise à réduire le temps de valeur (time-to-value) :

- **Setup guidé en 5 minutes** : Tutoriel pas-à-pas, pas de configuration technique, immédiat operational
- **Import automatisé** : Connecteurs pour importer les données depuis Google Drive, Dropbox, OneDrive, iCloud
- **Vérification du chiffrement** : Fonctionnalité permettant à l'utilisateur de vérifier que ses fichiers sont bien chiffrés (démonstration pédagogique)

#### Rétention

La rétention est critique pour un produit SaaS :

- **Notifications claires** : Alertes de consommation, rappels de renouvellement, nouvelles fonctionnalités
- **Rapport mensuel de confidentialité** : Email mensuel récapitulant l'activité (« Vos données sont toujours chiffrées, voici votre activité du mois »)
- **Feature releases régulières** : Améliorations continues, nouvelles fonctionnalités, mises à jour de sécurité

### 3.3 Roadmap Produit sur 6 Mois

#### M0-M1 : Finalisation MVP

- Finalisation des fonctionnalités core (upload, download, chiffrement, partage)
- Tests de sécurité automatisés (unit tests, integration tests)
- Pentest externe (si budget le permet) ou audit par pairs
- Infrastructure stable sur OVH VPS
- Préparation de la documentation (CGU, politique de confidentialité, mentions légales)

#### M2 : Beta Privée

- Ouverture beta privée à 50-100 utilisateurs triés sur le volet
- Onboarding automatisé avec questionnaire de feedback
- Boucle de feedback itérative (hebdomadaire)
- Corrections de bugs et ajustements UX

#### M3 : Lancement Public

- Lancement officiel, disponibilité pour tous
- Communication : Product Hunt, réseaux sociaux, presse FR
- Offres Free et Solo actives
- Monitoring production (uptime, performance, erreurs)
- Support par email

#### M4-M5 : Extension Offre

- Déploiement plans Plus et Premium (versioning, support prioritaire, famille)
- Client desktop (Windows, macOS, Linux) en beta
- Application mobile (iOS, Android) en développement

#### M6 : Bilan et Décision

- Premiers clients PME (offre Starter/Business)
- Tableau de bord admin pour les entreprises
- Évaluation des résultats vs objectifs
- Décision : levée de fonds ou continuation bootstrapped

---

## Partie 4 — Modèle Financier

### 4.1 Hypothèses Communes

Les projections financières reposent sur les hypothèses suivantes, basées sur les benchmarks SaaS et le contexte du projet :

| Paramètre | Valeur | Source / Justification |
|-----------|--------|------------------------|
| Coût infrastructure OVH (VPS initial) | €12-30/mois | VPS starter à €12, scale-up progressif |
| Coût stockage additionnel | €0.002/Go/mois | Tarif OVH Object Storage |
| Taux de conversion Free → Payant | 3-5% | Benchmark SaaS (moyenne 4%) |
| ARPU particulier moyen | €8/mois | Pondéré entre plans Free (€0) et Payants (€4-25) |
| ARPU PME moyen | €120/mois | Plan Starter (€49) avec 10 utilisateurs |
| CAC (SEO/Communautés) | €5-15 | Coût d'acquisition organique |
| CAC (Paid marketing) | €20-50 | Estimation si campagnes paid |
| Churn mensuel cible | < 3% | Benchmark SaaS healthy |

### 4.2 Scénario A — Bootstrapped (€0-50k)

#### Dépenses sur 6 Mois (M1-M6)

| Poste | Coût mensuel estimé | Total M1-M6 |
|-------|---------------------|-------------|
| Infrastructure (OVH VPS) | €12 → €30 | ~€120 |
| Outils (domaine, email, monitoring, SaaS) | €20 → €50 | ~€200 |
| Marketing (SEO only) | €0 → €200 | ~€500 |
| Juridique (CGU, mentions légales) | €100 (one-shot) | ~€100 |
| DPO externe | €50/mois (à partir de M3) | ~€250 |
| **Total** | — | **~€1,200-2,000** |

#### Projections 3 Ans (Scénario A)

| Période | Users totaux | Payants (3-5%) | MRR | ARR |
|---------|--------------|----------------|-----|-----|
| **M6** | 500 | 25 (5%) | €200 | €2,400 |
| **M12** | 2,000 | 100 (5%) | €800 | €9,600 |
| **M18** | 5,000 | 300 (6%) | €2,400 | €28,800 |
| **M24** | 12,000 | 700 (6%) | €5,600 | €67,200 |
| **M30** | 25,000 | 1,500 (6%) | €12,000 | €144,000 |
| **M36** | 50,000 | 3,000 (6%) | €25,000 | €300,000 |

**Analyse :** En scénario bootstrapped, la croissance est organique et progressive. Le MRR atteint €25,000 à M36, soit un ARR de €300,000. Le break-even est visé entre M18 et M24. La stratégie privilégie la validation produit et la rentabilité avant d'engager des fonds externes.

### 4.3 Scénario B — Pré-seed (€200k-500k)

#### Utilisation des Fonds (€300k cible)

| Poste | Budget | Commentaire |
|-------|--------|-------------|
| Salaires (1 dev + 1 growth/ops) | €140k/an | €70k + €70k charges patronales |
| Infrastructure managée | €15k/an | Scaleway managed k8s + DB + object storage |
| Marketing paid + PR | €30k | Campagnes Google/LinkedIn, relations presse |
| Juridique (RGPD, CGU, audit) | €20k | DPO, audits sécurité, cabinet juridique |
| Opérations + outils + imprévus | €15k | Outils SaaS, frais bancaires, imprévus |
| **Total année 1** | **~€220k** | |

Le montant de €300k permet de couvrir les dépenses de la première année avec une trésorerie de sécurité de €80k.

#### Projections 3 Ans (Scénario B)

| Période | Users totaux | Payants (5-7%) | MRR | ARR |
|---------|--------------|----------------|-----|-----|
| **M6** | 2,000 | 100 (5%) | €900 | €10,800 |
| **M12** | 8,000 | 450 (6%) | €4,500 | €54,000 |
| **M18** | 20,000 | 1,200 (6%) | €12,000 | €144,000 |
| **M24** | 50,000 | 3,000 (6%) | €32,000 | €384,000 |
| **M30** | 100,000 | 6,500 (7%) | €70,000 | €840,000 |
| **M36** | 200,000 | 14,000 (7%) | €155,000 | €1,860,000 |

**Analyse :** En scénario pré-seed, l'investissement dans le marketing paid et le recrutement permet une croissance plus rapide. Le MRR atteint €155,000 à M36, soit un ARR de €1,860,000. Ce niveau de MRR justifie une série A ou un revenue-based financing.

### 4.4 Métriques Clés à Suivre

| Métrique | Définition | Cible |
|----------|------------|-------|
| **MRR** | Monthly Recurring Revenue — Revenu récurrent mensuel | Croissance MoM > 20% (M1-M12) |
| **ARR** | Annual Recurring Revenue — Revenu récurrent annuel | — |
| **MoM Growth** | Taux de croissance mois sur mois | > 15% en moyenne |
| **Churn Rate** | Taux de désabonnement mensuel | < 3% |
| **CAC** | Coût d'acquisition client | < €15 (organique), < €50 (paid) |
| **LTV** | Lifetime Value — Valeur vie client | LTV = ARPU / Churn |
| **LTV/CAC** | Ratio de retour sur investissement d'acquisition | > 3 |
| **NPS** | Net Promoter Score — Indice de recommandation | > 50 |
| **Conversion** | Taux de conversion Free → Payant | 3-5% |

---

## Partie 5 — Aspects Juridiiques et Conformité

### 5.1 RGPD (Règlement Général sur la Protection des Données)

Le RGPD est le cadre réglementaire central pour Gauzian. En tant que sous-traitant de données personnelles (stockage de fichiers pouvant contenir des données personnelles), Gauzian doit se conformer aux exigences suivantes :

**Obligations immédiates (avant lancement) :**

- **Mentions légales** : Publication sur le site avec informações sur l'entreprise, le directeur de la publication, et l'hébergement
- **CGU** : Conditions Générales d'Utilisation définissant les droits et obligations des utilisateurs
- **Politique de confidentialité** : Information claire sur les données collectées, les finalités, les durées de conservation, les droits des utilisateurs
- **Registre des traitements** : Document interne listant tous les traitements de données personnelles (article 30 RGPD)

**DPO (Data Protection Officer) :** La nomination d'un DPO n'est pas obligatoire pour Gauzian en phase initiale (moins de 250 employés, traitement non systématique de données sensibles). Toutefois, il est recommandé de recourir à un DPO externe à partir de M3 pour auditer la conformité et servir de point de contact avec la CNIL.

**Droits des utilisateurs :** Gauzian doit être en mesure de répondre aux demandes d'exercice des droits :

- Droit d'accès (article 15)
- Droit de rectification (article 16)
- Droit à l'effacement (article 17) — y compris suppression irréversible des fichiers chiffrés
- Droit à la portabilité (article 20) — export des données dans un format structuré

**Sous-traitants :** Si Gauzian utilise des sous-traitants (OVH pour l'hébergement), des conventions de sous-traitance doivent être passées conformément à l'article 28 RGPD.

**Transferts de données :** Gauzian héberge exclusively en France, pas de transfert hors UE. Cette caractéristique simplifie considérablement la conformité RGPD par rapport aux services hébergés aux États-Unis.

### 5.2 Certifications et Labels

#### Label SecNumCloud (ANSSI)

Le label SecNumCloud est la certification de référence pour les prestataires cloud en France. Il garantit le respect des exigences de sécurité de l'ANSSI et l'hébergement des données en France. Le processus de qualification est long (2-3 ans) et coûteux.

**Positionnement :** Gauzian ne vise pas le label SecNumCloud à court terme (coût et complexité). Cependant, l'architecture technique et l'hébergement OVH sont alignés avec les exigences du label. À terme (M24-36), si le positionnement B2B se développe, la qualification peut être envisagée.

#### ISO 27001

La certification ISO 27001 (Management de la Sécurité de l'Information) est un standard international reconnu. Elle peut être un critère de sélection pour les grandes entreprises et les marchés publics.

**Positionnement :** Certification à moyen terme (M18-24) si le segment B2B se développe significativement.

#### Certification HDS (Hébergeur de Données de Santé)

La certification HDS est obligatoire pour héberger des données de santé en France. Elle ouvre l'accès au marché de la santé numérique (éditeurs de logiciels, établissements de santé, professionnels de santé).

**Positionnement :** Marché d'entrée (M12-18) si le segment santé est ciblé. La certification HDS est coûteuse et complexe mais peut constituer un avantage compétitif significatif.

#### EUCS (European Union Cloud Scheme)

Le scheme européen EUCS est en cours d'établissement pour harmoniser les certifications cloud au niveau européen. Il pourrait devenir la référence pour les marchés publics européens.

**Positionnement :** À surveiller, adapter la roadmap en fonction des évolutions.

### 5.3 Structure Juridique Recommandée

#### SASU (Société par Actions Simplifiée Unipersonnelle)

La SASU est recommandée pour un fondateur solo qui souhaite :

- **Flexibilité** : statutes customizeables, peu de formalismes, décisions simplifiées
- **Protection du patrimoine personnel** : responsabilité limitée au capital social
- **Évolutivité** : possibilité de transformer en SAS (multiples associés) ou de lever des fonds
- **Fiscalité** : régime des bénéfices industriels et commerciaux (BIC), possibilité d'opter pour l'IS

**Capital initial :** Symbolique (€1 à €1,000), le fondateur apporte ses compétences et son temps.

**Immatriculation :** RCS (Registre du Commerce et des Sociétés), déclaration au guichet unique.

#### Statut JEI (Jeune Entreprise Innovante)

Le statut JEI (article 44 sexies du CGI) offre des avantages fiscaux significatifs pour les entreprises innovantes :

- **Exonération d'IS** sur les bénéfices pendant les 3 premiers exercices (si le montant des dépenses de R&D est >= 15% des charges déductibles)
- **Exonération de CFE** (Cotisation Foncière des Entreprises) pendant 7 ans
- **Exonération de TASCOM** (Taxe sur les surfaces commerciales) dans certains cas

**Conditions :** Moins de 8 ans d'existence, moins de €50M de chiffre d'affaires, caractère innovant documenté (dépenses de R&D, brevets, etc.)

**Pertinence pour Gauzian :** Le développement d'un système de chiffrement E2EE et d'une infrastructure sécurisée constitue clairement de la R&D. Le fondateur peut demander le statut JEI dès la création de la société, sous réserve de justifier du caractère innovant.

#### Aides et Subventions

Plusieurs dispositifs peuvent soutenir le démarrage :

- **Prêt d'amorçage BPI France** : Prêt à taux préférentiel pour les jeunes entreprises innovantes, jusqu'à €50k-100k
- **Concours iLab** : Subvention pour les projets innovants, jusqu'à €45k
- **Dispositif French Tech** : Accompagnement, réseau, visibilité
- **Aides régionales** :_VARIES selon la région_

### 5.4 Droit des Obligations Numériques

Au-delà du RGPD, Gauzian doit respecter :

- **Loi pour la confiance dans l'économie numérique (LCEN)** : Responsabilité des hébergeurs, obligation de coopération avec les autorités
- **Code de la propriété intellectuelle** : Respect des droits d'auteur, gestion des demandes de retrait
- **Loi relative à la fraude** : Pas de disposition spécifique au cloud mais vigilance sur les usages frauduleux

---

## Partie 6 — Risques et Mitigation

### 6.1 Matrice des Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Faille sécurité / breach de données | Faible | Critique | Pentests réguliers, bug bounty, audit externe annuel, tests E2EE automatisés |
| Faible adoption B2C | Modérée | Élevé | SEO long terme, product-led growth, programme ambassadeurs, présence sur Product Hunt |
| Concurrent bien financé (Proton, Tresorit) | Élevée | Modéré | Différenciation « 100% français », prix accessible, support local, communautaire |
| Problèmes de scalabilité | Modérée | Modéré | Architecture k8s dès le départ, monitoring proactif, stress tests réguliers |
| Burn-out du fondateur | Modérée | Élevé | Priorisation stricte, automatisation, délégations, gestion du workload |
| Burn rate trop élevé | Faible (bootstrapped) | Élevé | Coûts fixes minimaux, croissance organique prioritaire, validation avant engagement |
| Conformité RGPD insuffisante | Faible | Élevé | CGU claires, DPO externe dès M3, audit conformité, documentation complète |
| Problèmes juridiques (propriété intellectuelle) | Faible | Modéré | Veille, audits juridiques si nécessaire |

### 6.2 Risque Sécurité : Mitigation Détaillée

La sécurité est le fondement de la proposition de valeur Gauzian. Une faille de sécurité serait catastrophique pour la crédibilité du produit.

**Mesures techniques :**

- **Architecture zero-knowledge** : Les clés privées ne quittent jamais les appareils des utilisateurs. Le serveur ne peut pas déchiffrer les données.
- **Chiffrement robuste** : AES-256 pour les fichiers, RSA-4096 ou Ed25519 pour l'échange de clés, PBKDF2 pour la dérivation des mots de passe
- **Audits réguliers** : Pentest externe annuel (budget €5k-10k), bug bounty (HackerOne, YesWeHack)
- **Tests automatisés** : Suite de tests unitaires et d'intégration couvrant le chiffrement, les vecteurs d'attaque courants
- **Veille vulnérabilités** : Monitoring des CVEs sur les dépendances (Rust crates, Node.js packages)

**Mesures organisationnelles :**

- **Politique de sécurité** : Documentation des procédures, gestion des incidents, rotation des clés
- **Formation** : Sensibilisation du fondateur aux bonnes pratiques de sécurité
- **Réponse aux incidents** : Plan de communication et de remediation en cas de breach

### 6.3 Risque Adoption : Mitigation Détaillée

Le risque principal est que le marché n'adopte pas le produit malgré sa qualité technique.

**Stratégies d'atténuation :**

- **Validation early** : Tests utilisateurs dès la phase beta avec feedback quantitatif et qualitatif
- **Product-led growth** : Produit suffisamment attractif pour générer du bouche-à-oreille
- **Communautés** : Engagement actif dans les communautés tech et privacy
- **Pricing accessible** : Offre gratuite suffisante pour tester, plans payants abordables
- **Pivot si nécessaire** : Si le B2C ne fonctionne pas, pivoter vers le B2B (PME) où les budgets sont plus importants

---

## Partie 7 — Conclusion et Prochaines Étapes

### Synthèse des Enjeux

Gauzian se positionne sur un créneau de marché vacant et en croissance : le stockage cloud E2EE français, accessible au grand public et aux PME. Le contexte réglementaire (RGPD, souveraineté numérique), la sensibilisation croissante du public, et l'absence de concurrent français sur ce créneau créent une fenêtre d'opportunité.

La proposition de valeur est claire : « Tes fichiers, chiffrés, sur des serveurs français. Même nous ne pouvons pas les lire. » Le différenciateur clé est la combinaison E2EE + France + Abordable, non offerte par les acteurs actuels.

### Prochaines Étapes Immédiates (M0-M1)

1. **Finaliser le MVP** — Implémenter les fonctionnalités core, finaliser les tests E2EE
2. **Créer la structure juridique** — SASU, statut JEI, immatriculation RCS
3. **Préparer l'infrastructure** — VPS OVH stable, monitoring, backup
4. **Rédiger les documents juridiques** — CGU, politique de confidentialité, mentions légales
5. **Identifier un DPO externe** — Recruter ou contracter pour conformité RGPD
6. **Préparer la communication** — Branding, site web, landing page

### Jalons à 6 Mois

| Jalon | Échéance | Critère de succès |
|-------|----------|-------------------|
| Lancement beta privée | M2 | 50-100 utilisateurs actifs |
| Lancement public | M3 | 500 utilisateurs, premiers payants |
| Offre PME Starter | M5 | Premier client PME |
| Bilan M6 | M6 | 500+ utilisateurs, 50+ payants, décision levée de fonds |

### Décision de Financement

À M6, le fondateur devra choisir entre :

**Option A — Bootstrapped** : Maintenir la croissance organique, atteindre la rentabilité plus tard, préserver l'indépendance

**Option B — Levée de fonds** : Lever un seed round (€500k-1M) pour accelerer la croissance, le recrutement, et le marketing

Le choix dépendra des métriques à M6 (croissance, conversion, revenus), de l'appétit du fondateur pour la levée de fonds, et des opportunités de marché.

---

## Partie 8 — Sources et Références

### Données de Marché

- **INSEE** — Données sur les PME françaises (https://www.insee.fr)
- **CNIL** — Baromètre confiance numérique 2023 (https://www.cnil.fr)
- **CESIN** — Rapport sur la cybercriminalité et les attaques ciblant les entreprises françaises (https://www.cesin.fr)
- **Gartner / IDC** — Prévisions du marché du cloud storage mondial 2023-2028
- **ANSSI** — Doctrine cloud de confiance et label SecNumCloud (https://www.ssi.gouv.fr)

### Concurrents

- **Nextcloud** — Page tarifs et fonctionnalités (https://nextcloud.com/pricing/)
- **Proton Drive** — Site officiel et tarifs (https://proton.me/drive)
- **Tresorit** — Page tarifs entreprise (https://tresorit.com/pricing)
- **CryptPad** — Offres et tarifs (https://cryptpad.org/pricing/)
- **Infomaniak kDrive** — Présentation et tarifs (https://www.infomaniak.com/fr/kdrive)
- **Cozy Cloud / Twake** — Site officiel (https://cozy.io, https://twake.com)

### Infrastructure

- **OVHcloud** — VPS et solutions cloud (https://www.ovhcloud.com/fr/)
- **Scaleway** — Managed Kubernetes et services cloud (https://www.scaleway.com/fr/tarifs/)

### Réglementation

- **RGPD** — Règlement (UE) 2016/679
- **CNIL** — Guide RGPD pour les entreprises (https://www.cnil.fr)
- **ANSSI** — Référentiel SecNumCloud (https://www.ssi.gouv.fr)

---

*Document généré dans le cadre du projet Gauzian*
*Date : Février 2026*
*Version : 1.0*
