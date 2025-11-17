# DropMate Kubernetes Deployment on DigitalOcean

Complete guide for deploying DropMate microservices architecture on DigitalOcean Kubernetes.

## 📋 Prerequisites

### 1. DigitalOcean Account
- Active DigitalOcean account
- Kubernetes cluster created (see below)
- `doctl` CLI installed and configured

### 2. Required Tools
```bash
# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# doctl (DigitalOcean CLI)
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.0/doctl-1.98.0-linux-amd64.tar.gz
tar xf ~/doctl-1.98.0-linux-amd64.tar.gz
sudo mv ~/doctl /usr/local/bin

# Authenticate
doctl auth init
```

### 3. Docker Registry
You need a container registry to host your Docker images. Options:
- **DigitalOcean Container Registry** (recommended)
- Docker Hub
- GitHub Container Registry

## 🚀 Quick Start

### Step 1: Create Kubernetes Cluster

```bash
# Create cluster via DigitalOcean CLI
doctl kubernetes cluster create dropmate-cluster \
  --region nyc1 \
  --version latest \
  --count 3 \
  --size s-2vcpu-4gb \
  --auto-upgrade=true \
  --surge-upgrade=true

# Or create via DigitalOcean Console:
# https://cloud.digitalocean.com/kubernetes/clusters/new
```

**Recommended Configuration:**
- **Node Pool:** 3 nodes
- **Node Size:** `s-2vcpu-4gb` (Basic Droplet - $24/mo each)
- **Region:** Choose closest to your users
- **Auto-upgrade:** Enabled

### Step 2: Connect kubectl to Cluster

```bash
# Download kubeconfig
doctl kubernetes cluster kubeconfig save dropmate-cluster

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### Step 3: Build and Push Docker Images

```bash
# Navigate to project root
cd /path/to/dropmate-backend

# Login to registry (example: DigitalOcean)
doctl registry login

# Build images
docker build -t registry.digitalocean.com/your-registry/dropmate-core-api:latest \
  -f services/core-api/Dockerfile \
  services/core-api

docker build -t registry.digitalocean.com/your-registry/dropmate-location-service:latest \
  -f services/location-service/Dockerfile \
  services/location-service

docker build -t registry.digitalocean.com/your-registry/dropmate-notification-service:latest \
  -f services/notification-service/Dockerfile \
  services/notification-service

# Push images
docker push registry.digitalocean.com/your-registry/dropmate-core-api:latest
docker push registry.digitalocean.com/your-registry/dropmate-location-service:latest
docker push registry.digitalocean.com/your-registry/dropmate-notification-service:latest
```

### Step 4: Configure Secrets

```bash
cd k8s/digitalocean

# Interactive secrets setup
./setup-secrets.sh

# This generates: 01-secrets-generated.yaml
# Review and customize as needed
```

### Step 5: Update Configuration

**Edit the following files:**

1. **05-core-api.yaml, 06-location-service.yaml, 07-notification-service.yaml**
   - Update image references to your registry
   - Example: `image: registry.digitalocean.com/your-registry/dropmate-core-api:latest`

2. **08-ingress.yaml** (if using Ingress)
   - Update domain names
   - Update email for Let's Encrypt

3. **02-configmaps.yaml**
   - Update CORS_ORIGIN with your frontend URL

### Step 6: Deploy to Kubernetes

```bash
# Run deployment script
./deploy.sh

# Or deploy manually in order:
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secrets-generated.yaml
kubectl apply -f 02-configmaps.yaml
kubectl apply -f 03-postgres.yaml
kubectl apply -f 04-redis.yaml
kubectl apply -f 05-core-api.yaml
kubectl apply -f 06-location-service.yaml
kubectl apply -f 07-notification-service.yaml
kubectl apply -f 08-ingress.yaml
```

### Step 7: Run Database Migrations

```bash
# Wait for core-api to be ready
kubectl wait --for=condition=ready pod -l app=core-api -n dropmate --timeout=300s

# Get pod name
POD_NAME=$(kubectl get pods -n dropmate -l app=core-api -o jsonpath='{.items[0].metadata.name}')

# Run migrations (if you have a migration script)
kubectl exec -it $POD_NAME -n dropmate -- npm run migrate

# Or initialize database manually
kubectl exec -it postgres-0 -n dropmate -- psql -U postgres -d dropmate -f /path/to/schema.sql
```

### Step 8: Verify Deployment

```bash
# Check all resources
kubectl get all -n dropmate

# Check pods
kubectl get pods -n dropmate

# Check services
kubectl get svc -n dropmate

# Get LoadBalancer IPs
kubectl get svc -n dropmate -o wide

# Check logs
kubectl logs -f deployment/core-api -n dropmate
```

## 🌐 Accessing Services

### Get External IPs

```bash
kubectl get svc -n dropmate
```

You'll see output like:
```
NAME                   TYPE           EXTERNAL-IP       PORT(S)
core-api               LoadBalancer   164.90.XXX.XX     80:XXXXX/TCP
location-service       LoadBalancer   164.90.XXX.XX     80:XXXXX/TCP
notification-service   LoadBalancer   164.90.XXX.XX     80:XXXXX/TCP
```

### Update DNS Records

Point your domains to the LoadBalancer IPs:
```
api.dropmate.com       → Core API External IP
location.dropmate.com  → Location Service External IP
ws.dropmate.com        → Notification Service External IP
```

### Test APIs

```bash
# Health check
curl http://<CORE-API-EXTERNAL-IP>/health

# API endpoint
curl http://<CORE-API-EXTERNAL-IP>/api/shipments
```

## 📊 Monitoring & Management

### View Logs

```bash
# Core API logs
kubectl logs -f deployment/core-api -n dropmate

# Location Service logs
kubectl logs -f deployment/location-service -n dropmate

# Notification Service logs
kubectl logs -f deployment/notification-service -n dropmate

# PostgreSQL logs
kubectl logs -f statefulset/postgres -n dropmate
```

### Scale Services

```bash
# Manual scaling
kubectl scale deployment core-api --replicas=5 -n dropmate

# Auto-scaling is configured via HPA (Horizontal Pod Autoscaler)
kubectl get hpa -n dropmate
```

### Update Deployment

```bash
# Update image
kubectl set image deployment/core-api core-api=registry.digitalocean.com/your-registry/dropmate-core-api:v2.0.0 -n dropmate

# Or edit deployment
kubectl edit deployment core-api -n dropmate

# Rollout status
kubectl rollout status deployment/core-api -n dropmate

# Rollback if needed
kubectl rollout undo deployment/core-api -n dropmate
```

### Database Backup

```bash
# Backup PostgreSQL
kubectl exec postgres-0 -n dropmate -- pg_dump -U postgres dropmate > backup.sql

# Restore
kubectl exec -i postgres-0 -n dropmate -- psql -U postgres dropmate < backup.sql
```

## 🔧 Troubleshooting

### Pods Not Starting

```bash
# Describe pod
kubectl describe pod <pod-name> -n dropmate

# Check events
kubectl get events -n dropmate --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n dropmate
```

### Database Connection Issues

```bash
# Verify postgres is running
kubectl get pods -n dropmate -l app=postgres

# Test connection from core-api pod
kubectl exec -it <core-api-pod> -n dropmate -- sh
# Inside pod:
nc -zv dropmate-postgres 5432
```

### LoadBalancer Pending

If LoadBalancer stays in `<pending>` state:
```bash
# Check DigitalOcean console for LoadBalancer creation
# Or use doctl:
doctl compute load-balancer list

# Check service annotations
kubectl describe svc core-api -n dropmate
```

### Image Pull Errors

```bash
# Check if registry is accessible
doctl registry kubernetes-manifest | kubectl apply -f -

# Verify image exists
doctl registry repository list-v2
```

## 🔐 Security Best Practices

1. **Secrets Management**
   - Never commit secrets to Git
   - Use separate secrets per environment
   - Rotate credentials regularly

2. **Network Policies**
   - Implement network policies to restrict pod communication
   - Use private networking for database

3. **RBAC**
   - Configure Role-Based Access Control
   - Limit kubectl access

4. **TLS/SSL**
   - Use Ingress with cert-manager for automatic SSL
   - Or configure SSL termination at LoadBalancer

## 💰 Cost Optimization

**Estimated Monthly Cost (DigitalOcean):**
- 3 nodes @ $24/mo = $72
- Load Balancers (3) @ $12/mo each = $36
- Block Storage (15GB) @ $1.50
- **Total:** ~$109/month

**Cost Saving Tips:**
1. Use single Ingress instead of 3 LoadBalancers: Save ~$24/mo
2. Reduce node count for dev/staging environments
3. Use node auto-scaling based on load
4. Implement pod disruption budgets for graceful scaling

## 📚 Additional Resources

- [DigitalOcean Kubernetes Docs](https://docs.digitalocean.com/products/kubernetes/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [DropMate API Documentation](../../api.md)
- [Docker Build Guide](../../DEPLOYMENT.md)

## 🆘 Support

For issues:
1. Check logs: `kubectl logs -f deployment/<service> -n dropmate`
2. Check events: `kubectl get events -n dropmate`
3. Review pod status: `kubectl get pods -n dropmate`
4. Check service status: `kubectl get svc -n dropmate`

## 📝 Cleanup

To delete everything:
```bash
# Delete all resources in namespace
kubectl delete namespace dropmate

# Or delete individual resources
kubectl delete -f .

# Delete cluster (via doctl)
doctl kubernetes cluster delete dropmate-cluster
```

---

**🎉 You're all set!** Your DropMate backend is now running as microservices on DigitalOcean Kubernetes!
