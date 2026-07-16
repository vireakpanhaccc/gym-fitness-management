# Gym Fitness Microservices Kubernetes Documentation

## 1. Intro

The Gym Fitness project is a cloud-native microservices application for managing users, members, trainers, workout plans, membership plans, and gym attendance. The system is deployed on Kubernetes using YAML manifests only, with an API Gateway as the single public entry point.

The application is composed of independent Node.js/Express services. Each service owns a specific business function and communicates through internal Kubernetes `ClusterIP` Services. External users access the system through the domain `auppgym.com`, which is routed by Kubernetes Ingress to the API Gateway.

## 2. Objective

The objective of this project is to transform the Gym Fitness application from a collection of containerized services into a complete Kubernetes-based microservices deployment. The final system is designed to show how independent services can be deployed, discovered, secured, routed, scaled, and validated inside a local Kubernetes cluster while still presenting one controlled entry point to external clients.

Specifically, this deployment aims to:

- Package each application component as an independent Kubernetes workload with its own Deployment and internal Service.
- Enforce a gateway-first architecture where every client request enters through `auppgym.com`, reaches the Kubernetes Ingress, and is forwarded only to the API Gateway.
- Keep backend microservices private inside the cluster by exposing them only through `ClusterIP` Services.
- Use the API Gateway as the central routing and security layer for JWT verification, role-based access control, and request fanout to the correct backend service.
- Replace the external database dependency with an in-cluster MongoDB deployment backed by persistent storage.
- Demonstrate Kubernetes multi-container volume sharing through the API Gateway Pod, where one container writes request logs and a sidecar container reads the same log file.
- Provide a reproducible demo workflow using YAML manifests, Minikube, `kubectl`, Postman, and service logs to prove that networking, authentication, database access, fanout routing, load balancing, and volume sharing all work together.

## 3. Technologies/Tools

| Technology / Tool | Purpose |
|---|---|
| Node.js | Runtime for all application services |
| Express.js | REST API framework |
| MongoDB | Database for users, members, trainers, workouts, memberships, and attendance |
| Mongoose | MongoDB object modeling library |
| JWT | Authentication and role-based authorization |
| Docker | Container image build tool |
| Kubernetes | Container orchestration platform |
| Minikube | Local Kubernetes cluster |
| Kubernetes Deployment | Runs application Pods |
| Kubernetes Service | Provides internal stable networking for Pods |
| Kubernetes Ingress | Routes external domain traffic to the API Gateway |
| ConfigMap | Stores non-sensitive service discovery configuration |
| Secret | Stores JWT secret and MongoDB credentials |
| PersistentVolumeClaim | Stores MongoDB data |
| emptyDir Volume | Shares the API Gateway log file between two containers in one Pod |
| Postman | API validation and screenshot evidence |

## 4. Development Methodology

The project follows a microservices-based development methodology:

1. Each business domain is implemented as a separate service.
2. Every service is containerized using its own Dockerfile.
3. Kubernetes YAML files are used for Deployments, Services, database storage, ConfigMaps, Secrets, and Ingress.
4. All backend services are exposed only inside the cluster using `ClusterIP`.
5. The API Gateway validates JWT tokens, checks user roles, and proxies requests to the correct backend service.
6. Ingress exposes only the API Gateway through `auppgym.com`.
7. MongoDB is deployed inside the Kubernetes cluster and accessed by the services through Kubernetes DNS.
8. The shared-volume requirement is demonstrated inside the API Gateway Pod using two containers and one shared `emptyDir` volume.

## 5.1 Microservice Name - API Name in Each Microservice

| Microservice | Port | Main API Routes | Purpose |
|---|---:|---|---|
| `api-gateway` | 3000 | `/register`, `/login`, `/users`, `/members`, `/trainers`, `/workouts`, `/plans`, `/checkin`, `/checkout`, `/attendance` | Single entry point, JWT validation, RBAC, and proxy routing |
| `identity-service` | 3001 | `POST /register`, `POST /login`, `GET /users`, `DELETE /users/:id` | User registration, login, JWT creation, user administration |
| `member-service` | 3002 | `POST /members`, `GET /members`, `GET /members/me`, `PUT /members/me`, `GET /members/:id`, `PUT /members/:id`, `DELETE /members/:id` | Member profile management |
| `trainer-service` | 3003 | `GET /trainers`, `POST /trainers`, `GET /trainers/me`, `PUT /trainers/me`, `GET /trainers/:id`, `PUT /trainers/:id`, `DELETE /trainers/:id` | Trainer profile management |
| `workout-service` | 3004 | `POST /workouts`, `GET /workouts`, `GET /workouts/my`, `GET /workouts/:id`, `PUT /workouts/:id`, `DELETE /workouts/:id` | Workout plan management |
| `membership-service` | 3005 | `POST /plans`, `GET /plans`, `PUT /plans/:id`, `DELETE /plans/:id` | Membership plan management |
| `attendance-service` | 3006 | `POST /checkin`, `PUT /checkout/me`, `PUT /checkout/:id`, `GET /attendance/me`, `GET /attendance/:memberId`, `GET /attendance` | Gym check-in, checkout, and attendance history |

Role-based access is enforced in the API Gateway before traffic is forwarded to backend services. For example, admin-only routes such as `POST /members` and `DELETE /users/:id` require a valid admin JWT.

## 5.2 POD Information

| Component | Deployment | Replicas | Containers | Image | Container Port |
|---|---|---:|---|---|---:|
| API Gateway | `api-gateway` | 1 | `api-gateway`, `log-reader` | `api-gateway:local`, `busybox:1.36` | 3000 |
| Identity Service | `identity-service` | 1 | `identity-service` | `identity-service:local` | 3001 |
| Member Service | `member-service` | 2 | `member-service` | `member-service:local` | 3002 |
| Trainer Service | `trainer-service` | 1 | `trainer-service` | `trainer-service:local` | 3003 |
| Workout Service | `workout-service` | 1 | `workout-service` | `workout-service:local` | 3004 |
| Membership Service | `membership-service` | 1 | `membership-service` | `membership-service:local` | 3005 |
| Attendance Service | `attendance-service` | 1 | `attendance-service` | `attendance-service:local` | 3006 |
| MongoDB | `mongo` | 1 | `mongo` | `mongo:7.0` | 27017 |

Expected Pod count:

- 1 API Gateway Pod with 2 containers.
- 6 backend microservice Pods, with `member-service` running 2 replicas.
- 1 MongoDB Pod.

Useful verification command:

```bash
kubectl get pods -n gym-fitness -o wide
```

## 6. Database Design

The project uses one shared MongoDB database deployed inside the Kubernetes cluster.

| Database Component | Value |
|---|---|
| Database engine | MongoDB |
| Kubernetes Deployment | `mongo` |
| Kubernetes Service | `mongo-service` |
| Port | 27017 |
| Database name | `gymfitness` |
| Storage | `mongo-pvc` |
| PVC access mode | `ReadWriteOnce` |
| PVC size | `1Gi` |

MongoDB credentials and connection strings are stored in `app-secrets`:

| Secret Key | Purpose |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | MongoDB root username |
| `MONGO_INITDB_ROOT_PASSWORD` | MongoDB root password |
| `uri` | MongoDB connection string used by most services |
| `MONGO_URI` | MongoDB connection string used by `membership-service` |
| `JWT_SECRET` | Shared JWT secret for token signing and verification |

Main collections:

| Service | Model / Collection Purpose |
|---|---|
| `identity-service` | Users and authentication data |
| `member-service` | Member profiles |
| `trainer-service` | Trainer profiles |
| `workout-service` | Workout plans |
| `membership-service` | Membership plans |
| `attendance-service` | Check-in and checkout attendance records |

## 7.1 Deployment YAML File Details

Deployment files are stored under `k8s/microservices/`, `k8s/gateway/`, and `k8s/databases/`.

| YAML File | Kubernetes Resource | Important Details |
|---|---|---|
| `k8s/gateway/gateway-deployment.yaml` | Deployment | Runs the API Gateway container and `log-reader` sidecar in the same Pod. Uses `emptyDir` volume named `gateway-logs`. |
| `k8s/microservices/identity-service-deployment.yaml` | Deployment | Runs `identity-service:local` on port 3001. |
| `k8s/microservices/member-service-deployment.yaml` | Deployment | Runs 2 replicas of `member-service:local` on port 3002. Uses the Downward API to set `INSTANCE` to the Pod name. |
| `k8s/microservices/trainer-service-deployment.yaml` | Deployment | Runs `trainer-service:local` on port 3003. |
| `k8s/microservices/workout-service-deployment.yaml` | Deployment | Runs `workout-service:local` on port 3004. |
| `k8s/microservices/membership-service-deployment.yaml` | Deployment | Runs `membership-service:local` on port 3005. |
| `k8s/microservices/attendance-service-deployment.yaml` | Deployment | Runs `attendance-service:local` on port 3006. |
| `k8s/databases/mongo-deployment.yaml` | Deployment | Runs `mongo:7.0`, uses `Recreate` strategy, and mounts `mongo-pvc` at `/data/db`. |

All application Deployments use:

- `imagePullPolicy: Never` for locally built Minikube images.
- `envFrom` with `app-config` and `app-secrets`.
- A service-specific `PORT` environment variable.
- The `gym-fitness` namespace.

## 7.2 Service YAML File Details

All Services are `ClusterIP`, meaning they are reachable only inside the Kubernetes cluster. This ensures that clients cannot directly access backend services.

| YAML File | Service Name | Type | Port | Target Port | Selector |
|---|---|---|---:|---:|---|
| `k8s/gateway/gateway-service.yaml` | `gateway-service` | `ClusterIP` | 3000 | 3000 | `app: api-gateway` |
| `k8s/microservices/identity-service-service.yaml` | `identity-service` | `ClusterIP` | 3001 | 3001 | `app: identity-service` |
| `k8s/microservices/member-service-service.yaml` | `member-service` | `ClusterIP` | 3002 | 3002 | `app: member-service` |
| `k8s/microservices/trainer-service-service.yaml` | `trainer-service` | `ClusterIP` | 3003 | 3003 | `app: trainer-service` |
| `k8s/microservices/workout-service-service.yaml` | `workout-service` | `ClusterIP` | 3004 | 3004 | `app: workout-service` |
| `k8s/microservices/membership-service-service.yaml` | `membership-service` | `ClusterIP` | 3005 | 3005 | `app: membership-service` |
| `k8s/microservices/attendance-service-service.yaml` | `attendance-service` | `ClusterIP` | 3006 | 3006 | `app: attendance-service` |
| `k8s/databases/mongo-service.yaml` | `mongo-service` | `ClusterIP` | 27017 | 27017 | `app: mongo` |

Service verification command:

```bash
kubectl get svc -n gym-fitness
```

## 8. Fanout Mechanism

Fanout is implemented with two layers:

1. Kubernetes Ingress receives traffic for `auppgym.com`.
2. The API Gateway forwards requests to the correct internal service.

Ingress configuration:

- Ingress resource: `gym-fitness-ingress`
- Host: `auppgym.com`
- Ingress class: `nginx`
- Backend target: `gateway-service:3000`

Ingress path rules include:

| Public Path | Ingress Target | Gateway Fanout Target |
|---|---|---|
| `/register`, `/login`, `/users` | `gateway-service:3000` | `identity-service:3001` |
| `/members` | `gateway-service:3000` | `member-service:3002` |
| `/trainers` | `gateway-service:3000` | `trainer-service:3003` |
| `/workouts` | `gateway-service:3000` | `workout-service:3004` |
| `/plans` | `gateway-service:3000` | `membership-service:3005` |
| `/checkin`, `/checkout`, `/attendance` | `gateway-service:3000` | `attendance-service:3006` |

Important point: Ingress never routes directly to backend microservices. It only routes to the API Gateway. The gateway performs the real fanout to internal services.

Example request flow:

```text
Client/Postman
  -> http://auppgym.com/login
  -> Kubernetes Ingress
  -> gateway-service
  -> api-gateway Pod
  -> identity-service
  -> mongo-service
  -> MongoDB Pod
```

## 9. Validation Check

Use the following checks to validate the Kubernetes deployment.

Apply YAML files:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps-secrets.yaml
kubectl apply -f k8s/databases/
kubectl apply -f k8s/microservices/
kubectl apply -f k8s/gateway/gateway-deployment.yaml
kubectl apply -f k8s/gateway/gateway-service.yaml
kubectl apply -f k8s/gateway/ingress.yaml
```

Check Pods:

```bash
kubectl get pods -n gym-fitness -o wide
```

Expected:

- All Pods should be `Running`.
- `member-service` should show 2 replicas.
- `api-gateway` Pod should show 2/2 containers ready.

Check Services:

```bash
kubectl get svc -n gym-fitness
```

Expected:

- All services should be `ClusterIP`.
- No backend microservice should be exposed as `NodePort` or `LoadBalancer`.

Check Ingress:

```bash
kubectl get ingress -n gym-fitness
```

Expected:

- Host should include `auppgym.com`.
- Backend should route to `gateway-service`.

Check API Gateway logs:

```bash
kubectl logs deploy/api-gateway -n gym-fitness -c api-gateway
```

Check shared-volume sidecar logs:

```bash
kubectl logs deploy/api-gateway -n gym-fitness -c log-reader
```

Check member-service load balancing:

```bash
kubectl logs -n gym-fitness -l app=member-service --all-containers --prefix
```

## 10. Postman API Call Screenshot

Add the final Postman screenshots in this section after running the demo.


1. Login request

```text
Method: POST
URL: http://auppgym.com/login
Body:
{
  "email": "admin@gym.com",
  "password": "admin123"
}
Expected result: JWT token returned.
```

2. Authenticated member request

```text
Method: GET
URL: http://auppgym.com/members
Header:
Authorization: Bearer <admin-token>
Expected result: Member list or an empty array.
```

3. Gateway route validation

```text
Method: GET
URL: http://auppgym.com/trainers
Header:
Authorization: Bearer <token>
Expected result: Trainer API response.
```

4. Shared volume log proof

```text
Command:
kubectl logs deploy/api-gateway -n gym-fitness -c log-reader

Expected result:
The log-reader sidecar displays request lines written by the api-gateway container.
```

## 11. Volume Implementation

The volume implementation is done inside the API Gateway Pod.

Purpose:

- Demonstrate that two containers in the same Kubernetes Pod can access the same file through a shared volume.
- Keep the shared-volume demo isolated from backend services.
- Use a simple log-file workflow that is easy to prove during the presentation.

Implementation details:

| Item | Value |
|---|---|
| Pod | `api-gateway` |
| Container 1 | `api-gateway` |
| Container 2 | `log-reader` |
| Volume name | `gateway-logs` |
| Volume type | `emptyDir` |
| Mount path | `/var/log/app` |
| Log file | `/var/log/app/access.log` |

How it works:

1. The `api-gateway` container receives requests.
2. Gateway middleware writes each completed request to `/var/log/app/access.log`.
3. The `log-reader` sidecar mounts the same volume at `/var/log/app`.
4. The sidecar runs:

```bash
mkdir -p /var/log/app && touch /var/log/app/access.log && tail -n +1 -f /var/log/app/access.log
```

5. When a request reaches the gateway, the sidecar output shows the new log line.

Verification command:

```bash
kubectl logs deploy/api-gateway -n gym-fitness -c log-reader
```

Example log format:

```text
2026-07-15T10:00:00.000Z [api-gateway] [pod:api-gateway-xxxxx] GET /members -> 200 user=admin@gym.com role=admin
```

Note: `emptyDir` exists for the lifetime of the Pod. If the API Gateway Pod is deleted and recreated, the log file starts fresh. This is acceptable for the demo because the requirement is to show shared volume access between multiple containers.

## 12. Future Scope

Possible improvements for future versions:

- Use a production-grade log collector such as Fluent Bit, Filebeat, or OpenTelemetry Collector.
- Store logs in centralized logging tools such as Elasticsearch, Loki, or CloudWatch.
- Replace demo credentials with sealed secrets or an external secret manager.
- Add health checks and readiness probes for all services.
- Add horizontal pod autoscaling for high-traffic services.
- Add CI/CD pipelines for image build, testing, and Kubernetes deployment.
- Add automated integration tests for all gateway routes.
- Use a managed MongoDB service or a production-ready MongoDB replica set.
- Add TLS certificates for `auppgym.com`.
- Add monitoring dashboards using Prometheus and Grafana.
