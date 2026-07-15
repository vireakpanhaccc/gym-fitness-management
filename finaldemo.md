# Final Demo Plan — Kubernetes Gym Fitness Project

Use this plan to prove the project works before preparing final documentation.

## Quick Requirement Map

Show these points to the professor during the demo:

| Final requirement | What to show |
|---|---|
| Deploy microservices on Kubernetes using YAML only | `kubectl apply -f k8s/...` commands and `kubectl get pods -n gym-fitness -o wide` |
| Multiple Pods as required | `member-service` has 2 running pods |
| All client requests go through API Gateway | Ingress targets only `gateway-service`; backend Services are `ClusterIP` |
| Database connectivity | Postman login returns JWT from MongoDB-backed `identity-service` |
| Fanout DNS using domain name | Postman uses `http://auppgym.com/...` through Ingress |
| Shared data in Kubernetes Volume | `identity-service` and `member-service` read the same `/var/log/app/access.log` |
| Local Minikube deployment | `minikube status` and `kubectl get nodes` |

## 1. Start Local Cluster

```bash
minikube start
minikube addons enable ingress
```

## 2. Build Images Inside Minikube

```bash
eval $(minikube docker-env)

for svc in api-gateway identity-service member-service membership-service trainer-service workout-service attendance-service; do
  docker build -t "${svc}:local" "./${svc}"
done
```

## 3. Deploy Kubernetes YAML

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps-secrets.yaml

kubectl apply -f k8s/databases/
kubectl -n gym-fitness wait --for=condition=Ready pod -l app=mongo --timeout=120s

kubectl apply -f k8s/shared-volume/
kubectl apply -f k8s/microservices/
kubectl apply -f k8s/gateway/gateway-deployment.yaml
kubectl apply -f k8s/gateway/gateway-service.yaml
kubectl apply -f k8s/gateway/ingress.yaml
```

Screenshot for documentation:

- Terminal showing the YAML apply commands completed successfully.

## 4. Confirm Pods and Services

```bash
kubectl get pods -n gym-fitness -o wide
kubectl get svc -n gym-fitness
kubectl get ingress -n gym-fitness
kubectl get nodes
minikube status
```

Explain:

- All services run in Kubernetes.
- `member-service` has 2 pods.
- All Services are `ClusterIP`, so backend services are internal.
- Ingress only routes to `gateway-service`.
- The cluster is running locally in Minikube.

Screenshots for documentation:

- `kubectl get pods -n gym-fitness -o wide`
- `kubectl get svc -n gym-fitness`
- `kubectl get ingress -n gym-fitness`
- `minikube status` and `kubectl get nodes`

## 5. Point Domain to Minikube

In one terminal, keep this running:

```bash
minikube tunnel
```

In another terminal:

```bash
echo "127.0.0.1 auppgym.com" | sudo tee -a /etc/hosts
```

## 6. Seed First Admin User

The first admin is created directly inside `identity-service` because gateway registration requires an admin token.

```bash
kubectl -n gym-fitness exec deploy/identity-service -- wget -qO- \
  --header='Content-Type: application/json' \
  --post-data='{"name":"Admin","email":"admin@gym.com","password":"admin123","role":"admin"}' \
  http://localhost:3001/register
```

## 7. Prove Gateway + DNS + Database

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

Expected result: JSON response with a JWT token.

Screenshot for documentation:

- Postman login request showing `http://auppgym.com/login` and JWT response.

Explain:

`auppgym.com` -> Ingress -> API Gateway -> identity-service -> MongoDB.

## 8. Prove Authenticated Gateway Routing

In Postman, copy the `token` value from the login response.

Postman request:

```text
Method: GET
URL: http://auppgym.com/members
Headers:
  Authorization: Bearer <paste-admin-token-here>
```

Explain:

The request enters through the domain and gateway, then the gateway verifies JWT/RBAC before routing to `member-service`.

Screenshot for documentation:

- Postman authenticated request to `http://auppgym.com/members` with `Authorization: Bearer <token>`.

## 9. Prove Shared Volume

Generate traffic in Postman:

```text
Method: GET
URL: http://auppgym.com/members
Headers:
  Authorization: Bearer <paste-admin-token-here>
```

Read the same log file from two different services:

```bash
kubectl -n gym-fitness exec deploy/identity-service -- cat /var/log/app/access.log
kubectl -n gym-fitness exec deploy/member-service -- cat /var/log/app/access.log
```

Explain:

Both services mount the same PVC and write/read the same `access.log` file.

Screenshots for documentation:

- Postman request that generates log traffic.
- Terminal showing `identity-service` reading `/var/log/app/access.log`.
- Terminal showing `member-service` reading the same `/var/log/app/access.log`.

## 10. Prove Member Load Balancing

In Postman, send this request 5 to 10 times:

```text
Method: GET
URL: http://auppgym.com/members
Headers:
  Authorization: Bearer <paste-admin-token-here>
```

Then check logs:

```bash
kubectl -n gym-fitness logs -l app=member-service --all-containers --prefix
```

Explain:

There are two `member-service` pods, and Kubernetes Service load-balances traffic between them.

Screenshot for documentation:

- Terminal logs showing requests handled by different `member-service` pod names.

## 11. Show YAML Files

```bash
find k8s -type f | sort
```

Explain:

All Kubernetes resources are defined as YAML files under `k8s/`.

Screenshot for documentation:

- Terminal showing the list of Kubernetes YAML files.

## 12. Cleanup After Demo

```bash
kubectl delete namespace gym-fitness
minikube stop
```
