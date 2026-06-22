# EC2 Deployment Guide — Gym & Fitness Membership App (3 instances)

This guide deploys the app across **3 EC2 instances** plus **MongoDB Atlas**, matching
`plan.md` section 10. Every API call still passes through the API Gateway, JWT + RBAC is
enforced at the gateway, and member-service is load balanced across two instances.

```
                          Postman / Client
                                 |  (HTTP :80)
                                 v
        ┌───────────────────────────────────────────────┐
        │ EC2 #1  (public)                               │
        │   nginx        :80   -> api-gateway :3000      │
        │   nginx        :8081 -> member LB (EC2 #2)     │
        │   api-gateway  :3000  (JWT verify + RBAC)      │
        │   identity-service :3001                       │
        └───────────────┬───────────────────┬───────────┘
            private VPC  │                   │  private VPC
                         v                   v
        ┌────────────────────────┐  ┌────────────────────────────┐
        │ EC2 #2                 │  │ EC2 #3                     │
        │  member-service-1 3002 │  │  workout-service    3004   │
        │  member-service-2 3007 │  │  membership-service 3005   │
        │  trainer-service  3003 │  │  attendance-service 3006   │
        └───────────┬────────────┘  └─────────────┬──────────────┘
                    └─────────────┬───────────────┘
                                  v
                          MongoDB Atlas (cloud)
```

**Port map**

| Service | Runs on | Port (host) |
| --- | --- | ---: |
| nginx (public + member LB) | EC2 #1 | 80, 8081 |
| api-gateway | EC2 #1 | 3000 |
| identity-service | EC2 #1 | 3001 |
| member-service-1 | EC2 #2 | 3002 |
| member-service-2 | EC2 #2 | 3007 |
| trainer-service | EC2 #2 | 3003 |
| workout-service | EC2 #3 | 3004 |
| membership-service | EC2 #3 | 3005 |
| attendance-service | EC2 #3 | 3006 |

---

## Prerequisites

- An AWS account and a MongoDB Atlas cluster (connection string ready).
- Your repo pushed to GitHub (it is: `github.com/vireakpanhaccc/gym-fitness-management`).
- A key pair (`.pem`) for SSH.
- Launch all 3 instances in the **same region, VPC, and subnet** so they can talk over
  private IPs. Use **Ubuntu 22.04**, type **t2.small or t3.small** (t2.micro can run out
  of memory during `npm install`).

> Tip: do **Step 1 → Step 4** for all three instances first, collect the IPs in Step 5,
> then configure and launch **EC2 #2 and #3 before EC2 #1** (the gateway on #1 needs the
> private IPs of #2 and #3).

---

## Step 1 — Allow the EC2 instances in MongoDB Atlas

1. Atlas → **Network Access** → **Add IP Address**.
2. Add the **public IP** of each EC2 instance (or, just for the demo, `0.0.0.0/0` = allow
   from anywhere). Without this, every service will fail with a connection/handshake error.
3. Confirm the DB user (e.g. `admin`) and password are correct — that is what goes in
   `MONGO_URI`.

---

## Step 2 — Launch 3 EC2 instances

For each instance (EC2 #1, #2, #3):

1. EC2 → **Launch instance** → Ubuntu Server 22.04 LTS.
2. Type **t2.small** (or larger).
3. Same **VPC/subnet** for all three.
4. Select your key pair.
5. Configure the security group as in Step 3.
6. Launch.

Name them clearly: `gym-ec2-1-gateway`, `gym-ec2-2-member`, `gym-ec2-3-workout`.

---

## Step 3 — Security groups

Create/edit one security group per instance.

**EC2 #1 (public gateway)** — inbound:

| Type | Port | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | My IP | admin access |
| HTTP | 80 | 0.0.0.0/0 | public Postman traffic → Nginx |
| Custom TCP | 3000 | 0.0.0.0/0 | optional: hit the gateway directly while testing |

**EC2 #2 (member/trainer)** — inbound:

| Type | Port | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | My IP | admin access |
| Custom TCP | 3002, 3003, 3007 | **EC2 #1's security group** | only the gateway/LB may reach these |

**EC2 #3 (workout/membership/attendance)** — inbound:

| Type | Port | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | My IP | admin access |
| Custom TCP | 3004, 3005, 3006 | **EC2 #1's security group** | only the gateway may reach these |

> Using "EC2 #1's security group" as the source (instead of an IP) keeps the internal
> services private — they are not reachable from the public internet, only from the gateway.
> To set it: in the rule's Source field, start typing `sg-` and pick EC2 #1's group.

---

## Step 4 — Install Docker on every instance

SSH into each instance and run the same block:

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Install Docker Engine + Compose plugin
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Run docker without sudo (log out / back in afterwards)
sudo usermod -aG docker $USER
newgrp docker

docker --version && docker compose version
```

---

## Step 5 — Get the private IPs

On EC2 #2 and EC2 #3, note the **private IPv4 address** (AWS console → instance → "Private
IPv4 address", e.g. `10.0.1.23`), or run on each box:

```bash
hostname -I | awk '{print $1}'
```

Write them down:

```
EC2 #2 private IP = 10.0.x.x
EC2 #3 private IP = 10.0.y.y
```

---

## Step 6 — Clone the repo on all three instances

On each instance:

```bash
git clone https://github.com/vireakpanhaccc/gym-fitness-management.git
cd gym-fitness-management
```

The Dockerfiles, `.dockerignore` files, and Nginx config are already in the repo. The
`.env` files are **not** (they are gitignored) — you create them per host below.

---

## Step 7 — Configure and launch EC2 #2 (member + trainer)

Create the compose file and env, then bring it up.

```bash
cd ~/gym-fitness-management

# 1) env: just the Atlas connection string
cat > .env <<'EOF'
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
EOF

# 2) compose file for this host
cat > docker-compose.ec2-2.yaml <<'EOF'
services:
  member-service-1:
    build: ./member-service
    ports: ["3002:3002"]
    environment:
      PORT: 3002
      uri: ${MONGO_URI}
      MONGO_URI: ${MONGO_URI}
      INSTANCE: member-service-1
    restart: unless-stopped

  member-service-2:
    build: ./member-service
    ports: ["3007:3002"]
    environment:
      PORT: 3002
      uri: ${MONGO_URI}
      MONGO_URI: ${MONGO_URI}
      INSTANCE: member-service-2
    restart: unless-stopped

  trainer-service:
    build: ./trainer-service
    ports: ["3003:3003"]
    environment:
      PORT: 3003
      uri: ${MONGO_URI}
      MONGO_URI: ${MONGO_URI}
    restart: unless-stopped
EOF

# 3) build + run
docker compose -f docker-compose.ec2-2.yaml up -d --build
docker compose -f docker-compose.ec2-2.yaml ps
docker compose -f docker-compose.ec2-2.yaml logs --tail=5 member-service-1
```

Both member instances run the same image; `member-service-2` just maps host port **3007**
to the container's 3002. The `INSTANCE` variable makes each one print its name per request
(used for the load-balancing proof later).

---

## Step 8 — Configure and launch EC2 #3 (workout + membership + attendance)

```bash
cd ~/gym-fitness-management

cat > .env <<'EOF'
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
EOF

cat > docker-compose.ec2-3.yaml <<'EOF'
services:
  workout-service:
    build: ./workout-service
    ports: ["3004:3004"]
    environment:
      PORT: 3004
      uri: ${MONGO_URI}
      MONGO_URI: ${MONGO_URI}
    restart: unless-stopped

  membership-service:
    build: ./membership-service
    ports: ["3005:3005"]
    environment:
      PORT: 3005
      uri: ${MONGO_URI}
      MONGO_URI: ${MONGO_URI}
    restart: unless-stopped

  attendance-service:
    build: ./attendance-service
    ports: ["3006:3006"]
    environment:
      PORT: 3006
      uri: ${MONGO_URI}
      MONGO_URI: ${MONGO_URI}
    restart: unless-stopped
EOF

docker compose -f docker-compose.ec2-3.yaml up -d --build
docker compose -f docker-compose.ec2-3.yaml ps
```

---

## Step 9 — Configure and launch EC2 #1 (nginx + gateway + identity)

This host needs the **private IPs** of EC2 #2 and #3 from Step 5, and a `JWT_SECRET`
(any long random string — it is used to sign tokens in identity-service and verify them
in the gateway, so the value just has to be the same for both, which it is here).

```bash
cd ~/gym-fitness-management

# 1) env — fill in the two private IPs and a secret
cat > .env <<'EOF'
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_string
EC2_2_IP=10.0.x.x
EC2_3_IP=10.0.y.y
EOF

# 2) Nginx config for this host: public :80 -> gateway, :8081 -> member LB on EC2 #2.
#    Uses the official image's envsubst to inject EC2_2_IP from the environment.
cat > nginx/nginx.ec2-1.conf.template <<'EOF'
resolver 127.0.0.11 valid=10s ipv6=off;

upstream member_service {
    server ${EC2_2_IP}:3002;
    server ${EC2_2_IP}:3007;
}

server {
    listen 80;
    location / {
        set $gateway api-gateway:3000;
        proxy_pass http://$gateway;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 8081;
    location / {
        proxy_pass http://member_service;
        proxy_set_header Host      $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_pass_request_headers on;
    }
}
EOF

# 3) compose file for this host
cat > docker-compose.ec2-1.yaml <<'EOF'
services:
  identity-service:
    build: ./identity-service
    environment:
      PORT: 3001
      uri: ${MONGO_URI}
      MONGO_URI: ${MONGO_URI}
      JWT_SECRET: ${JWT_SECRET}
    restart: unless-stopped

  api-gateway:
    build: ./api-gateway
    ports: ["3000:3000"]
    environment:
      PORT: 3000
      JWT_SECRET: ${JWT_SECRET}
      IDENTITY_IP: identity-service
      MEMBER_LB_URL: http://nginx:8081
      MEMBER_IP: ${EC2_2_IP}
      TRAINER_IP: ${EC2_2_IP}
      WORKOUT_IP: ${EC2_3_IP}
      MEMBERSHIP_IP: ${EC2_3_IP}
      ATTENDANCE_IP: ${EC2_3_IP}
    depends_on: [identity-service]
    restart: unless-stopped

  nginx:
    image: nginx:1.27-alpine
    ports: ["80:80"]
    environment:
      EC2_2_IP: ${EC2_2_IP}
      NGINX_ENVSUBST_FILTER: "EC2_2_IP"
    volumes:
      - ./nginx/nginx.ec2-1.conf.template:/etc/nginx/templates/default.conf.template:ro
    depends_on: [api-gateway]
    restart: unless-stopped
EOF

# 4) build + run
docker compose -f docker-compose.ec2-1.yaml up -d --build
docker compose -f docker-compose.ec2-1.yaml ps
```

Check the gateway came up:

```bash
docker compose -f docker-compose.ec2-1.yaml logs --tail=10 api-gateway nginx
```

---

## Step 10 — Bootstrap the first admin

The gateway's `POST /register` requires an admin token, so create the first admin by
calling identity-service directly **on EC2 #1** (one time only):

```bash
docker compose -f docker-compose.ec2-1.yaml exec identity-service \
  wget -qO- --header='Content-Type: application/json' \
  --post-data='{"name":"Admin","email":"admin@gym.com","password":"admin123","role":"admin"}' \
  http://localhost:3001/register
```

After this you log in through the gateway and register everyone else normally.

---

## Step 11 — Test from Postman (through EC2 #1 public IP)

Let `PUBLIC = http://<EC2_1_PUBLIC_IP>` (port 80, via Nginx). All calls go here.

1. **Login** — `POST {{PUBLIC}}/login`
   ```json
   { "email": "admin@gym.com", "password": "admin123" }
   ```
   Copy the `token` from the response.

2. **Authorized call** — `GET {{PUBLIC}}/users`
   Header: `Authorization: Bearer <token>` → expect `200` and the user list.

3. **Register a member / trainer** — `POST {{PUBLIC}}/register` (admin token)
   ```json
   { "name": "Mia", "email": "mia@gym.com", "password": "mia123", "role": "member" }
   ```

4. Exercise each service through the gateway: `/members`, `/trainers`, `/workouts`,
   `/plans`, `/checkin`, `/attendance`, etc. (full route list is in `plan.md` section 6).

---

## Step 12 — Verify load balancing (for the rubric)

From Postman or the shell, hit the member route several times with an admin token:

```bash
TOKEN=<admin token from /login>
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://<EC2_1_PUBLIC_IP>/members -H "Authorization: Bearer $TOKEN"
done
```

Then **on EC2 #2**, show that both instances handled traffic:

```bash
docker compose -f docker-compose.ec2-2.yaml logs member-service-1 | grep "GET /members"
docker compose -f docker-compose.ec2-2.yaml logs member-service-2 | grep "GET /members"
```

You should see the requests split across `[member-service-1]` and `[member-service-2]`
(round-robin ≈ 4 and 4 for 8 requests). Screenshot both logs side by side.

---

## Step 13 — Required security screenshots (rubric)

All against `{{PUBLIC}}` on EC2 #1:

| Test | Request | Expected |
| --- | --- | --- |
| Wrong password | `POST /login` with a bad password | `401 Invalid credentials` |
| No token | `GET /users` with no `Authorization` | `401 No token provided` |
| Invalid token | `GET /users` with `Authorization: Bearer fake.token` | `403 Invalid token` |
| Wrong role | log in as the member, then `GET /users` with the member token | `403 Unauthorized` |

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Service logs show Mongo handshake error / `bson` crash | Atlas Network Access doesn't include the EC2 IP (Step 1), or the base image is too old — the Dockerfiles already use `node:22-alpine`. |
| `502 Bad Gateway` from Nginx | Gateway container down, or Nginx cached a stale IP after a rebuild — `docker compose -f docker-compose.ec2-1.yaml restart nginx`. |
| Gateway returns `502` only for `/members` | EC2 #2 security group doesn't allow 3002/3007 from EC2 #1's SG, or `EC2_2_IP` is wrong in `.env`/Nginx template. |
| Trainer/workout/etc. time out through gateway | Wrong private IP in EC2 #1 `.env`, or EC2 #2/#3 security group missing the port. |
| `401 No token` even with a token | `JWT_SECRET` differs between identity-service and the gateway. On EC2 #1 they share one `.env`, so re-check it and rebuild. |
| Changed a service's `.env`/IP | Re-run `docker compose -f <file> up -d` (recreates with new env). |

---

## Useful commands

```bash
# status / logs (run with the right -f file on each host)
docker compose -f docker-compose.ec2-1.yaml ps
docker compose -f docker-compose.ec2-1.yaml logs -f api-gateway

# restart one service
docker compose -f docker-compose.ec2-1.yaml restart nginx

# tear everything down on a host
docker compose -f docker-compose.ec2-1.yaml down
```

---

## What to capture for the documentation

- Architecture diagram (above) with the 3-EC2 split.
- `docker compose ps` on each instance showing containers Up.
- MongoDB Atlas collections (`users`, `members`, `trainers`, `workouts`, `plans`, `attendances`).
- Postman success calls through the public IP (login, one call per service).
- The 4 security screenshots from Step 13.
- The load-balancing proof from Step 12 (both member logs).
- The Nginx config (`nginx/nginx.ec2-1.conf.template`) showing the `member_service` upstream.
