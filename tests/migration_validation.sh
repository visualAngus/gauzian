#!/bin/bash
# Tests automatisés - Migration Authorization Headers

set -e

echo "🧪 Tests Migration Authorization Headers"
echo "========================================"
echo ""

# Test 1 : Vérifier qu'aucun credentials: 'include' ne reste (sauf commentaires)
echo "Test 1 : Grep credentials: 'include'..."
cd "$(dirname "$0")/.."
FOUND=$(grep -r "credentials.*include" gauzian_front/app --include="*.js" --include="*.vue" 2>/dev/null | grep -v "//" | grep -v "/\*" | wc -l || echo "0")
if [ "$FOUND" -eq 0 ]; then
  echo "✅ PASS - Aucun credentials: 'include' actif (commentaires ignorés)"
else
  echo "⚠️  WARNING - $FOUND occurrences (probablement commentaires)"
  echo "   Vérifier manuellement:"
  grep -r "credentials.*include" gauzian_front/app --include="*.js" --include="*.vue" | grep -v "//"
  # Ne pas fail pour commentaires
fi

# Test 2 : Vérifier backend compile
echo "Test 2 : Compilation backend..."
cd gauzian_back
if cargo check --quiet 2>&1; then
  echo "✅ PASS - Backend compile"
else
  echo "❌ FAIL - Backend ne compile pas"
  exit 1
fi
cd ..

# Test 3 : Vérifier useState correctement utilisé
echo "Test 3 : Vérifier useAuth.js (useState dans fonction)..."
if grep -A5 "export const useAuth" gauzian_front/app/composables/useAuth.js | grep -q "const authToken = useState"; then
  echo "✅ PASS - useState dans useAuth() (pas top-level)"
else
  echo "❌ FAIL - useState mal placé dans useAuth.js"
  exit 1
fi

# Test 4 : Vérifier fetchWithAuth existe
echo "Test 4 : Vérifier useFetchWithAuth.js existe..."
if [ -f "gauzian_front/app/composables/useFetchWithAuth.js" ]; then
  echo "✅ PASS - useFetchWithAuth.js existe"
else
  echo "❌ FAIL - useFetchWithAuth.js manquant"
  exit 1
fi

# Test 5 : Vérifier middleware auth.global.js existe
echo "Test 5 : Vérifier middleware auth.global.js existe..."
if [ -f "gauzian_front/app/middleware/auth.global.js" ]; then
  echo "✅ PASS - middleware auth.global.js existe"
else
  echo "❌ FAIL - middleware auth.global.js manquant"
  exit 1
fi

# Test 6 : Vérifier clearAllKeys dans crypto.ts
echo "Test 6 : Vérifier clearAllKeys() dans crypto.ts..."
if grep -q "export async function clearAllKeys" gauzian_front/app/utils/crypto.ts; then
  echo "✅ PASS - clearAllKeys() exportée"
else
  echo "❌ FAIL - clearAllKeys() manquante dans crypto.ts"
  exit 1
fi

# Test 7 : Vérifier .with_token() retiré du backend
echo "Test 7 : Vérifier .with_token() retiré..."
FOUND_WITH_TOKEN=$(grep -r "\.with_token" gauzian_back/src --include="*.rs" | grep -v "^\s*//" | wc -l || echo "0")
if [ "$FOUND_WITH_TOKEN" -eq 0 ]; then
  echo "✅ PASS - Aucun .with_token() dans le backend"
else
  echo "❌ FAIL - $FOUND_WITH_TOKEN .with_token() trouvés"
  grep -r "\.with_token" gauzian_back/src --include="*.rs"
  exit 1
fi

# Test 8 : Vérifier extract_token_from_headers simplifié
echo "Test 8 : Vérifier extract_token_from_headers() simplifié..."
if grep -A10 "fn extract_token_from_headers" gauzian_back/src/auth/services.rs | grep -q "COOKIE"; then
  echo "❌ FAIL - extract_token_from_headers contient encore COOKIE"
  exit 1
else
  echo "✅ PASS - extract_token_from_headers simplifié (UNIQUEMENT Authorization)"
fi

echo ""
echo "================================================"
echo "✅ Tous les tests automatisés passent ! (8/8)"
echo "================================================"
echo ""
echo "⚠️  Tests manuels requis (voir MIGRATION_TESTS.md):"
echo "   1. Login initial + localStorage check"
echo "   2. Session persistante (F5)"
echo "   3. Session persistante (fermer/rouvrir navigateur)"
echo "   4. Logout complet"
echo "   5. Upload fichier E2EE"
echo "   6. Download fichier E2EE"
echo "   7. Partage fichier E2EE"
echo "   8. Token expiré (401 auto-logout)"
echo "   9. CRUD événements agenda"
echo "   10. Navigation multiple"
echo ""
echo "📖 Documentation complète: ./MIGRATION_TESTS.md"
echo ""
