# Guide de Test de Sécurité - Gauzian

Ce guide explique comment tester la sécurité de ton API Gauzian avec SQLMap.

## Prérequis

### Installation de SQLMap

```bash
# Sur Ubuntu/Debian
sudo apt update
sudo apt install sqlmap

# Ou via pip
pip install sqlmap

# Vérifier l'installation
sqlmap --version
```

## Scripts Disponibles

### 1. Test Rapide (Recommandé pour débuter)

**Fichier:** `sqlmap_quick_test.sh`

Teste uniquement les 3 endpoints les plus critiques :
- `/login` - Endpoint de connexion
- `/register` - Endpoint d'inscription
- `/contacts/get_public_key/{email}` - Récupération de clé publique

**Utilisation:**
```bash
chmod +x sqlmap_quick_test.sh
./sqlmap_quick_test.sh
```

**Durée:** ~5-10 minutes

---

### 2. Test Complet

**Fichier:** `sqlmap_test.sh`

Teste TOUS les endpoints de l'API, y compris les endpoints authentifiés.

**Utilisation:**
```bash
chmod +x sqlmap_test.sh
./sqlmap_test.sh
```

Le script te demandera :
- Si tu veux tester les endpoints authentifiés (recommandé)
- Tes identifiants (email + mot de passe) pour obtenir un token JWT

**Durée:** ~30-60 minutes

**Endpoints testés:**
- Endpoints publics (login, register, get_public_key)
- Endpoints de gestion des fichiers (upload, download, delete, rename, move)
- Endpoints de gestion des dossiers (create, delete, rename, move, share)
- Endpoints de partage et permissions

---

## Interpréter les Résultats

### Messages courants de SQLMap

#### ✅ Pas de vulnérabilité
```
[INFO] target URL appears to be not injectable
```
→ **BIEN** - L'endpoint est sécurisé

#### ⚠️ Vulnérabilité potentielle
```
[WARNING] parameter 'xxx' does not seem to be injectable
```
→ **OK** - SQLMap a testé mais n'a rien trouvé

#### 🚨 VULNÉRABILITÉ TROUVÉE
```
[INFO] the back-end DBMS is PostgreSQL
Parameter: xxx (POST)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
```
→ **CRITIQUE** - Une injection SQL a été détectée !

### Voir les résultats

```bash
# Résumé des vulnérabilités trouvées
grep -r 'vulnerable' ./sqlmap_reports/

# Détails des injections identifiées
grep -r 'sqlmap identified' ./sqlmap_reports/

# Voir tous les logs
ls -la ./sqlmap_reports/
```

---

## Commandes SQLMap Manuelles

Si tu veux tester un endpoint spécifique manuellement :

### Endpoint GET avec paramètre dans l'URL
```bash
sqlmap -u "https://gauzian.pupin.fr/drive/file/00000000-0000-0000-0000-000000000000" \
    --cookie="auth_token=TON_TOKEN_JWT" \
    --batch --level=3 --risk=2
```

### Endpoint POST avec JSON
```bash
sqlmap -u "https://gauzian.pupin.fr/login" \
    --data='{"email":"test@test.com","password":"test123"}' \
    --method=POST \
    --headers="Content-Type: application/json" \
    --batch --level=3 --risk=2
```

### Options SQLMap expliquées

- `--batch` : Mode automatique (pas de questions)
- `--level=3` : Niveau de tests (1-5, 3 = complet)
- `--risk=2` : Niveau de risque (1-3, 2 = agressif)
- `--cookie` : Passer un cookie d'authentification
- `--data` : Corps de la requête POST
- `--method=POST` : Méthode HTTP
- `--headers` : En-têtes HTTP personnalisés

---

## Tests Complémentaires

### 1. Tester les Headers de Sécurité
```bash
curl -I https://gauzian.pupin.fr
```

Vérifie la présence de :
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`

### 2. Test SSL/TLS
```bash
# Avec sslscan
sudo apt install sslscan
sslscan gauzian.pupin.fr

# Ou avec testssl.sh
git clone https://github.com/drwetter/testssl.sh.git
cd testssl.sh
./testssl.sh https://gauzian.pupin.fr
```

### 3. Test avec Nikto (scan de vulnérabilités)
```bash
sudo apt install nikto
nikto -h https://gauzian.pupin.fr -ssl
```

---

## Que Faire si une Vulnérabilité est Trouvée ?

1. **NE PAS PANIQUER** - SQLMap peut parfois donner des faux positifs

2. **Vérifier manuellement** avec curl pour confirmer :
   ```bash
   curl -X POST https://gauzian.pupin.fr/login \
       -H "Content-Type: application/json" \
       -d '{"email":"test'\" OR \"1\"=\"1","password":"test"}'
   ```

3. **Identifier la source** :
   - Requête SQL brute dans le code ?
   - Paramètre non validé ?
   - Utilisation de `format!()` au lieu de paramètres liés ?

4. **Corriger** :
   - Utilise toujours les paramètres liés de SQLx : `sqlx::query!()` ou `query_as!()`
   - Valide TOUS les inputs utilisateur
   - Échappe les caractères spéciaux

5. **Retester** avec le même endpoint après correction

---

## Logs et Rapports

Tous les rapports SQLMap sont sauvegardés dans `./sqlmap_reports/`

Structure des rapports :
```
sqlmap_reports/
├── gauzian.pupin.fr/
│   ├── log           # Logs détaillés
│   ├── session.sqlite  # Session SQLMap
│   └── target.txt    # Résultats des tests
```

---

## Bonnes Pratiques

✅ **À FAIRE :**
- Tester régulièrement (à chaque grosse feature)
- Tester sur un environnement de staging d'abord
- Garder les logs pour comparaison
- Combiner SQLMap avec d'autres outils (OWASP ZAP, Burp Suite)

❌ **À NE PAS FAIRE :**
- Tester en production sans backup
- Utiliser `--risk=3` sans savoir ce que ça fait (peut modifier/supprimer des données)
- Ignorer les warnings SQLMap
- Tester sur une production active avec des vrais utilisateurs

---

## Questions Fréquentes

### SQLMap est lent, normal ?
Oui, surtout avec `--level=3 --risk=2`. Utilise `--level=1 --risk=1` pour des tests rapides.

### Dois-je tester sur la prod ?
Oui MAIS :
- Fais un backup de la DB avant
- Teste pendant les heures creuses
- Utilise `--level=2 --risk=1` maximum

### SQLMap ne trouve rien, est-ce bon signe ?
Probablement ! Ton utilisation de SQLx avec des requêtes paramétrées te protège déjà bien.

### Comment obtenir un token JWT pour les tests ?
Le script `sqlmap_test.sh` le fait automatiquement, ou manuellement :
```bash
curl -c cookies.txt https://gauzian.pupin.fr/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ton@email.com","password":"tonpass"}'

# Voir le cookie
cat cookies.txt | grep auth_token
```

---

## Ressources

- [Documentation SQLMap](https://github.com/sqlmapproject/sqlmap/wiki)
- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- [SQLx Documentation](https://docs.rs/sqlx/latest/sqlx/)
