# Tests - Gauzian

Ce répertoire contient tous les scripts de test automatisés pour Gauzian.

## 🛡️ Tests de Sécurité (`security/`)

Scripts de test de sécurité pour détecter les vulnérabilités :

### SQLMap - Tests d'Injection SQL

- **[sqlmap_test.sh](security/sqlmap_test.sh)** - Tests complets ⏱️ ~30-60 min
  - 14 endpoints testés (publics et authentifiés)
  - Support authentification JWT automatique
  - Tests niveau 3, risque 2 (complets)
  - Rapports sauvegardés dans `../sqlmap_reports/`

- **[sqlmap_quick_test.sh](security/sqlmap_quick_test.sh)** - Tests rapides ⏱️ ~5-10 min
  - 3 endpoints critiques seulement
  - Tests niveau 2, risque 1 (légers)
  - Pas d'authentification requise

**Utilisation :**
```bash
# Test rapide (recommandé pour débuter)
./tests/security/sqlmap_quick_test.sh

# Test complet avec authentification
./tests/security/sqlmap_test.sh
```

**Documentation :** Voir [docs/SECURITY_TESTING.md](../docs/SECURITY_TESTING.md) pour le guide complet.

---

## ⚡ Tests de Performance (`k6/`)

Scripts de test de charge et de performance avec k6 :

### Tests Disponibles

- **[test-login-k6.js](k6/test-login-k6.js)** - Tests d'authentification
  - Test de charge sur login/register
  - Validation des temps de réponse
  - Vérification des tokens JWT

- **[test-upload-advanced.js](k6/test-upload-advanced.js)** - Tests d'upload avancés
  - Upload de fichiers chiffrés
  - Gestion des chunks
  - Performances E2EE

- **[test-complete-stress.js](k6/test-complete-stress.js)** - Tests de stress complets
  - Simulation charge réaliste
  - Multiples utilisateurs simultanés
  - Scénarios mixtes (upload, download, partage)

**Utilisation :**
```bash
# Installer k6
sudo apt install k6  # Linux
# ou
brew install k6      # macOS

# Lancer un test
k6 run tests/k6/test-login-k6.js

# Avec options
k6 run --vus 10 --duration 30s tests/k6/test-complete-stress.js
```

**Résultats :**
- Temps de réponse moyen/p95/p99
- Taux d'erreurs
- Throughput (requêtes/sec)

---

## 📊 Résultats des Tests

Tous les tests ont été passés avec **succès** :
- ✅ Aucune vulnérabilité SQL injection détectée
- ✅ Authentification robuste (rate limiting, tokens)
- ✅ Performance acceptable sous charge (p95 < 500ms)
- ✅ E2EE maintenu même sous charge

---

## 🔗 Documentation Complémentaire

- [docs/SECURITY_TESTING.md](../docs/SECURITY_TESTING.md) - Guide détaillé des tests de sécurité
- [README.md](../README.md) - Présentation générale du projet
- [DEVELOPMENT_LOG.md](../DEVELOPMENT_LOG.md) - Journal de développement
