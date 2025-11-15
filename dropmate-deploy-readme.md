# Deploying `dropmate-backend` to DigitalOcean Kubernetes

This guide explains how to build the backend Docker image, push it to a registry, and deploy it to a **DigitalOcean Kubernetes cluster** named **`dropmate-backend`**.

---

## 1. Prerequisites

Before starting, ensure you have:

- A DigitalOcean account  
- Docker installed  
- `doctl` installed  
- `kubectl` installed  

Create a Kubernetes cluster on the DigitalOcean UI and name it:

```
dropmate-backend
```

---

## 2. Authenticate with DigitalOcean

Generate a Personal Access Token on DigitalOcean Dashboard → **API** → **Tokens**.

Login via CLI:

```bash
doctl auth init
```

List clusters:

```bash
doctl kubernetes cluster list
```

Save the kubeconfig for your cluster:

```bash
doctl kubernetes cluster kubeconfig save dropmate-backend
```

Verify connection:

```bash
kubectl get nodes
```

---

## 3. Build Docker Image (AMD64)

DigitalOcean Kubernetes nodes run **amd64**, so the image must be built for that architecture:

```bash
docker build --platform linux/amd64 -t <your-dockerhub-username>/<your-image-name>:<tag> .
```

Example placeholder:

```
docker build --platform linux/amd64 -t yourname/dropmate-backend:1.0 .
```

---

## 4. Push Image to Docker Registry

Push the image to Docker Hub (or any registry):

```bash
docker push <your-dockerhub-username>/<your-image-name>:<tag>
```

---

## 5. Update Kubernetes Deployment Image

Edit the deployment manifest:

```
k8s/backend-deployment.yaml
```

Update the image field:

```yaml
image: <your-dockerhub-username>/<your-image-name>:<tag>
```

This ensures Kubernetes pulls your newly built image.

---

## 6. Deploy to DigitalOcean Kubernetes

Apply all Kubernetes manifests:

```bash
kubectl apply -f k8s/
```

---

## 7. Verify Deployment

### Check pods

```bash
kubectl get pods -l app=dropmate-postgres
kubectl get pods -l app=dropmate-backend
```

### Check PVCs

```bash
kubectl get pvc
```

### Check StatefulSet (Postgres)

```bash
kubectl get sts
```

You should see:

```
dropmate-postgres
```

### Check Service

```bash
kubectl get svc dropmate-backend
```

---

## 8. Get External IP (LoadBalancer)

```bash
kubectl get svc dropmate-backend -o wide
```

Look for the `EXTERNAL-IP`, which will be your public endpoint.

---

## 9. Updating to a New Version

To deploy an updated image:

```bash
docker build --platform linux/amd64 -t <your-image>:<new-tag> .
docker push <your-image>:<new-tag>
```

Update the image in:

```
k8s/backend-deployment.yaml
```

Then re-apply:

```bash
kubectl apply -f k8s/
```

---

