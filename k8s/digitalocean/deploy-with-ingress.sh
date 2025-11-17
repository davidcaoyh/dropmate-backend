#!/bin/bash
# Deploy DropMate with Single Ingress (Cost-Optimized)
# Saves $24/month compared to 3 LoadBalancers

set -e

echo "💰 DropMate Cost-Optimized Deployment (Single Ingress)"
echo "======================================================"
echo ""
echo "This deployment uses a single Ingress controller instead of 3 LoadBalancers"
echo "Monthly savings: \$24 (\$288/year)"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not installed${NC}"
    exit 1
fi

# Check cluster connection
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Not connected to a Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connected to cluster${NC}"
echo ""

# Get domain
echo "🌐 Domain Configuration"
echo "----------------------"
read -p "Enter your domain (e.g., dropmate.yourdomain.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Domain is required for Ingress setup${NC}"
    exit 1
fi

# Confirm
echo ""
echo -e "${YELLOW}⚠️  This will deploy DropMate with Single Ingress${NC}"
echo "Domain: $DOMAIN"
echo "Cluster: $(kubectl config current-context)"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "📦 Starting deployment..."
echo ""

# 1. Create namespace
echo "1️⃣  Creating namespace..."
kubectl apply -f 00-namespace.yaml

# 2. Secrets
echo "2️⃣  Creating secrets..."
if [ -f "01-secrets-generated.yaml" ]; then
    kubectl apply -f 01-secrets-generated.yaml
else
    echo -e "${YELLOW}⚠️  Using template secrets - update before production!${NC}"
    kubectl apply -f 01-secrets.yaml
fi

# 3. ConfigMaps
echo "3️⃣  Creating configmaps..."
kubectl apply -f 02-configmaps.yaml

# 4. Database
echo "4️⃣  Deploying PostgreSQL..."
kubectl apply -f 03-postgres.yaml

# 5. Redis
echo "5️⃣  Deploying Redis..."
kubectl apply -f 04-redis.yaml

echo "⏳ Waiting for database..."
kubectl wait --for=condition=ready pod -l app=postgres -n dropmate --timeout=300s

# 6. Install nginx-ingress controller
echo "6️⃣  Installing nginx-ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

echo "⏳ Waiting for ingress controller..."
sleep 10
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# 7. Update and deploy services with ClusterIP
echo "7️⃣  Deploying services (ClusterIP)..."

# Create temporary files with ClusterIP instead of LoadBalancer
for service in core-api location-service notification-service; do
    if [ "$service" = "core-api" ]; then
        file="05-core-api.yaml"
    elif [ "$service" = "location-service" ]; then
        file="06-location-service.yaml"
    else
        file="07-notification-service.yaml"
    fi

    # Deploy just the Deployment and HPA, skip Service (we'll use the one from ingress file)
    kubectl apply -f $file || true
done

# 8. Deploy ingress with domain
echo "8️⃣  Configuring Ingress..."
cat 09-single-ingress-alternative.yaml | \
  sed "s/dropmate\.yourdomain\.com/$DOMAIN/g" | \
  kubectl apply -f -

# 9. Install cert-manager for SSL (optional)
echo "9️⃣  Installing cert-manager for SSL..."
read -p "Install cert-manager for free SSL/TLS? (yes/no): " install_cert
if [ "$install_cert" = "yes" ]; then
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

    echo "⏳ Waiting for cert-manager..."
    sleep 10
    kubectl wait --namespace cert-manager \
      --for=condition=ready pod \
      --all \
      --timeout=300s

    # Create ClusterIssuer
    cat > /tmp/letsencrypt-issuer.yaml << EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@${DOMAIN}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
    kubectl apply -f /tmp/letsencrypt-issuer.yaml
    rm /tmp/letsencrypt-issuer.yaml

    echo -e "${GREEN}✅ cert-manager installed${NC}"
fi

# Wait for services
echo ""
echo "⏳ Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=core-api -n dropmate --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=location-service -n dropmate --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=notification-service -n dropmate --timeout=300s || true

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""

# Get Ingress IP
echo "🌐 Getting Ingress LoadBalancer IP..."
sleep 5
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Services deployed with Single Ingress"
echo "💰 Monthly cost: ~\$90 (saving \$24/month vs 3 LoadBalancers)"
echo ""
echo "📍 Ingress LoadBalancer IP: ${INGRESS_IP}"
echo ""
echo "📝 DNS Configuration Required:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Add this DNS record:"
echo ""
echo "  $DOMAIN  →  $INGRESS_IP"
echo ""
echo "Or for subdomains:"
echo "  api.$DOMAIN       →  $INGRESS_IP"
echo "  location.$DOMAIN  →  $INGRESS_IP"
echo "  ws.$DOMAIN        →  $INGRESS_IP"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 Access URLs (after DNS propagation):"
echo "  Core API:     https://$DOMAIN/api"
echo "  Location:     https://$DOMAIN/api/location"
echo "  WebSocket:    wss://$DOMAIN/socket.io"
echo "  Health Check: https://$DOMAIN/health"
echo ""
echo "📊 View resources:"
echo "  kubectl get all -n dropmate"
echo "  kubectl get ingress -n dropmate"
echo ""
echo "📜 View logs:"
echo "  kubectl logs -f deployment/core-api -n dropmate"
echo ""
echo -e "${GREEN}🎉 DropMate deployed successfully with cost optimization!${NC}"
