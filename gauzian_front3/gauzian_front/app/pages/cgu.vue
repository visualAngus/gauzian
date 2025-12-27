<script setup>
import { useHead } from '#imports'

useHead({
  title: 'Conditions Générales d’Utilisation (CGU) – Gauzian',
  meta: [
    { name: 'description', content: 'Conditions Générales d’Utilisation de la plateforme Gauzian' },
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
        <li><a href="#cgu">1. Conditions Générales d’Utilisation</a></li>
        <li><a href="#presentation">1.1 Présentation</a></li>
        <li><a href="#acceptation">1.2 Acceptation</a></li>
        <li><a href="#acces">1.3 Accès au service</a></li>
        <li><a href="#securite">1.4 Comptes et sécurité</a></li>
        <li><a href="#contenus">1.5 Contenus autorisés</a></li>
        <li><a href="#propriete">1.6 Propriété des contenus</a></li>
        <li><a href="#disponibilite">1.7 Disponibilité</a></li>
        <li><a href="#responsabilite">1.8 Responsabilité</a></li>
        <li><a href="#resiliation">1.9 Résiliation</a></li>
        <li><a href="#modifications">1.10 Modifications</a></li>
      </ol>
    </nav>

    <section class="section" id="cgu">
      <h2>1. Conditions Générales d’Utilisation (CGU)</h2>

      <h3 id="presentation">1.1 Présentation de la plateforme</h3>
      <p>Gauzian est une plateforme numérique proposant des services de <strong>stockage, édition, organisation, partage et collaboration</strong> autour de contenus numériques (documents, fichiers, messages, projets, agendas, etc.).</p>
      <p>La plateforme n’est <strong>pas anonyme</strong> : l’utilisation de Gauzian implique la création d’un compte utilisateur identifié.</p>

      <h3 id="acceptation">1.2 Acceptation des CGU</h3>
      <p>L’inscription et l’utilisation de Gauzian impliquent l’acceptation <strong>pleine et entière</strong> des présentes Conditions Générales d’Utilisation.</p>
      <p>En cas de désaccord avec tout ou partie des CGU, l’utilisateur doit cesser immédiatement l’utilisation de la plateforme.</p>

      <h3 id="acces">1.3 Accès au service</h3>
      <ul>
        <li>L’accès à Gauzian est réservé aux personnes disposant de la capacité juridique.</li>
        <li>Un compte personnel est requis.</li>
        <li>L’utilisateur est responsable de la confidentialité de ses identifiants.</li>
      </ul>
      <p>Toute tentative d’accès frauduleux, d’usurpation ou de contournement des systèmes de sécurité entraînera la suspension immédiate du compte.</p>

      <h3 id="securite">1.4 Fonctionnement des comptes et sécurité</h3>
      <ul>
        <li>Chaque compte est associé à des mécanismes de chiffrement destinés à protéger les données utilisateur.</li>
        <li>Gauzian ne peut accéder au contenu chiffré des utilisateurs.</li>
        <li><strong>En cas de perte du mot de passe</strong>, certaines données chiffrées peuvent devenir <strong>irrécupérables</strong>.</li>
      </ul>
      <p class="note">Note : la conservation des moyens d’accès relève exclusivement de la responsabilité de l’utilisateur.</p>

      <h3 id="contenus">1.5 Contenus autorisés</h3>
      <p>L’utilisateur s’engage à ne pas utiliser Gauzian pour :</p>
      <ul>
        <li>Des activités illégales ou frauduleuses</li>
        <li>La diffusion de contenus haineux, violents, discriminatoires ou pédopornographiques</li>
        <li>Le harcèlement ou l’atteinte aux droits d’autrui</li>
        <li>La diffusion de malwares ou les tentatives d’intrusion</li>
      </ul>
      <p>Gauzian se réserve le droit de suspendre ou supprimer tout compte contrevenant à ces règles.</p>

      <h3 id="propriete">1.6 Propriété des contenus</h3>
      <ul>
        <li>L’utilisateur reste <strong>pleinement propriétaire</strong> de ses contenus.</li>
        <li>Gauzian n’exploite aucun contenu à des fins commerciales.</li>
        <li>Les contenus partagés le sont sous la responsabilité exclusive de l’utilisateur.</li>
      </ul>

      <h3 id="disponibilite">1.7 Disponibilité du service</h3>
      <p>Gauzian s’efforce d’assurer une disponibilité continue mais <strong>ne garantit pas une disponibilité absolue</strong>.</p>
      <p>Des interruptions peuvent survenir pour maintenance, mises à jour ou raisons techniques.</p>

      <h3 id="responsabilite">1.8 Responsabilité</h3>
      <p>Gauzian ne saurait être tenue responsable :</p>
      <ul>
        <li>Des pertes de données dues à une mauvaise gestion des accès par l’utilisateur</li>
        <li>D’une mauvaise utilisation du service</li>
        <li>De dommages indirects ou immatériels</li>
      </ul>

      <h3 id="resiliation">1.9 Résiliation</h3>
      <ul>
        <li>L’utilisateur peut supprimer son compte à tout moment.</li>
        <li>Gauzian peut suspendre ou résilier un compte en cas de violation des CGU.</li>
      </ul>
      <p>La suppression du compte entraîne la suppression des données associées, sauf obligation légale contraire.</p>

      <h3 id="modifications">1.10 Modification des CGU</h3>
      <p>Les présentes CGU peuvent être modifiées à tout moment. Les utilisateurs seront informés en cas de modification substantielle.</p>
    </section>
  </main>
</template>

<style scoped>
.legal {
  max-width: 900px;
  margin: 48px auto;
  padding: 0 20px 64px;
  color: var(--dark-color, #111);
  line-height: 1.7;
  user-select: text;
  scroll-behavior: smooth;
}
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
