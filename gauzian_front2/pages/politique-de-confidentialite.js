import Head from 'next/head'
import styles from '../styles/legal.module.css'

export default function PolitiqueDeConfidentialite() {
  return (
    <>
      <Head>
        <title>Politique de Confidentialité – Gauzian</title>
        <meta name="description" content="Politique de confidentialité, mentions légales, charte d’utilisation et droit applicable de Gauzian" />
      </Head>
      <main className={styles.legal}>
        <header className={styles.header}>
          <h1 className={styles.title}>Documents juridiques de la plateforme <strong>Gauzian</strong></h1>
          <p className={styles.meta}>Version complète, cohérente et unifiée des documents légaux applicables à la plateforme Gauzian. Dernière mise à jour : <strong>22 décembre 2025</strong></p>
        </header>

        <hr className={styles.separator} />

        <nav className={styles.toc} aria-label="Table des matières">
          <div className={styles.tocTitle}>Sommaire</div>
          <ol className={styles.tocList}>
            <li><a href="#confidentialite">2. Politique de Confidentialité</a></li>
            <li><a href="#donnees-collectees">2.1 Données collectées</a></li>
            <li><a href="#donnees-chiffrees">2.2 Données chiffrées</a></li>
            <li><a href="#utilisation">2.3 Utilisation des données</a></li>
            <li><a href="#conservation">2.4 Conservation</a></li>
            <li><a href="#droits">2.5 Droits des utilisateurs</a></li>
            <li><a href="#securite">2.6 Sécurité</a></li>
            <li><a href="#mentions">3. Mentions légales</a></li>
            <li><a href="#charte">4. Charte d’utilisation responsable</a></li>
            <li><a href="#droit">5. Droit applicable</a></li>
          </ol>
        </nav>

        <section className={styles.section} id="confidentialite">
          <h2>2. Politique de Confidentialité</h2>

          <h3 id="donnees-collectees">2.1 Données collectées</h3>
          <p>
            Gauzian collecte uniquement les données nécessaires au fonctionnement du service :
          </p>
          <ul>
            <li>Identifiant utilisateur</li>
            <li>Adresse e‑mail</li>
            <li>Données techniques (journaux, sécurité, performances)</li>
          </ul>
          <p className={styles.note}>Aucun profilage commercial n’est effectué.</p>

          <h3 id="donnees-chiffrees">2.2 Données chiffrées</h3>
          <ul>
            <li>Les contenus utilisateurs peuvent être chiffrés de bout en bout.</li>
            <li>Gauzian ne détient pas les clés de déchiffrement finales.</li>
            <li>Certaines données sont <strong>techniquement impossibles à récupérer</strong> en cas de perte d’accès.</li>
          </ul>

          <h3 id="utilisation">2.3 Utilisation des données</h3>
          <p>Les données sont utilisées uniquement pour :</p>
          <ul>
            <li>Fournir les services</li>
            <li>Sécuriser la plateforme</li>
            <li>Respecter les obligations légales</li>
          </ul>
          <p>Aucune donnée n’est vendue ni partagée à des tiers à des fins publicitaires.</p>

          <h3 id="conservation">2.4 Conservation des données</h3>
          <ul>
            <li>Les données sont conservées tant que le compte est actif.</li>
            <li>En cas de suppression du compte, les données sont supprimées dans un délai raisonnable.</li>
          </ul>

          <h3 id="droits">2.5 Droits des utilisateurs</h3>
          <p>Conformément au RGPD, l’utilisateur dispose de :</p>
          <ul>
            <li>Droit d’accès</li>
            <li>Droit de rectification</li>
            <li>Droit à l’effacement</li>
            <li>Droit à la limitation</li>
          </ul>
          <p>Les demandes peuvent être adressées via les moyens de contact fournis par Gauzian.</p>

          <h3 id="securite">2.6 Sécurité</h3>
          <p>
            Gauzian met en œuvre des mesures techniques et organisationnelles adaptées pour protéger les données. Toutefois, aucun système n’est infaillible.
          </p>
        </section>

        <hr className={styles.separator} />

        <section className={styles.section} id="mentions">
          <h2>3. Mentions légales</h2>

          <h3>3.1 Éditeur</h3>
          <ul>
            <li><strong>Nom du service</strong> : Gauzian</li>
            <li><strong>Nature</strong> : Plateforme numérique indépendante</li>
          </ul>
          <p>(Les informations légales complètes peuvent être précisées selon le statut juridique définitif.)</p>

          <h3>3.2 Hébergement</h3>
          <p>
            Les services sont hébergés sur des infrastructures situées dans l’Union européenne, dans la mesure du possible.
          </p>

          <h3>3.3 Contact</h3>
          <p>Un moyen de contact est mis à disposition via la plateforme.</p>
        </section>

        <hr className={styles.separator} />

        <section className={styles.section} id="charte">
          <h2>4. Charte d’utilisation responsable</h2>

          <h3>4.1 Philosophie</h3>
          <p>
            Gauzian vise un usage <strong>sain, sérieux et respectueux</strong> du numérique. La plateforme refuse toute participation à des pratiques obscures, abusives ou contraires à l’éthique.
          </p>

          <h3>4.2 Engagements utilisateurs</h3>
          <p>En utilisant Gauzian, l’utilisateur s’engage à :</p>
          <ul>
            <li>Respecter les autres utilisateurs</li>
            <li>Utiliser la plateforme de bonne foi</li>
            <li>Respecter la loi et l’éthique numérique</li>
          </ul>

          <h3>4.3 Sanctions</h3>
          <p>Tout manquement grave peut entraîner :</p>
          <ul>
            <li>Suspension temporaire</li>
            <li>Suppression définitive du compte</li>
          </ul>
          <p>Ces mesures peuvent être prises sans préavis en cas d’urgence ou d’illégalité manifeste.</p>
        </section>

        <hr className={styles.separator} />

        <section className={styles.section} id="droit">
          <h2>5. Droit applicable</h2>
          <p>
            Les présents documents sont soumis au <strong>droit français</strong>. En cas de litige, une tentative de résolution amiable sera privilégiée avant toute action judiciaire.
          </p>
          <p className={styles.footer}><em>Fin des documents juridiques – Gauzian</em></p>
        </section>
      </main>
    </>
  )
}
