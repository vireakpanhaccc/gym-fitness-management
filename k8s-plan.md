# Kubernetes Deployment Plan — Gym Fitness Management

## Context

This repo already has a **working, completed EC2 + Docker Compose deployment** (see [plan.md](plan.md), [EC2-DEPLOYMENT.md](EC2-DEPLOYMENT.md), [rubric.md](rubric.md)/[rubricguide.md](rubricguide.md), and recent commits `ec2 deployment` / `dockerfile custom nginx`). That deployment is graded on a separate rubric (Docker architecture, JWT/RBAC, DB connectivity, docs, load balancing) and is **not being touched by this plan**.

[CLAUDE.md](CLAUDE.md) describes a **separate, follow-on Cloud Native Development assignment**: redeploy the same microservices on **Kubernetes** (Minikube), satisfying Ingress/Fanout DNS, shared-volume, and database-connectivity requirements that don't exist in the EC2 rubric. Both tracks are real and independent — this plan covers only the Kubernetes track.

Inspection of all 7 services + `nginx/` confirmed the current state everything below is designed against.

## Pre-Demo Manual Checklist

Do these before `kubectl apply -f k8s/` (or a fresh demo run):

- [ ] Start Docker Desktop, then `minikube start` (no profile assumed running)
- [ ] Build + load all 7 app images into Minikube's Docker daemon:
      `eval $(minikube docker-env)`, then for each of
      `api-gateway`, `identity-service`, `member-service`, `membership-service`,
      `trainer-service`, `workout-service`, `attendance-service`:
      `docker build -t <service>:local ./<service-dir>`
      (`mongo:7.0` is pulled normally — no build needed)
- [ ] `minikube addons enable ingress`, confirm the `ingress-nginx` controller pod is `Running`
- [ ] Add `auppgym.com` to `/etc/hosts`, pointed at `127.0.0.1`
- [ ] Run `minikube tunnel` in its own terminal and keep it running for the whole demo
      (macOS + docker driver: `minikube ip` is not directly routable, so this is required —
      verify with `curl` before presenting, not during)
- [ ] Apply in order, verifying each step (full detail in "Rollout order" below):
      namespace → configmaps-secrets → databases (wait for Mongo `Ready`) →
      microservices → gateway deployment+service → ingress.yaml → shared-volume

Advisory (not blocking, worth knowing):
- `configmaps-secrets.yaml` commits real plaintext demo credentials via `stringData` — fine for
  this class deployment, rotate before any non-classroom reuse.
- The shared-log PV uses a plain `hostPath` — only correct on a single-node cluster; don't run
  `minikube start --nodes=2`.

## Confirmed inventory (from code inspection)

| Service | Port | DB env var read | Notes |
|---|---|---|---|
| `api-gateway` | 3000 | — | Express 5 + `http-proxy`. Hardcodes downstream **ports** as string literals per route in [api-gateway/index.js](api-gateway/index.js) (`:3001` identity, `:3002` member, `:3003` trainer, `:3004` workout, `:3005` membership, `:3006` attendance); hostnames come from env vars `IDENTITY_IP`, `MEMBER_IP`/`MEMBER_LB_URL`, `TRAINER_IP`, `WORKOUT_IP`, `MEMBERSHIP_IP`, `ATTENDANCE_IP`. Also reads `JWT_SECRET`. |
| `identity-service` | 3001 | `uri` (lowercase) | Also reads `JWT_SECRET` — **must match api-gateway's value byte-for-byte** or token verification breaks. |
| `member-service` | 3002 | `uri` | Currently 2 compose instances (`member-service-1/2`), differentiated by `INSTANCE` env var used only in a log line ([member-service/index.js](member-service/index.js)) — free hook for proving load-balancing. |
| `membership-service` | 3005 | `MONGO_URI` (differs from the rest — Express 4/Mongoose 7, older majors) | |
| `trainer-service` | 3003 | `uri` | |
| `workout-service` | 3004 | `uri` | |
| `attendance-service` | 3006 | `uri` | Also reads a `members` Mongoose collection directly — shares data with member-service. |

All 7 have working Dockerfiles (`FROM node:22-alpine`, `EXPOSE <port>`, `CMD ["node","index.js"]`). Currently all 6 backend services connect to one **external MongoDB Atlas** cluster (no self-hosted DB, no per-service DB). None of the 6 write log files — only `console.log`. `nginx/` currently does two jobs in compose: public :80 → api-gateway, internal :8081 → load-balances member-service-1/2.

## Confirmed architecture decisions

1. **Database**: Deploy a **self-hosted MongoDB in-cluster** (single shared instance, matching the current single-shared-cluster pattern) — replaces external Atlas entirely for the K8s deployment. `Deployment` (not StatefulSet — single replica, no replica set, `strategy.type: Recreate` to avoid dual-attach on the RWO PVC), + dynamic RWO PVC (Minikube's default `standard` StorageClass), + ClusterIP Service `mongo-service`. Credentials via Secret. Both `uri` and `MONGO_URI` keys populated with the same connection string in the Secret, to transparently satisfy the existing naming split across services with zero app-code changes.
2. **Shared log volume**: Add a small file-logging middleware to **`identity-service` + `member-service`** (recommended pairing — member-service already runs 2 replicas, so this alone proves intra-service sharing; adding identity-service proves inter-service sharing too — 3 containers, 2 services, 1 file). Mount path `/var/log/app`, shared file `access.log`, log line format `<timestamp> [<service>] [pod:<hostname>] <method> <path> -> <status>` using `os.hostname()` (reliably equals the pod name in K8s) via a `fs.appendFile`/`createWriteStream({flags:'a'})` middleware — `O_APPEND` writes are atomic per line, no locking needed. PV: hand-written `hostPath`, `ReadWriteMany`, `storageClassName: manual`, `type: DirectoryOrCreate`. PVC: matching `manual` storageClass + RWX. (RWX is required here specifically because member-service's 2 replicas both mount it simultaneously.)
3. **nginx**: Dropped entirely. Its public-facing job is replaced by a K8s **Ingress** (`ingress-nginx`, via `minikube addons enable ingress`) in front of api-gateway only. Its member-service load-balancing job is replaced by a plain ClusterIP **Service** in front of a `member-service` Deployment with `replicas: 2` — Kubernetes Services load-balance across matching pods natively, no code/config needed beyond that.
4. **Exposure**: all 6 backend services + Mongo stay ClusterIP-only. Only `api-gateway`'s Service is referenced by the Ingress — this is structurally enforced by never writing an Ingress rule that names any other Service.
5. **Fanout DNS**: domain `auppgym.com`, resolved via `/etc/hosts` → the reachable cluster IP (see Minikube gotcha below — NOT simply `minikube ip` on macOS/docker-driver). Because requirement #4 forbids exposing any service besides the gateway, "fanout" is expressed as multiple **path-based** Ingress rules that all point at `gateway-service:3000` (mirroring api-gateway's actual route prefixes: `/register`, `/login`, `/users`, `/members`, `/trainers`, `/workouts`, `/plans`, `/checkin`, `/checkout`, `/attendance`), plus a catch-all `/` rule to the same backend. The real multi-service fan-out happens one hop downstream, inside api-gateway itself, exactly as the assignment's parenthetical describes ("fans out to multiple services" via the gateway).
6. **Namespace**: dedicated `gym-fitness` namespace (clean teardown via one `kubectl delete namespace`, matches the fixed file tree already implying a non-default namespace).

## Manifest file plan (fixed tree from CLAUDE.md)

```
k8s/
  namespace.yaml                          # Namespace: gym-fitness
  configmaps-secrets.yaml                 # ConfigMap app-config + Secret app-secrets
  microservices/
    identity-service-deployment.yaml      # + shared-log-pvc mount
    identity-service-service.yaml
    member-service-deployment.yaml        # replicas: 2, + shared-log-pvc mount, INSTANCE via Downward API
    member-service-service.yaml
    membership-service-deployment.yaml
    membership-service-service.yaml
    trainer-service-deployment.yaml
    trainer-service-service.yaml
    workout-service-deployment.yaml
    workout-service-service.yaml
    attendance-service-deployment.yaml
    attendance-service-service.yaml
  databases/
    mongo-deployment.yaml                 # replicas: 1, strategy: Recreate
    mongo-pvc.yaml                        # RWO, dynamic (no mongo-pv.yaml needed)
    mongo-service.yaml                    # ClusterIP :27017
  gateway/
    gateway-deployment.yaml
    gateway-service.yaml                  # ClusterIP :3000 — only Service the Ingress may reference
    ingress.yaml                          # host auppgym.com, path rules -> gateway-service
  shared-volume/
    shared-pv.yaml                        # hostPath, RWX, storageClassName: manual
    shared-pvc.yaml                       # RWX, storageClassName: manual
```

### ConfigMap `app-config` (non-sensitive)
`IDENTITY_IP=identity-service`, `MEMBER_IP=member-service`, `TRAINER_IP=trainer-service`, `WORKOUT_IP=workout-service`, `MEMBERSHIP_IP=membership-service`, `ATTENDANCE_IP=attendance-service`. Deliberately **no `MEMBER_LB_URL` key** — leaving it unset makes `api-gateway/index.js`'s existing fallback (`MEMBER_LB_URL || http://${MEMBER_IP}:3002`) resolve to the `member-service` Service, which now load-balances across both pods itself. `PORT` is intentionally *not* in the ConfigMap (kept as a literal per-Deployment `env` entry instead) since api-gateway hardcodes each target port in source — a ConfigMap-level `PORT` would misleadingly imply it's independently tunable.

### Secret `app-secrets` (sensitive, `type: Opaque`)
`JWT_SECRET` (shared by identity-service + api-gateway), `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` (mongo Deployment only), and `uri` + `MONGO_URI` (identical connection string, e.g. `mongodb://<user>:<pass>@mongo-service:27017/gymfitness?authSource=admin`, both keys populated so every service's existing code — whichever variable name it happens to read — just works).

All 7 app Deployments get a blanket `envFrom: [configMapRef: app-config, secretRef: app-secrets]` plus one literal `PORT` value each — simplest, keeps all manifests structurally identical, unused keys per-service are harmless.

## Rollout order (per CLAUDE.md working agreement) + verification checkpoints

1. `namespace.yaml` → `configmaps-secrets.yaml`. Verify: `kubectl -n gym-fitness get configmap,secret`.
2. `databases/`. Verify Mongo pod reaches `Running`/`Ready` **before** applying microservices — every service's `dbConnect.js` calls `process.exit(1)` on connection failure, so applying services before Mongo is ready causes a simultaneous `CrashLoopBackOff` across all 6.
3. `microservices/`. Verify all 6 pods `Running`; identity-service/member-service will show pending volume mounts until step 6 (expected — Kubernetes tolerates a Deployment referencing a not-yet-existing PVC, unlike compose's imperative ordering).
4. `gateway/gateway-deployment.yaml` + `gateway-service.yaml` (not yet `ingress.yaml`). Verify via `kubectl port-forward svc/gateway-service 3000:3000` + a `curl`/Postman login call, before exposing anything externally.
5. Enable `minikube addons enable ingress`, confirm `ingress-nginx` controller pod is `Running`, then apply `ingress.yaml`. Verify `kubectl get ingress` shows an address, then test through `auppgym.com` (see gotcha below).
6. `shared-volume/`. Verify the two previously-pending pods flip to `Running`, then confirm interleaved log lines from both services/pods in the shared file.

## Minikube-specific corrections and gotchas

- **Correction**: no minikube profile is currently running on this machine (checked directly — `minikube status` fails because Docker Desktop itself isn't running: `dial unix .../docker.sock: connect: no such file or directory`). Start from scratch: start Docker Desktop → `minikube start` → `minikube addons enable ingress`. Don't assume an existing profile/IP.
- **Ingress reachability on macOS + docker driver**: the docker-driver "node" is itself a container; its IP is typically not directly routable from the macOS host. Run `minikube tunnel` in a dedicated terminal during the demo and point `/etc/hosts`'s `auppgym.com` entry at `127.0.0.1` while it's running — verify with `curl` before the live demo, not during it.
- **Image loading**: build all 7 app images against Minikube's own Docker daemon (`eval $(minikube docker-env)` then `docker build -t <service>:local ./<service-dir>`), and set `imagePullPolicy: Never` in every Deployment — otherwise Kubernetes tries (and fails) to pull from Docker Hub.
- **hostPath + single node**: the shared-log PV only works because Minikube is single-node here; don't switch to `--nodes=2`, since plain `hostPath` PVs have no automatic node affinity and pods could silently get a fresh empty directory on a different node.
- **Mongo image**: use `mongo:7.0` (supports Stable API v1, matching the `serverApi:{version:'1',...}` options already in every service's `dbConnect.js`). Verify early in step 2 — if a service crash-loops with an `apiStrict`/unsupported-command error, that's Mongoose's `autoIndex`/`createIndexes` hitting a Stable-API mismatch, not a K8s config problem.

## Team split mapping (per CLAUDE.md)

- **Member A**: `databases/` + `microservices/` + `configmaps-secrets.yaml`, verifying each service connects to Mongo.
- **Member B**: `gateway/` (Deployment, Service, Ingress), enabling the ingress addon, verifying only api-gateway is externally reachable.
- **Member C**: `shared-volume/`, the 2-service logging middleware, full `minikube start` → `kubectl apply -f k8s/` → demo runbook.

## Verification plan

- `kubectl get pods -n gym-fitness` all `Running`/`Ready` after each rollout step above.
- `kubectl exec` into any backend pod to confirm it's not reachable from outside (`ClusterIP`, no NodePort/LoadBalancer).
- `curl http://auppgym.com/login` (via tunnel) end-to-end through Ingress → gateway → identity-service → Mongo.
- `kubectl logs -l app=member-service --all-containers --prefix` showing both pod names handling `/members` traffic (load-balancer proof).
- `kubectl exec` into identity-service or member-service pod, `tail /var/log/app/access.log`, confirm interleaved lines from both services (shared-volume proof).
