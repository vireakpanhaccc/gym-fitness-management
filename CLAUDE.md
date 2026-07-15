# Project: Gym Fitness Management — Kubernetes Deployment

## Project Context
This is a microservices-based gym/fitness management system, built for a Cloud Native Development final project (AUPP, Summer 2026). The application code already exists; the remaining work is packaging and deploying it correctly on Kubernetes.

## Deployment Requirements (from assignment — must all be satisfied)
1. Deploy all microservices on a Kubernetes cluster using **YAML configuration files only** (no Helm charts, no `kubectl create` imperative commands as the final deliverable — everything must be reproducible via `kubectl apply -f`).
2. Multiple Pods may be created as required by the application architecture.
3. **All client requests must be routed through the API Gateway** — no microservice other than `api-gateway` should be reachable from outside the cluster.
4. Implement **database connectivity** for each microservice based on its functional requirements.
5. Configure **Fanout DNS** using a domain name (e.g. `auppgym.com`) — implemented via a Kubernetes `Ingress` resource that routes based on host/path to the API Gateway (and potentially fans out to multiple services).
6. Store log files or shared application data in a **Kubernetes Volume**, and demonstrate that data can be accessed from **multiple containers**.
7. Must be deployable and demoable locally using **Minikube**.

## Services (current repo structure)
- `api-gateway/` — single entry point; must route all traffic to backend services internally
- `identity-service/` — auth/login/user identity
- `member-service/` — gym member records
- `membership-service/` — membership plans/subscriptions/billing
- `trainer-service/` — trainer management
- `attendance-service/` — attendance/check-in tracking
- `workout-service/` — workout tracking/programs
- `nginx/` — purpose TBD; needs inspection (may be legacy reverse proxy, may be repurposed as part of Ingress config, or may be dropped in favor of native K8s Ingress)

> **Action for Claude Code:** inspect each service folder's Dockerfile, entry point, and dependency file (package.json / requirements.txt / pom.xml / go.mod) to confirm language, framework, exposed port, and existing env vars before writing any YAML. Also inspect `nginx/` contents and report its current purpose before deciding whether to keep, replace, or repurpose it.

## Architecture Decisions (fill in as decided)
- **Container registry / image strategy:** [e.g. build locally, load into Minikube via `minikube image load` or `eval $(minikube docker-env)`]
- **Database(s):** [e.g. Postgres/MySQL/MongoDB — one shared instance vs. one per service — TBD, confirm from each service's existing DB connection code]
- **Service exposure:** all microservices = `ClusterIP` only. Only `api-gateway` is fronted by the `Ingress`.
- **Ingress / Fanout DNS:** domain `auppgym.com`, resolved locally via `/etc/hosts` → `minikube ip`. Ingress controller = `ingress-nginx` (enabled via `minikube addons enable ingress`).
- **Shared Volume:** [decide which 2+ services share a volume for logs — e.g. `api-gateway` + one backend service] mounted at a common path (e.g. `/var/log/app`) via a shared `PersistentVolumeClaim` (`ReadWriteMany`, `hostPath`-backed for Minikube).
- **Namespace:** [e.g. `gym-fitness` — confirm whether a dedicated namespace is required or default is fine]
- **Config/Secrets:** DB credentials and connection strings go in `ConfigMap`/`Secret` objects, injected as env vars — not hardcoded in Deployment YAML.

## Repo / Manifest Organization
```
k8s/
  namespace.yaml
  configmaps-secrets.yaml
  microservices/
    <service>-deployment.yaml
    <service>-service.yaml
  databases/
    <db>-deployment.yaml
    <db>-pvc.yaml
    <db>-service.yaml
  gateway/
    gateway-deployment.yaml
    gateway-service.yaml
    ingress.yaml
  shared-volume/
    shared-pv.yaml
    shared-pvc.yaml
```

## Team Split (3 members)
- **Member A — Microservices & Databases:** Dockerfiles, Deployment + Service YAML per microservice, DB Deployments/StatefulSets + PVCs + Services, ConfigMaps/Secrets, verifying each service connects to its DB.
- **Member B — API Gateway & Ingress (Fanout DNS):** Gateway Deployment/Service, Ingress YAML for `auppgym.com`, enabling Minikube ingress addon, verifying all traffic funnels through the gateway and backend services aren't directly reachable externally.
- **Member C — Shared Volume, Logging & Integration/Demo:** Shared PV/PVC YAML, mounting into 2+ services, implementing/verifying shared log writes, full-stack integration testing (`minikube start` → `kubectl apply -f k8s/` → working demo), demo script/runbook for presentation.

## Working Agreement for Claude Code Sessions
- Always inspect existing code before generating YAML — never assume ports/env vars/framework.
- Generate YAML **incrementally** in this order: ConfigMaps/Secrets → Databases → Microservices → API Gateway → Ingress → Shared Volume. Confirm each layer works (`kubectl get pods`, logs) before moving to the next.
- After generating each component, add a short rationale note (why this resource type, why this access mode, etc.) so each team member can explain their part to the professor individually.
- Do not introduce Helm, Kustomize, or imperative `kubectl` commands as the final deliverable mechanism — YAML files applied via `kubectl apply -f` only, per assignment constraint.

## Open Questions (resolve before/while building)
- [ ] What is inside `nginx/` and is it still needed once K8s Ingress is in place?
- [ ] Which database engine(s) are actually used per service (check existing service code/config)?
- [ ] Is one DB instance shared across services, or one per service?
- [ ] Which services will demonstrate the shared log volume for the demo?
- [ ] Final domain routing scheme: single host with path-based fanout (`auppgym.com/gateway/...`), or multiple subdomains fanning out to the gateway?
