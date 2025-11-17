#!/bin/bash
# DropMate Kubernetes Deployment Script for DigitalOcean
# This script deploys all microservices to a DigitalOcean Kubernetes cluster

set -e  # Exit on error

echo "🚀 DropMate Kubernetes Deployment"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Not connected to a Kubernetes cluster${NC}"
    echo "Please configure kubectl to connect to your DigitalOcean cluster"
    exit 1
fi

echo -e "${GREEN}✅ Connected to Kubernetes cluster${NC}"
kubectl cluster-info

# Confirm deployment
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will deploy DropMate to the connected cluster${NC}"
echo "Cluster: $(kubectl config current-context)"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "📦 Deploying DropMate microservices..."
echo ""

# Deploy in order (files are numbered)
echo "1️⃣  Creating namespace..."
kubectl apply -f 00-namespace.yaml

echo "2️⃣  Creating secrets..."
kubectl apply -f 01-secrets.yaml

echo "3️⃣  Creating configmaps..."
kubectl apply -f 02-configmaps.yaml

echo "4️⃣  Deploying PostgreSQL database..."
kubectl apply -f 03-postgres.yaml

echo "5️⃣  Deploying Redis..."
kubectl apply -f 04-redis.yaml

echo "⏳ Waiting for database to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n dropmate --timeout=300s

echo "6️⃣  Deploying Core API service..."
kubectl apply -f 05-core-api.yaml

echo "7️⃣  Deploying Location service..."
kubectl apply -f 06-location-service.yaml

echo "8️⃣  Deploying Notification service..."
kubectl apply -f 07-notification-service.yaml

echo "9️⃣  Configuring Ingress (if using)..."
kubectl apply -f 08-ingress.yaml || echo "⚠️  Ingress not configured (using LoadBalancers)"

echo ""
echo "⏳ Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=core-api -n dropmate --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=location-service -n dropmate --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=notification-service -n dropmate --timeout=300s || true

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Deployment Status:"
echo "===================="
kubectl get all -n dropmate

echo ""
echo "🌐 Service URLs:"
echo "==============="
echo "Getting LoadBalancer IPs (this may take a few minutes)..."
sleep 5
kubectl get svc -n dropmate

echo ""
echo "📝 Next Steps:"
echo "1. Update DNS records to point to LoadBalancer IPs"
echo "2. Run database migrations: kubectl exec -it <core-api-pod> -n dropmate -- npm run migrate"
echo "3. Check logs: kubectl logs -f deployment/core-api -n dropmate"
echo "4. Monitor: kubectl get pods -n dropmate -w"

echo ""
echo -e "${GREEN}🎉 DropMate is now running on Kubernetes!${NC}"
