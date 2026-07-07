# Kubernetes Deployment — Demo Instructions

This is the step-by-step script for demoing the gym-fitness-management microservices on Minikube. Each step is mapped to one line of the assignment's Project Deployment Instructions so it's obvious to the professor which requirement is being satisfied.

## Requirement map

| # | Requirement | Proven by |
|---|---|---|
| 1 | Deploy microservices on K8s using **YAML files only** | `find k8s -type f` + `kubectl apply -f k8s/` (no Helm/Kustomize anywhere in the repo) |
| 2 | May create **multiple Pods** as needed | `member-service` runs `replicas: 2` |
| 3 | **All client requests routed through the API Gateway** | Every backend Service is `ClusterIP`; the Ingress only ever targets `gateway-service` |
| 4 | **Database connectivity** per service | Live `register`/`login` round-trip to MongoDB via `identity-service` |
| 5 | **Fanout DNS** via a domain name | `Ingress` resource routes host `aupp.com` → `gateway-service` |
| 6 | **Shared Volume**, accessible from multiple containers | `identity-service` + `member-service` (2 pods) all write to one PVC-backed log file |
| 7 | Deployable/demoable on **Minikube** | The entire demo runs on a local Minikube cluster |

---

## Part 1 — Environment setup (do this *before* the professor arrives)

1. **Start Docker Desktop**, then start the cluster:
   ```bash
   minikube start
   ```

2. **Build and load all 7 app images** into Minikube's own Docker daemon (`imagePullPolicy: Never` means nothing gets pulled from a registry):
   ```bash
   eval $(minikube docker-env)
   cd gym-fitness-management
   for svc in api-gateway identity-service member-service membership-service trainer-service workout-service attendance-service; do
     docker build -t "${svc}:local" "./${svc}"
   done
   ```
   > Use `${svc}:local` with braces if your shell is zsh — an unbraced `$svc:local` gets misparsed as a zsh history modifier (`:l` = lowercase) and silently builds the wrong tag.

3. **Apply the manifests in order**, waiting for each layer to be healthy before moving on:
   ```bash
   kubectl apply -f k8s/namespace.yaml
   kubectl apply -f k8s/configmaps-secrets.yaml

   kubectl apply -f k8s/databases/
   kubectl -n gym-fitness wait --for=condition=Ready pod -l app=mongo --timeout=120s

   kubectl apply -f k8s/microservices/

   kubectl apply -f k8s/gateway/gateway-deployment.yaml -f k8s/gateway/gateway-service.yaml

   kubectl apply -f k8s/shared-volume/
   kubectl -n gym-fitness wait --for=condition=Ready pod -l app=identity-service --timeout=60s
   kubectl -n gym-fitness wait --for=condition=Ready pod -l app=member-service --timeout=60s
   ```

4. **Enable the ingress addon and apply the Ingress**:
   ```bash
   minikube addons enable ingress
   kubectl apply -f k8s/gateway/ingress.yaml
   kubectl -n gym-fitness get ingress   # wait until ADDRESS is populated
   ```

5. **Point the domain at your machine**:
   ```bash
   echo "127.0.0.1 aupp.com" | sudo tee -a /etc/hosts
   ```

6. **Start the tunnel in its own dedicated terminal window and leave it running** for the whole demo:
   ```bash
   minikube tunnel
   ```

7. **Seed the first admin user** directly on `identity-service` (the gateway's `/register` requires an admin token, so the very first admin has to be created this way once):
   ```bash
   kubectl -n gym-fitness exec deploy/identity-service -- wget -qO- \
     --header='Content-Type: application/json' \
     --post-data='{"name":"Admin","email":"admin@gym.com","password":"admin123","role":"admin"}' \
     http://localhost:3001/register
   ```

8. **Do one full dry run** of Part 2 yourself before the professor sits down.

---

## Part 2 — Live demo script

### Requirement 1 — YAML only
```bash
find k8s -type f
```
> "21 plain manifests under `k8s/`, applied with `kubectl apply -f k8s/`. No Helm charts, no imperative `kubectl create` commands."

### Requirement 2 — Multiple Pods
```bash
kubectl get pods -n gym-fitness -o wide
```
> "9 pods total. `member-service` runs 2 replicas since it's the most-used service — Kubernetes load-balances across both automatically via its Service."

### Requirement 3 — All traffic through the API Gateway
```bash
kubectl get svc -n gym-fitness
```
> "Every Service — all 6 backends, Mongo, and the gateway itself — is `ClusterIP`. Nothing but the gateway is reachable from outside the cluster. The only externally-facing object is the Ingress, and it only ever points at `gateway-service`:"
```bash
cat k8s/gateway/ingress.yaml
```

### Requirements 4 & 5 — Database connectivity + Fanout DNS (shown together)
```bash
curl -X POST http://aupp.com/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gym.com","password":"admin123"}'
```
> "That request went `aupp.com` → Ingress (host-based routing = the Fanout DNS piece) → `gateway-service` → `identity-service` → MongoDB, and came back with a signed JWT — proving both the domain routing and the DB round-trip in one call."

```bash
kubectl get ingress -n gym-fitness
```
> "The Ingress binds the host `aupp.com` to an address — that's the domain-based fanout entry point."

Optional — register a second user and hit an authenticated route to show a write path too:
```bash
TOKEN=$(curl -s -X POST http://aupp.com/login -H "Content-Type: application/json" \
  -d '{"email":"admin@gym.com","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl http://aupp.com/members -H "Authorization: Bearer $TOKEN"
```

### Requirement 6 — Shared Volume across multiple containers
Open two terminal panes side by side:
```bash
# pane A
kubectl exec deploy/identity-service -- cat /var/log/app/access.log

# pane B
kubectl exec deploy/member-service -- cat /var/log/app/access.log
```
> "Two different microservices, three different containers (identity-service's 1 pod + member-service's 2 pods) — all writing to and reading the exact same file, because they mount the same PersistentVolumeClaim."

For extra effect, fire one more request live and re-run both `cat` commands so a new line appears in both outputs at once:
```bash
curl http://aupp.com/members -H "Authorization: Bearer $TOKEN"
```

### Requirement 7 — Runs on Minikube
```bash
minikube status
kubectl get nodes
```
> "Everything just shown is running on this local Minikube cluster."

---

## Part 3 — Troubleshooting during the demo

- **`aupp.com` suddenly stops resolving** → the `minikube tunnel` window was closed or went to sleep. Restart it in its dedicated terminal.
- **Testing in a browser instead of curl** → don't navigate directly to `/login` — it's a POST-only route and a browser address bar only sends GET, so you'll see "Cannot GET /login" (expected, not a bug). Also disable "Secure DNS" / DNS-over-HTTPS in the browser settings first — otherwise the browser resolves `aupp.com` via the real public internet instead of your `/etc/hosts` override.
- **A pod is `CrashLoopBackOff` or `Pending`** → `kubectl logs <pod>` and `kubectl describe pod <pod>` live; showing visible debugging is fine, don't panic-restart.
- **Tunnel/sudo not available on the demo machine** → fallback that doesn't need the tunnel:
  ```bash
  kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8080:80
  curl -H "Host: aupp.com" http://localhost:8080/login -X POST \
    -H "Content-Type: application/json" -d '{"email":"admin@gym.com","password":"admin123"}'
  ```

---

## Part 4 — Cleanup (after the demo, optional)
```bash
kubectl delete namespace gym-fitness
minikube stop
```
