# Gestion des Secrets Kubernetes — SOPS + age

## Pourquoi ce système ?

Par défaut, les secrets Kubernetes (`secrets.yaml`) contiennent des mots de passe en clair.
Les committer en git serait une faille de sécurité majeure.

**SOPS + age** résout ce problème :
- Tu écris tes secrets en clair dans `k8s/secrets.yaml`
- Le fichier est **chiffré automatiquement** au `git commit` → `k8s/secrets.enc.yaml`
- `secrets.enc.yaml` est committé en git (illisible sans la clé privée)
- Sur le VPS, les secrets sont **déchiffrés automatiquement** au déploiement

```
secrets.yaml (clair)          →  git commit  →  secrets.enc.yaml (chiffré, en git)
secrets.enc.yaml (en git)     →  VPS deploy  →  kubectl Secret K8s
```

---

## 1. Setup sur ta machine de dev

> À faire **une seule fois** après avoir cloné le repo.

### Installer les outils

```bash
apt install age sops
```

### Générer ta clé age

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

La commande affiche ta **clé publique** :
```
Public key: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ La clé privée est dans `~/.config/sops/age/keys.txt`. **Ne jamais la committer ni la partager.**

### Mettre ta clé publique dans `.sops.yaml`

Ouvre `.sops.yaml` à la racine du repo et remplace le placeholder :

```yaml
creation_rules:
  - path_regex: k8s/secrets\.yaml$
    age: >-
      age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # ← ta clé publique ici
```

### Activer le pre-commit hook

```bash
./k8s/scripts/setup-dev.sh
```

Ce script :
- Active le répertoire `.githooks/` comme source de hooks git
- Vérifie que tous les outils sont bien installés

---

## 2. Setup sur le VPS

> À faire **une seule fois** sur le serveur.

### Installer les outils

```bash
ssh vps
apt install age sops
```

### Copier ta clé privée sur le VPS

La clé privée est celle générée sur ta machine de dev (`~/.config/sops/age/keys.txt`).

```bash
# Depuis ta machine de dev
ssh vps 'mkdir -p ~/.config/sops/age'
scp ~/.config/sops/age/keys.txt vps:~/.config/sops/age/keys.txt
```

> La clé privée sur le VPS permet à `ci-deploy.sh` de déchiffrer automatiquement les secrets à chaque déploiement.

---

## Utilisation quotidienne (machine de dev)

### Créer ou modifier les secrets

```bash
# Première fois : partir du template
cp k8s/secrets.yaml.example k8s/secrets.yaml

# Remplir les vraies valeurs
vim k8s/secrets.yaml
```

### Committer (le chiffrement est automatique)

```bash
git add k8s/secrets.yaml
git commit -m "chore(k8s): mise à jour secrets"

# Le hook pre-commit fait automatiquement :
#   ✅ sops --encrypt secrets.yaml → secrets.enc.yaml
#   ✅ git add secrets.enc.yaml
#   ✅ rm secrets.yaml (supprimé, ne sera jamais committé)
```

### Pousser

```bash
git push origin main
# → CI/CD déclenche le déploiement sur le VPS
# → Le VPS déchiffre secrets.enc.yaml et applique les secrets K8s
```

### Modifier des secrets existants

```bash
# Déchiffrer et éditer directement (re-chiffre à la sauvegarde)
sops k8s/secrets.enc.yaml

# Puis committer le fichier re-chiffré
git add k8s/secrets.enc.yaml
git commit -m "chore(k8s): rotation secrets"
git push origin main
```

---

## Ce qui se passe au déploiement (VPS)

Quand `ci-deploy.sh` s'exécute sur le VPS :

```
1. docker pull  →  télécharge les nouvelles images
2. apply-secrets.sh
       └─ sops --decrypt secrets.enc.yaml  →  fichier temporaire
       └─ kubectl apply                    →  Secret K8s "gauzian-secrets" mis à jour
       └─ rm fichier temporaire            →  aucune trace en clair sur le disque
3. kubectl rollout restart  →  pods redémarrés avec les nouveaux secrets
```

---

## Fichiers du système

| Fichier | Rôle | Dans git ? |
|---------|------|-----------|
| `.sops.yaml` | Configuration SOPS (quelle clé, quel fichier) | ✅ Oui |
| `k8s/secrets.yaml` | Secrets en clair (pour édition) | ❌ Non (.gitignore) |
| `k8s/secrets.enc.yaml` | Secrets chiffrés | ✅ Oui |
| `k8s/secrets.yaml.example` | Template vide avec toutes les clés | ✅ Oui |
| `.githooks/pre-commit` | Hook : chiffrement auto au commit | ✅ Oui |
| `k8s/scripts/apply-secrets.sh` | Déchiffre + applique sur le cluster | ✅ Oui |
| `k8s/scripts/setup-dev.sh` | Setup initial dev (active les hooks) | ✅ Oui |

---

## Dépannage

**Le hook ne se déclenche pas**
```bash
# Réactiver les hooks
./k8s/scripts/setup-dev.sh
# ou
git config core.hooksPath .githooks
```

**Erreur "clé age introuvable"**
```bash
# Vérifier que la clé privée existe
ls ~/.config/sops/age/keys.txt

# Ou passer la clé via variable d'environnement
SOPS_AGE_KEY="AGE-SECRET-KEY-..." ./k8s/scripts/apply-secrets.sh
```

**Erreur "placeholder non remplacé"**
```
❌ .sops.yaml contient encore le placeholder de clé age.
```
→ Ouvrir `.sops.yaml` et remplacer `age1REMPLACER_PAR_TA_CLE_PUBLIQUE_AGE` par ta vraie clé publique.

**Appliquer les secrets manuellement sur le VPS (sans CI/CD)**
```bash
ssh vps 'bash /home/debian/gauzian/k8s/scripts/apply-secrets.sh'
```
