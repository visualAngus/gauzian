import { useState } from 'react'
import Head from 'next/head'
import styles from '../styles/legal.module.css'

export default function Fonctionnement() {
  const [showTech, setShowTech] = useState(false)

  return (
    <>
      <Head>
        <title>Comment fonctionne Gauzian – Fonctionnement</title>
        <meta name="description" content="Page expliquant honnêtement ce que Gauzian fait et ne fait pas" />
      </Head>
      <main className={styles.legal}>
        <header className={styles.header}>
          <h1 className={styles.title}>Comment fonctionne la plateforme <strong>Gauzian</strong></h1>
          <p className={styles.meta}>Version claire et honnête : ce que Gauzian fait — et ne fait pas. Dernière mise à jour : <strong>22 décembre 2025</strong></p>
          <div>
            <button className={styles.btnDev} onClick={() => setShowTech(v => !v)} aria-pressed={showTech}>
              {showTech ? 'Afficher la version claire' : 'Afficher la version technique'}
            </button>
          </div>
        </header>

        <hr className={styles.separator} />

        {showTech ? (
          <>
            <nav className={styles.toc} aria-label="Table des matières technique">
              <div className={styles.tocTitle}>Sommaire technique</div>
              <ol className={styles.tocList}>
                <li><a href="#tech-arch">1. Architecture générale</a></li>
                <li><a href="#tech-chiffrement">2. Modèle de chiffrement</a></li>
                <li><a href="#tech-comptes">3. Gestion des comptes et authentification</a></li>
                <li><a href="#tech-partage">4. Partage et collaboration</a></li>
                <li><a href="#tech-recovery">5. Récupération de compte</a></li>
                <li><a href="#tech-metadata">6. Métadonnées et données non chiffrées</a></li>
                <li><a href="#tech-api">7. API et intégrations</a></li>
                <li><a href="#tech-backups">8. Sauvegardes et résilience</a></li>
                <li><a href="#tech-confiance">9. Modèle de confiance</a></li>
                <li><a href="#tech-limitations">10. Limitations techniques assumées</a></li>
              </ol>
            </nav>
            <section className={styles.section} id="technique">
              <h2>Documentation Technique – Fonctionnement interne de Gauzian</h2>

              <h3 id="tech-arch">1. Architecture générale</h3>
            <p>Gauzian repose sur une architecture modulaire orientée sécurité et isolation des responsabilités.</p>
            <ul>
              <li>Frontend web (client) exécuté dans le navigateur de l’utilisateur</li>
              <li>Backend applicatif (API) responsable de l’authentification, des métadonnées et des permissions</li>
              <li>Services de stockage pour les données chiffrées</li>
              <li>Services annexes (logs, monitoring, sauvegardes)</li>
            </ul>
            <p>Le principe fondamental est la séparation stricte entre données chiffrées et logique serveur.</p>

            <h3 id="tech-chiffrement">2. Modèle de chiffrement</h3>
            <h4>2.1 Clés utilisateur</h4>
            <ul>
              <li>Mot de passe utilisateur : jamais stocké en clair</li>
              <li>Master Key (MK) : dérivée du mot de passe via une fonction de dérivation (ex. Argon2 / PBKDF2)</li>
              <li>Storage Key (SK) : clé symétrique aléatoire</li>
            </ul>
            <p>La Master Key sert uniquement à chiffrer la Storage Key.</p>

            <h4>2.2 Chiffrement des données</h4>
            <ul>
              <li>Chaque fichier ou ressource dispose de sa propre clé de chiffrement</li>
              <li>Cette clé est chiffrée par la Storage Key</li>
              <li>Les données sont chiffrées côté client avant envoi</li>
            </ul>
            <div>
              <pre>
{`Mot de passe
   ↓ (KDF)
Master Key
   ↓ (chiffrement)
Storage Key
   ↓ (chiffrement)
Clé fichier
   ↓
Fichier chiffré`}
              </pre>
            </div>
            <p>Le serveur ne possède aucune clé permettant de déchiffrer les contenus.</p>

            <h3 id="tech-comptes">3. Gestion des comptes et authentification</h3>
            <ul>
              <li>Les identifiants sont stockés sous forme de hash sécurisé</li>
              <li>Les sessions utilisent des tokens signés</li>
              <li>Les permissions sont évaluées côté serveur mais n’exposent jamais les clés</li>
            </ul>
            <p>L’authentification donne accès aux métadonnées, pas aux contenus déchiffrés.</p>

            <h3 id="tech-partage">4. Partage et collaboration</h3>
            <p>Le partage repose sur un modèle de relations chiffrées :</p>
            <ul>
              <li>Une relation de partage possède sa propre clé</li>
              <li>Les clés de fichiers peuvent être re‑chiffrées pour les utilisateurs autorisés</li>
              <li>Aucun double stockage des données en clair</li>
            </ul>
            <p>Les droits sont gérés par :</p>
            <ul>
              <li>ACL logiques (serveur)</li>
              <li>Clés cryptographiques (client)</li>
            </ul>

            <h3 id="tech-recovery">5. Récupération de compte</h3>
            <ul>
              <li>En cas de perte du mot de passe : la Master Key ne peut plus être dérivée</li>
              <li>La Storage Key reste chiffrée et inutilisable</li>
            </ul>
            <p>Optionnellement, un mécanisme de Recovery Key peut être proposé :</p>
            <ul>
              <li>Clé générée côté client</li>
              <li>Jamais stockée par le serveur</li>
              <li>Responsabilité totale de l’utilisateur</li>
            </ul>
            <p>Sans cette clé, la récupération des données est cryptographiquement impossible.</p>

            <h3 id="tech-metadata">6. Métadonnées et données non chiffrées</h3>
            <p>Certaines données restent accessibles au serveur :</p>
            <ul>
              <li>Identifiants techniques</li>
              <li>Noms de fichiers (selon configuration)</li>
              <li>Taille, dates, relations</li>
              <li>Logs de sécurité</li>
            </ul>
            <p>Ces données sont limitées au strict nécessaire au fonctionnement.</p>

            <h3 id="tech-api">7. API et intégrations</h3>
            <p>Gauzian expose des API permettant :</p>
            <ul>
              <li>Gestion des ressources</li>
              <li>Automatisation</li>
              <li>Intégrations tierces</li>
            </ul>
            <p>Les API n’exposent jamais les clés de chiffrement. Toute opération sensible doit être validée côté client.</p>

            <h3 id="tech-backups">8. Sauvegardes et résilience</h3>
            <ul>
              <li>Les données chiffrées peuvent être sauvegardées</li>
              <li>Les sauvegardes ne contiennent aucune clé exploitable</li>
              <li>Une restauration sans clés utilisateur ne permet pas la lecture des données</li>
            </ul>

            <h3 id="tech-confiance">9. Modèle de confiance</h3>
            <p>Gauzian adopte un modèle Zero Knowledge partiel :</p>
            <ul>
              <li>Le serveur est nécessaire au fonctionnement</li>
              <li>Mais insuffisant pour accéder aux contenus</li>
            </ul>
            <p>Cela implique : haute confidentialité et responsabilité accrue côté utilisateur.</p>

            <h3 id="tech-limitations">10. Limitations techniques assumées</h3>
            <ul>
              <li>Pas de récupération serveur des données chiffrées</li>
              <li>Pas d’indexation serveur du contenu</li>
              <li>Certaines fonctionnalités avancées nécessitent un accès client déchiffré</li>
            </ul>
            <p>Ces limitations sont des choix de conception, pas des contraintes accidentelles.</p>
            </section>
          </>
        ) : (
          <>
            <nav className={styles.toc} aria-label="Table des matières">
              <div className={styles.tocTitle}>Sommaire</div>
              <ol className={styles.tocList}>
                <li><a href="#presentation">1. Présentation générale</a></li>
                <li><a href="#principes">2. Principes de conception</a></li>
                <li><a href="#architecture">3. Architecture technique</a></li>
                <li><a href="#stockage">4. Stockage & chiffrement</a></li>
                <li><a href="#auth">5. Comptes et authentification</a></li>
                <li><a href="#partage">6. Partage et permissions</a></li>
                <li><a href="#api">7. API et intégrations</a></li>
                <li><a href="#disponibilite">8. Sauvegarde et disponibilité</a></li>
                <li><a href="#confidentialite">9. Confidentialité & propriété</a></li>
                <li><a href="#limitations">10. Limitations et responsabilité</a></li>
                <li><a href="#contact">11. Contact</a></li>
              </ol>
            </nav>

            <section className={styles.section} id="presentation">
              <h2>1. Qu’est‑ce que Gauzian ?</h2>
              <p>
                Gauzian est une plateforme qui permet de :
              </p>
              <ul>
                <li>stocker des fichiers et des documents,</li>
                <li>les organiser et les modifier,</li>
                <li>les partager avec d’autres personnes,</li>
                <li>collaborer de manière sécurisée.</li>
              </ul>
              <p>
                Gauzian est conçu comme un espace de travail privé, pas comme un réseau social ni une plateforme publicitaire.
              </p>
            </section>

            <section className={styles.section} id="principes">
              <h2>2. Les principes de base</h2>
              <p>Gauzian repose sur quelques règles simples :</p>
              <ul>
                <li>🔒 <strong>Confidentialité avant tout</strong> — seules les données nécessaires au fonctionnement sont utilisées.</li>
                <li>🧠 <strong>Contrôle utilisateur</strong> — vous restez maître de vos contenus et de vos accès.</li>
                <li>🧩 <strong>Fonctionnement modulaire</strong> — chaque partie du service a un rôle précis.</li>
                <li>🛠️ <strong>Transparence</strong> — pas de fonctionnement caché, pas de récupération “magique” des données.</li>
              </ul>
            </section>

            <section className={styles.section} id="stockage">
              <h2>3. Où sont stockées vos données ?</h2>
              <p>
                Vos fichiers sont stockés sur des serveurs sécurisés. Les échanges entre votre appareil et Gauzian sont chiffrés (connexion sécurisée). Les données peuvent également être chiffrées une fois stockées.
              </p>
              <p>
                👉 En clair : quelqu’un qui intercepterait les données ne pourrait pas les lire.
              </p>
            </section>

            <section className={styles.section} id="chiffrement">
              <h2>4. Le chiffrement : le point le plus important</h2>
              <p>
                Selon votre configuration, Gauzian peut proposer du chiffrement côté client.
              </p>
              <p><strong>Ce que ça veut dire concrètement :</strong></p>
              <ul>
                <li>Vos fichiers sont chiffrés avant d’être envoyés sur les serveurs.</li>
                <li>Gauzian ne peut pas lire ces fichiers.</li>
                <li>Même l’équipe technique n’a pas accès au contenu.</li>
              </ul>
              <p className={styles.note}><strong>⚠️ La contrepartie (très importante)</strong></p>
              <p>
                Si vous perdez votre mot de passe ou vos clés de chiffrement :
              </p>
              <ul>
                <li>❌ Gauzian ne pourra pas récupérer vos données</li>
                <li>❌ personne ne pourra les déchiffrer à votre place</li>
              </ul>
              <p>Ceci n’est pas un bug, c’est une conséquence directe de la sécurité.</p>
            </section>

            <section className={styles.section} id="stockage2">
              <h2>4. Stockage & chiffrement</h2>
              <p>
                Les fichiers sont stockés sur des volumes persistants côté serveur. Selon la configuration, les contenus peuvent être chiffrés au repos et/ou en transit.
              </p>
              <ul>
                <li>Chiffrement en transit : toutes les communications utilisent TLS.</li>
                <li>Chiffrement au repos : le service propose des mécanismes de chiffrement pour protéger les données stockées.</li>
                <li>Chiffrement côté client (optionnel) : pour une confidentialité maximale, certaines données peuvent être chiffrées côté client, ce qui rend le service incapable de lire le contenu.</li>
              </ul>
              <p className={styles.note}>
                Attention : si le chiffrement est géré côté client et que les clés sont perdues, les données chiffrées deviennent irrécupérables.
              </p>
            </section>

            <section className={styles.section} id="comptes">
              <h2>5. Comptes et connexion</h2>
              <p>
                Pour utiliser Gauzian, un compte est nécessaire. Vous vous connectez avec des identifiants sécurisés.
              </p>
              <ul>
                <li>Protections supplémentaires possibles (ex. double authentification).</li>
                <li>Vous êtes responsable de la sécurité de vos accès.</li>
                <li>👉 Gauzian ne peut pas se connecter à votre place.</li>
              </ul>
            </section>

            <section className={styles.section} id="partage">
              <h2>6. Partage et collaboration</h2>
              <p>Vous pouvez partager des contenus avec d’autres personnes :</p>
              <ul>
                <li>avec des droits précis (lecture, modification, administration),</li>
                <li>avec des liens de partage (optionnels),</li>
                <li>avec des limites (expiration, mot de passe, etc.).</li>
              </ul>
              <p>Vous gardez le contrôle à tout moment sur ce qui est partagé et avec qui.</p>
            </section>

            <section className={styles.section} id="automatisation">
              <h2>7. Automatisations et intégrations</h2>
              <p>
                Gauzian peut proposer des outils techniques (API) permettant de connecter des applications, automatiser certaines actions et créer des usages avancés.
              </p>
              <p>👉 Cette partie concerne surtout les utilisateurs avancés ou les développeurs. Elle n’est pas obligatoire pour utiliser Gauzian normalement.</p>
            </section>

            <section className={styles.section} id="sauvegardes">
              <h2>8. Sauvegardes et résilience</h2>
              <ul>
                <li>Les données chiffrées peuvent être sauvegardées</li>
                <li>Les sauvegardes ne contiennent aucune clé exploitable</li>
                <li>Une restauration sans clés utilisateur ne permet pas la lecture des données</li>
              </ul>
            </section>

            <section className={styles.section} id="confiance">
              <h2>9. Modèle de confiance</h2>
              <p>Gauzian adopte un modèle Zero Knowledge partiel :</p>
              <ul>
                <li>Le serveur est nécessaire au fonctionnement</li>
                <li>Mais insuffisant pour accéder aux contenus</li>
              </ul>
              <p>Cela implique : haute confidentialité et responsabilité accrue côté utilisateur.</p>
            </section>

            <section className={styles.section} id="limitations">
              <h2>10. Limitations techniques assumées</h2>
              <ul>
                <li>Pas de récupération serveur des données chiffrées</li>
                <li>Pas d’indexation serveur du contenu</li>
                <li>Certaines fonctionnalités avancées nécessitent un accès client déchiffré</li>
              </ul>
              <p>Ces limitations sont des choix de conception, pas des contraintes accidentelles.</p>
            </section>
          </>
        )}
      </main>
    </>
  )
}
