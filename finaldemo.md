# Final Demo Showcase — Kubernetes Gym Fitness Project

Use this file as the live presentation script. It follows the same structure as `docs.md`, but focuses on what to show on screen to prove the project is working.

## 1. Demo Goal

Show that the Gym Fitness microservices application is fully deployed on Kubernetes with:

- YAML-only Kubernetes resources.
- Multiple Pods.
- API Gateway as the only public entry point.
- MongoDB database connectivity.
- Fanout DNS using `auppgym.com`.
- Shared-volume logging using two containers inside the API Gateway Pod.
- Working Postman API calls.

## 2. Requirement Proof Map

| Requirement | What to Show |
|---|---|
| YAML-only deployment | `find k8s -type f | sort` and `kubectl apply -f ...` commands |
| Multiple Pods | `kubectl get pods -n gym-fitness -o wide`; `member-service` has 2 Pods |
| API Gateway routing | Ingress routes only to `gateway-service`; backend Services are `ClusterIP` |
| Database connectivity | Login returns JWT from MongoDB-backed `identity-service` |
| Fanout DNS | Postman/curl uses `http://auppgym.com/...` |
| Shared Volume | `api-gateway` writes `access.log`; `log-reader` sidecar reads it |
| Minikube deployment | `minikube status` and `kubectl get nodes` |

## 3. Start Cluster and Build Images

Start Minikube and enable Ingress:

```bash
minikube start
minikube addons enable ingress
```

Build all application images inside Minikube's Docker environment.

macOS/Linux:

```bash
eval $(minikube docker-env)

for svc in api-gateway identity-service member-service membership-service trainer-service workout-service attendance-service; do
  docker build -t "${svc}:local" "./${svc}"
done
```

Windows PowerShell:

```powershell
minikube docker-env --shell powershell | Invoke-Expression

$services = @(
  "api-gateway",
  "identity-service",
  "member-service",
  "membership-service",
  "trainer-service",
  "workout-service",
  "attendance-service"
)

foreach ($svc in $services) {
  docker build -t "${svc}:local" ".\$svc"
}
```

Show:

- The image build commands complete successfully.
- No external image registry is required for app images.

## 4. Deploy Kubernetes YAML

Apply the manifests:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps-secrets.yaml

kubectl apply -f k8s/databases/
kubectl -n gym-fitness wait --for=condition=Ready pod -l app=mongo --timeout=120s

kubectl apply -f k8s/microservices/
kubectl apply -f k8s/gateway/gateway-deployment.yaml
kubectl apply -f k8s/gateway/gateway-service.yaml
kubectl apply -f k8s/gateway/ingress.yaml
```

Show:

```bash
find k8s -type f | sort
```

Explain:

All Kubernetes resources are defined as YAML files under `k8s/`. The deployment does not use Helm, Kustomize, or manual `kubectl create` commands as the final deliverable.

## 5. Validate Pods

Run:

```bash
kubectl get pods -n gym-fitness -o wide
```

Expected result:

- `api-gateway` is running with `2/2` containers ready.
- `member-service` has 2 running Pods.
- Every backend service is running.
- MongoDB is running.

Explain:

The API Gateway Pod has two containers:

- `api-gateway`: handles requests and writes `/var/log/app/access.log`.
- `log-reader`: reads the same file from the shared volume.

## 6. Validate Services

Run:

```bash
kubectl get svc -n gym-fitness
```

Expected result:

- `gateway-service` is `ClusterIP`.
- All backend services are also `ClusterIP`.
- MongoDB is `ClusterIP`.

Explain:

No backend microservice is exposed directly outside the cluster. External traffic must go through Ingress and the API Gateway.

## 7. Validate Ingress and Fanout DNS

Run:

```bash
kubectl get ingress -n gym-fitness
```

Show the Ingress YAML:

```bash
cat k8s/gateway/ingress.yaml
```

Explain:

The host is `auppgym.com`, and every path routes to `gateway-service:3000`. Ingress does not route directly to `identity-service`, `member-service`, or any other backend service.

Traffic flow:

```text
Postman / Browser
  -> http://auppgym.com/<path>
  -> Ingress
  -> gateway-service
  -> api-gateway
  -> correct backend service
```

## 8. Point Domain to Minikube

In one terminal, keep this running:

```bash
minikube tunnel
```

In another terminal:

```bash
echo "127.0.0.1 auppgym.com" | sudo tee -a /etc/hosts
```

Explain:

On macOS with the Minikube Docker driver, `minikube tunnel` makes the Ingress reachable from the local machine. The `/etc/hosts` entry maps `auppgym.com` to localhost for the demo.

## 9. Seed First Admin User

The first admin is created directly through `identity-service` because gateway registration requires an existing admin token.

```bash
kubectl -n gym-fitness exec deploy/identity-service -- wget -qO- \
  --header='Content-Type: application/json' \
  --post-data='{"name":"Admin","email":"admin@gym.com","password":"admin123","role":"admin"}' \
  http://localhost:3001/register
```

Expected result:

```text
User registered successfully
```

## 10. Postman Check 1 — Login Proves Gateway, DNS, and Database

Postman request:

```text
Method: POST
URL: http://auppgym.com/login
Headers:
  Content-Type: application/json
Body:
{
  "email": "admin@gym.com",
  "password": "admin123"
}
```

Expected result:

- HTTP success response.
- JSON response contains a JWT token.

Explain:

This proves:

- DNS works because the request uses `auppgym.com`.
- Ingress works because traffic enters the cluster.
- API Gateway works because `/login` is routed through `gateway-service`.
- Database works because `identity-service` checks MongoDB and returns a token.

Screenshot to capture:

- Postman login request and JWT response.

## 11. Postman Check 2 — Authenticated Gateway Routing

Copy the JWT token from the login response.

Postman request:

```text
Method: GET
URL: http://auppgym.com/members
Headers:
  Authorization: Bearer <admin-token>
```

Expected result:

- HTTP success response.
- Member list or empty array.

Explain:

The request goes through:

```text
auppgym.com -> Ingress -> API Gateway -> member-service
```

The API Gateway validates the JWT and checks that the user has the `admin` role before forwarding to `member-service`.

Screenshot to capture:

- Postman authenticated `/members` request.

## 12. Postman Check 3 — Fanout to Another Service

Postman request:

```text
Method: GET
URL: http://auppgym.com/trainers
Headers:
  Authorization: Bearer <admin-token>
```

Expected result:

- HTTP success response.
- Trainer list or empty array.

Explain:

This proves fanout to a different backend service. `/members` routes to `member-service`, while `/trainers` routes to `trainer-service`, but both requests enter through the same domain and gateway.

Screenshot to capture:

- Postman `/trainers` request and response.

## 13. Validate Shared Volume Implementation

Generate a request through Postman:

```text
Method: GET
URL: http://auppgym.com/members
Headers:
  Authorization: Bearer <admin-token>
```

Then show the `log-reader` sidecar:

```bash
kubectl logs deploy/api-gateway -n gym-fitness -c log-reader
```

Expected result:

The sidecar shows lines like:

```text
2026-07-15T10:00:00.000Z [api-gateway] [pod:api-gateway-xxxxx] GET /members -> 200 user=admin@gym.com role=admin
```

Explain:

The API Gateway Pod has two containers sharing one Kubernetes `emptyDir` volume:

| Container | Role |
|---|---|
| `api-gateway` | Writes `/var/log/app/access.log` |
| `log-reader` | Reads/tails `/var/log/app/access.log` |

This proves the volume requirement because multiple containers access the same log file through the same mounted volume.

Screenshot to capture:

- Terminal showing `kubectl logs deploy/api-gateway -c log-reader` with request log lines.

## 14. Validate Member-Service Load Balancing

Send this Postman request 5 to 10 times:

```text
Method: GET
URL: http://auppgym.com/members
Headers:
  Authorization: Bearer <admin-token>
```

Then run:

```bash
kubectl -n gym-fitness logs -l app=member-service --all-containers --prefix
```

Expected result:

- Log lines appear from different `member-service` Pod names.

Explain:

`member-service` has 2 replicas. The Kubernetes `member-service` ClusterIP Service load-balances traffic between those Pods.

Screenshot to capture:

- Terminal showing logs from multiple `member-service` Pods.

## 15. Validate Database and Storage

Run:

```bash
kubectl get pvc -n gym-fitness
kubectl get pods -n gym-fitness -l app=mongo
kubectl logs deploy/mongo -n gym-fitness
```

Expected result:

- `mongo-pvc` exists.
- MongoDB Pod is running.
- Services can log in through MongoDB-backed authentication.

Explain:

MongoDB data is stored using `mongo-pvc`, mounted at `/data/db` inside the MongoDB container.

## 16. Final YAML and Architecture Summary

Show:

```bash
find k8s -type f | sort
```

Explain the important files:

| File | Purpose |
|---|---|
| `k8s/namespace.yaml` | Creates `gym-fitness` namespace |
| `k8s/configmaps-secrets.yaml` | Stores service names, MongoDB URI, MongoDB credentials, and JWT secret |
| `k8s/databases/mongo-deployment.yaml` | Runs MongoDB |
| `k8s/databases/mongo-pvc.yaml` | Stores MongoDB data |
| `k8s/microservices/*deployment.yaml` | Runs backend services |
| `k8s/microservices/*service.yaml` | Creates internal ClusterIP Services |
| `k8s/gateway/gateway-deployment.yaml` | Runs API Gateway plus `log-reader` sidecar |
| `k8s/gateway/gateway-service.yaml` | Internal service for API Gateway |
| `k8s/gateway/ingress.yaml` | Maps `auppgym.com` to `gateway-service` |

## 17. Cleanup After Demo

Only run cleanup after screenshots and grading are complete.

```bash
kubectl delete namespace gym-fitness
minikube stop
```
