#!/bin/bash
# Helper script to generate Kubernetes secrets
# This script helps you create base64-encoded secrets for deployment

echo "🔐 DropMate Kubernetes Secrets Generator"
echo "========================================"
echo ""

# Function to encode string to base64
encode() {
    echo -n "$1" | base64 -w 0
}

echo "This script will help you generate secrets for your deployment"
echo ""

# PostgreSQL credentials
echo "📊 PostgreSQL Configuration"
echo "-------------------------"
read -p "PostgreSQL User [postgres]: " POSTGRES_USER
POSTGRES_USER=${POSTGRES_USER:-postgres}

read -sp "PostgreSQL Password: " POSTGRES_PASSWORD
echo ""

read -p "PostgreSQL Database [dropmate]: " POSTGRES_DB
POSTGRES_DB=${POSTGRES_DB:-dropmate}

# Database URL
DB_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@dropmate-postgres:5432/${POSTGRES_DB}"

echo ""
echo "🔑 JWT Secret"
echo "-------------"
read -sp "JWT Secret (leave empty to generate): " JWT_SECRET
echo ""
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "Generated JWT Secret: $JWT_SECRET"
fi

echo ""
echo "🔥 Firebase Configuration"
echo "------------------------"
read -p "Firebase Project ID: " FIREBASE_PROJECT_ID
read -p "Firebase Client Email: " FIREBASE_CLIENT_EMAIL
echo "Paste Firebase Private Key (including -----BEGIN/END PRIVATE KEY-----), then press Ctrl+D:"
FIREBASE_PRIVATE_KEY=$(cat)

echo ""
echo "📝 Generating secrets file..."

cat > 01-secrets-generated.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: dropmate
type: Opaque
data:
  POSTGRES_USER: $(encode "$POSTGRES_USER")
  POSTGRES_PASSWORD: $(encode "$POSTGRES_PASSWORD")
  POSTGRES_DB: $(encode "$POSTGRES_DB")
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
  namespace: dropmate
type: Opaque
data:
  DATABASE_URL: $(encode "$DB_URL")
  JWT_SECRET: $(encode "$JWT_SECRET")
  REDIS_URL: $(encode "redis://redis-service:6379")
---
apiVersion: v1
kind: Secret
metadata:
  name: firebase-secret
  namespace: dropmate
type: Opaque
data:
  FIREBASE_PROJECT_ID: $(encode "$FIREBASE_PROJECT_ID")
  FIREBASE_CLIENT_EMAIL: $(encode "$FIREBASE_CLIENT_EMAIL")
  FIREBASE_PRIVATE_KEY: $(encode "$FIREBASE_PRIVATE_KEY")
EOF

echo ""
echo "✅ Secrets file generated: 01-secrets-generated.yaml"
echo ""
echo "⚠️  IMPORTANT: This file contains sensitive data!"
echo "   - Do NOT commit it to version control"
echo "   - Keep it secure"
echo "   - Delete it after deployment"
echo ""
echo "To deploy secrets:"
echo "  kubectl apply -f 01-secrets-generated.yaml"
echo ""
echo "To delete the secrets file (after deployment):"
echo "  rm 01-secrets-generated.yaml"
