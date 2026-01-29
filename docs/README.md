# Documentation Technique - Gauzian

Ce répertoire contient la documentation technique détaillée du projet Gauzian.

## 📚 Contenu

### Sécurité

- **[SECURITY_TESTING.md](SECURITY_TESTING.md)** - Guide complet de test de sécurité
  - Installation et configuration SQLMap
  - Scripts de test automatisés
  - Interprétation des résultats
  - Tests complémentaires (headers, SSL/TLS, Nikto)
  - Bonnes pratiques et FAQ

### Implémentation du Partage E2EE

- **[SHARING_IMPLEMENTATION.md](SHARING_IMPLEMENTATION.md)** - Documentation complète de l'implémentation du partage
  - Architecture et fonctionnement
  - API endpoints
  - Exemples d'utilisation
  - Tests et validation

- **[SHARING_E2EE_SOLUTION.md](SHARING_E2EE_SOLUTION.md)** - Explication technique de la solution E2EE
  - Problématique du chiffrement de bout en bout
  - Architecture de rechiffrement par destinataire
  - Diagrammes et schémas
  - Considérations de performance

- **[SHARING_TEST_GUIDE.md](SHARING_TEST_GUIDE.md)** - Guide de test du partage
  - Scénarios de test
  - Validation E2EE
  - Tests de permissions
  - Edge cases

### Historique

- **[COMMIT_SUMMARY.md](COMMIT_SUMMARY.md)** - Résumé historique de l'implémentation du partage
  - Changements principaux
  - Fichiers modifiés
  - Archive référence

## 🔗 Autres Documentations

- **Racine** : [README.md](../README.md) - Présentation générale du projet
- **Racine** : [CLAUDE.md](../CLAUDE.md) - Guide pour Claude Code
- **Racine** : [DEVELOPMENT_LOG.md](../DEVELOPMENT_LOG.md) - Journal de développement
- **Backend** : [gauzian_back/CLAUDE.md](../gauzian_back/CLAUDE.md) - Documentation backend Rust
- **Backend K8s** : [gauzian_back/k8s/README.md](../gauzian_back/k8s/README.md) - Guide de déploiement Kubernetes
- **Frontend** : [gauzian_front/CLAUDE.md](../gauzian_front/CLAUDE.md) - Documentation frontend Nuxt
