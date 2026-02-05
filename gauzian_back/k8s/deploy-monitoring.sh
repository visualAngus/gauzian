#!/bin/bash
set -e

echo "🚀 Déploiement de la stack monitoring (Prometheus + Grafana)"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Création du namespace monitoring...${NC}"
kubectl apply -f monitoring-namespace.yaml

echo -e "${BLUE}📊 Déploiement de Prometheus...${NC}"
kubectl apply -f prometheus-config.yaml
kubectl apply -f prometheus-deployment.yaml

echo -e "${BLUE}📈 Déploiement de Grafana...${NC}"
kubectl apply -f grafana-datasources.yaml
kubectl apply -f grafana-dashboards-provider.yaml
kubectl apply -f grafana-dashboard-gauzian.yaml
kubectl apply -f grafana-deployment.yaml

echo -e "${BLUE}🌐 Configuration Ingress (Traefik)...${NC}"
kubectl apply -f grafana-ingress.yaml

echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
echo -e "${YELLOW}⏳ Attente du démarrage des pods (60s)...${NC}"
sleep 10

echo ""
echo "📊 État des pods :"
kubectl get pods -n monitoring

echo ""
echo "💾 État des PVCs :"
kubectl get pvc -n monitoring

echo ""
echo -e "${GREEN}🎉 Stack monitoring déployée avec succès !${NC}"
echo ""
echo "🌐 Accès aux interfaces :"
echo "  - Grafana     : https://grafana.gauzian.pupin.fr"
echo "  - Prometheus  : https://prometheus.gauzian.pupin.fr"
echo ""
echo "🔐 Credentials Grafana :"
echo "  - Username : admin"
echo "  - Password : ChangeMe123!"
echo ""
echo -e "${YELLOW}⚠️  N'oubliez pas de changer le mot de passe admin !${NC}"
echo "   kubectl create secret generic grafana-credentials \\"
echo "     --namespace=monitoring \\"
echo "     --from-literal=admin-password=VotreMotDePasse \\"
echo "     --dry-run=client -o yaml | kubectl apply -f -"
echo ""
echo "📖 Documentation complète : MONITORING_SETUP.md"
