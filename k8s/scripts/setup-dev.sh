#!/bin/bash
# ============================================================
# setup-dev.sh — Configuration de l'environnement de développement
# ============================================================
#
# À lancer une seule fois après avoir cloné le repo.
# Active le pre-commit hook pour le chiffrement automatique des secrets.
#
# Usage :
#   ./k8s/scripts/setup-dev.sh
#
# ============================================================

set -euo pipefail

echo "🛠️  Configuration de l'environnement de développement GAUZIAN..."

# Activer le répertoire de hooks custom
git config core.hooksPath .githooks
echo "✅ Hooks git activés (.githooks/pre-commit)"

# Vérifier les outils nécessaires
echo ""
echo "🔍 Vérification des outils..."

check_tool() {
  if command -v "$1" &> /dev/null; then
    echo "  ✅ $1 installé"
  else
    echo "  ❌ $1 manquant → $2"
  fi
}

check_tool "sops"    "apt install sops  ou  https://github.com/getsops/sops/releases"
check_tool "age"     "apt install age"
check_tool "kubectl" "https://kubernetes.io/docs/tasks/tools/"

# Vérifier la clé age
echo ""
AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
if [[ -f "$AGE_KEY_FILE" ]]; then
  echo "✅ Clé age trouvée : $AGE_KEY_FILE"
else
  echo "⚠️  Clé age non trouvée. Pour en créer une :"
  echo "   mkdir -p ~/.config/sops/age"
  echo "   age-keygen -o ~/.config/sops/age/keys.txt"
  echo "   → Puis copier la clé publique (age1...) dans .sops.yaml"
fi

# Vérifier le placeholder dans .sops.yaml
if grep -q "REMPLACER_PAR_TA_CLE_PUBLIQUE_AGE" .sops.yaml 2>/dev/null; then
  echo ""
  echo "⚠️  .sops.yaml contient encore le placeholder."
  echo "   → Remplace 'age1REMPLACER_PAR_TA_CLE_PUBLIQUE_AGE' par ta clé publique age"
fi

echo ""
echo "🎉 Setup terminé !"
echo ""
echo "Workflow secrets :"
echo "  1. cp k8s/secrets.yaml.example k8s/secrets.yaml"
echo "  2. Remplir les valeurs dans k8s/secrets.yaml"
echo "  3. git add k8s/secrets.yaml && git commit -m '...'"
echo "     → Le hook chiffre automatiquement et committe secrets.enc.yaml"
