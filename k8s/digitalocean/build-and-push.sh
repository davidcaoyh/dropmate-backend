#!/bin/bash
# Build and push Docker images for all DropMate microservices

set -e

echo "🐳 DropMate Docker Build & Push"
echo "================================"

# Configuration
REGISTRY=${DOCKER_REGISTRY:-"registry.digitalocean.com/your-registry"}
VERSION=${VERSION:-"latest"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}Registry: $REGISTRY${NC}"
echo -e "${YELLOW}Version: $VERSION${NC}"
echo ""

# Navigate to project root
cd "$(dirname "$0")/../.."
PROJECT_ROOT=$(pwd)

echo "📂 Project root: $PROJECT_ROOT"
echo ""

# Build images
echo "🔨 Building Docker images..."
echo ""

# Core API
echo "1️⃣  Building Core API..."
docker build \
  -t $REGISTRY/dropmate-core-api:$VERSION \
  -t $REGISTRY/dropmate-core-api:latest \
  -f services/core-api/Dockerfile \
  services/core-api

echo -e "${GREEN}✅ Core API built${NC}"
echo ""

# Location Service
echo "2️⃣  Building Location Service..."
docker build \
  -t $REGISTRY/dropmate-location-service:$VERSION \
  -t $REGISTRY/dropmate-location-service:latest \
  -f services/location-service/Dockerfile \
  services/location-service

echo -e "${GREEN}✅ Location Service built${NC}"
echo ""

# Notification Service
echo "3️⃣  Building Notification Service..."
docker build \
  -t $REGISTRY/dropmate-notification-service:$VERSION \
  -t $REGISTRY/dropmate-notification-service:latest \
  -f services/notification-service/Dockerfile \
  services/notification-service

echo -e "${GREEN}✅ Notification Service built${NC}"
echo ""

# List images
echo "📦 Built images:"
docker images | grep dropmate

echo ""
echo "🚀 Ready to push images"
read -p "Push to registry? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Push cancelled. Images are built locally."
    exit 0
fi

# Push images
echo ""
echo "⬆️  Pushing images to $REGISTRY..."
echo ""

echo "Pushing Core API..."
docker push $REGISTRY/dropmate-core-api:$VERSION
docker push $REGISTRY/dropmate-core-api:latest

echo "Pushing Location Service..."
docker push $REGISTRY/dropmate-location-service:$VERSION
docker push $REGISTRY/dropmate-location-service:latest

echo "Pushing Notification Service..."
docker push $REGISTRY/dropmate-notification-service:$VERSION
docker push $REGISTRY/dropmate-notification-service:latest

echo ""
echo -e "${GREEN}✅ All images pushed successfully!${NC}"
echo ""
echo "📝 Next steps:"
echo "1. Update Kubernetes deployments with new image tags"
echo "2. Apply changes: kubectl apply -f k8s/digitalocean/"
echo "3. Watch rollout: kubectl rollout status deployment/core-api -n dropmate"
