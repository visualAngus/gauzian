<script setup>
import { useHead } from '#imports'

useHead({
  title: 'Politique de Confidentialité – Gauzian',
  meta: [
    { name: 'description', content: 'Politique de confidentialité, mentions légales, charte d’utilisation et droit applicable de Gauzian' },
  ],
})
</script>

<template>
  <main class="legal">
    <header class="header">
      <h1 class="title">Documents juridiques de la plateforme <strong>Gauzian</strong></h1>
      <p class="meta">Version complète, cohérente et unifiée des documents légaux applicables à la plateforme Gauzian. Dernière mise à jour : <strong>22 décembre 2025</strong></p>
    </header>

    <hr class="separator" />

    <nav class="toc" aria-label="Table des matières">
      <div class="tocTitle">Sommaire</div>
      <ol class="tocList">
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

    <section class="section" id="confidentialite">
      <h2>2. Politique de Confidentialité</h2>

      <h3 id="donnees-collectees">2.1 Données collectées</h3>
      <p>Gauzian collecte uniquement les données nécessaires au fonctionnement du service :</p>
      <ul>
        <li>Identifiant utilisateur</li>
        <li>Adresse e‑mail</li>
        <li>Données techniques (journaux, sécurité, performances)</li>
      </ul>
      <p class="note">Aucun profilage commercial n’est effectué.</p>

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
      <p>Gauzian met en œuvre des mesures techniques et organisationnelles adaptées pour protéger les données. Toutefois, aucun système n’est infaillible.</p>
    </section>

    <hr class="separator" />

    <section class="section" id="mentions">
      <h2>3. Mentions légales</h2>

      <h3>3.1 Éditeur</h3>
      <ul>
        <li><strong>Nom du service</strong> : Gauzian</li>
        <li><strong>Nature</strong> : Plateforme numérique indépendante</li>
      </ul>
      <p>(Les informations légales complètes peuvent être précisées selon le statut juridique définitif.)</p>

      <h3>3.2 Hébergement</h3>
      <p>Les services sont hébergés sur des infrastructures situées dans l’Union européenne, dans la mesure du possible.</p>

      <h3>3.3 Contact</h3>
      <p>Un moyen de contact est mis à disposition via la plateforme.</p>
    </section>

    <hr class="separator" />

    <section class="section" id="charte">
      <h2>4. Charte d’utilisation responsable</h2>

      <h3>4.1 Philosophie</h3>
      <p>Gauzian vise un usage <strong>sain, sérieux et respectueux</strong> du numérique. La plateforme refuse toute participation à des pratiques obscures, abusives ou contraires à l’éthique.</p>

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

    <hr class="separator" />

    <section class="section" id="droit">
      <h2>5. Droit applicable</h2>
      <p>Les présents documents sont soumis au <strong>droit français</strong>. En cas de litige, une tentative de résolution amiable sera privilégiée avant toute action judiciaire.</p>
      <p class="footer"><em>Fin des documents juridiques – Gauzian</em></p>
    </section>
  </main>
</template>

<style scoped>
.legal { max-width: 900px; margin: 48px auto; padding: 0 20px 64px; color: var(--dark-color, #111); line-height: 1.7; user-select: text; scroll-behavior: smooth; }
.header { margin-bottom: 8px; }
.title { font-size: 2rem; line-height: 1.25; font-weight: 800; letter-spacing: -0.01em; color: var(--dark-color, #111); }
.meta { margin-top: 8px; color: var(--dark-gray-color, #555); font-size: 0.95rem; }
.separator { border: 0; border-top: 1px solid var(--light-gray-color, #e5e7eb); margin: 24px 0 32px; }
.toc { background: var(--white-color, #fff); border: 1px solid var(--light-gray-color, #e5e7eb); border-radius: 10px; padding: 16px 18px; margin: 8px 0 28px; }
.tocTitle { margin: 0 0 8px; font-size: 0.95rem; color: var(--dark-gray-color, #6b7280); font-weight: 600; }
.tocList { margin: 0; padding-left: 18px; }
.tocList li { margin: 6px 0; }
.section { display: block; width: 100%; height: auto; align-items: initial; justify-content: initial; gap: 0; }
.section h2 { font-size: 1.35rem; line-height: 1.35; margin: 28px 0 10px; }
.section h3 { font-size: 1.05rem; margin: 18px 0 8px; }
.section p { margin: 8px 0 10px; }
.section ul { padding-left: 1.1rem; list-style: disc; }
.note { background: linear-gradient(180deg, rgba(249,115,22,0.06), rgba(249,115,22,0.03)); border: 1px solid rgba(249,115,22,0.25); border-left: 4px solid var(--orange-color, #f97316); padding: 10px 12px; border-radius: 8px; color: var(--dark-color, #111); }
.footer { margin-top: 36px; color: var(--dark-gray-color, #6b7280); font-size: 0.95rem; }
.btnDev { padding: 10px 18px; background: #333; color: white; font-weight: 600; font-size: 0.95rem; border: 1px solid #555; border-radius: 6px; cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease; margin-top: 12px; }
.btnDev:hover { background: #444; border-color: #666; }
.btnDev:active { background: #222; border-color: #444; }
.legal nav { width: 100%; padding: 0; }
@media (max-width: 640px) { .title { font-size: 1.6rem; } .section h2 { font-size: 1.2rem; } .btnDev { padding: 9px 14px; font-size: 0.9rem; } }
</style>
