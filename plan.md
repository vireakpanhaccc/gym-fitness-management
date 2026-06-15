# Plan: Build a testable Gym & Fitness Management microservices backend

## Context
This is a **final project**: a Node.js/Express microservices backend for a gym, to be **demonstrated and tested in Postman**. Today the repo is only scaffolding:
- Only `identity-service` has real code, and the live `index.js` is broken (typo `requrie`, incomplete `/login`, undefined `port`/`PersonModel`). A correct version already exists at `identity-service/index-claude.js`.
- The 5 other services + the gateway have **empty `index.js`** and only `express` as a dependency.
- All `Dockerfile`s and `docker-compose.yaml` are **0 bytes**.

Decisions confirmed with the user:
- **Goal:** working end-to-end MVP, all services reachable and testable via Postman.
- **Database:** one shared **MongoDB Atlas** (cloud) used by all services via `process.env.uri`. Reachable from any host (local or EC2) with no networking setup.
- **Auth:** API gateway is the single entry point; it validates the JWT and enforces **role-based access control (RBAC)** before proxying to services. Downstream services trust the gateway.
- **Deployment:** build & test with **docker-compose locally now**, but every service URL the gateway talks to is **env-driven**, so the same images later split across **multiple EC2 instances** by changing env values only — no code changes.
- **Ports:** avoid `5000` (macOS AirPlay / Docker) and any Docker-conflicting ports. Each service's listen port is set via the `PORT` env var.

Roles (already in `identity-service/models/user.js`): `admin`, `trainer`, `member`.

## Target architecture
Public traffic hits only the **gateway**; services are internal. The gateway locates each service through an env var (compose service name today, EC2 IP/DNS later).

| Service | Port | Gateway env var → target | Resource(s) | Gateway path |
|---|---|---|---|---|
| api-gateway | 8080 | — (public entry) | entry point, JWT + RBAC, proxy | — |
| identity-service | 4001 | `IDENTITY_URL` | auth, users | `/api/auth/*` |
| member-service | 4002 | `MEMBER_URL` | members | `/api/members/*` |
| membership-service | 4003 | `MEMBERSHIP_URL` | plans, subscriptions | `/api/plans/*`, `/api/subscriptions/*` |
| trainer-service | 4004 | `TRAINER_URL` | trainers | `/api/trainers/*` |
| workout-service | 4005 | `WORKOUT_URL` | workouts | `/api/workouts/*` |
| attendance-service | 4006 | `ATTENDANCE_URL` | attendance | `/api/attendance/*` |

## Step 1 — Fix the foundation (identity-service)
- Replace the broken `identity-service/index.js` with the working code from `identity-service/index-claude.js` (register, login w/ JWT, GET /users, DELETE /users/:id, POST /seed-admin).
- **Fix filename casing** so it runs in Docker/Linux: the working file requires `./dbconnect` and `./models/User`, but actual files are `dbConnect.js` and `models/user.js`. Standardize on `dbConnect.js` + `models/user.js` and update the requires. (Works on macOS today, breaks in Linux containers otherwise.)
- Delete `index-claude.js` and the empty `test.js` once merged.
- Keep `POST /seed-admin` to bootstrap the first admin (admin@gym.com / Admin@2024), then it self-blocks once an admin exists.

## Step 2 — Build the 5 stub services (shared pattern)
Each service follows the same structure as identity-service: `index.js` + `dbConnect.js` (copy) + `models/*.js`, connecting to the shared MongoDB via `process.env.uri`. Each exposes plain REST endpoints (no auth logic inside — the gateway guards them).

Per-service `package.json`: add `mongoose` and `dotenv` (currently only `express`).

**member-service** — `Member` model: `userId` (ref to identity user), `name`, `email`, `phone`, `dob`, `gender`, `address`, `joinDate`, `status`.
Endpoints: `POST/GET /members`, `GET/PUT/DELETE /members/:id`.

**membership-service** — `Plan` model (`name`, `durationMonths`, `price`, `description`) and `Subscription` model (`memberId`, `planId`, `startDate`, `endDate`, `status`, `paymentStatus`).
Endpoints: CRUD `/plans`, CRUD `/subscriptions` (+ `GET /subscriptions/member/:memberId`).

**trainer-service** — `Trainer` model: `name`, `email`, `phone`, `specialization`, `experienceYears`, `availability`.
Endpoints: `POST/GET /trainers`, `GET/PUT/DELETE /trainers/:id`.

**workout-service** — `Workout` model: `title`, `description`, `exercises[]` (name/sets/reps), `difficulty`, `trainerId`, `memberId` (assignment).
Endpoints: `POST/GET /workouts`, `GET/PUT/DELETE /workouts/:id`, `GET /workouts/member/:memberId`.

**attendance-service** — `Attendance` model: `memberId`, `date`, `checkInTime`, `checkOutTime`.
Endpoints: `POST /attendance/checkin`, `PUT /attendance/checkout/:id`, `GET /attendance`, `GET /attendance/member/:memberId`.

All write endpoints return clear JSON + proper status codes (mirroring identity-service's style) so Postman responses are readable.

## Step 3 — API gateway (JWT + RBAC + proxy)
`api-gateway/package.json`: add `jsonwebtoken`, `http-proxy-middleware`, `dotenv`.

`api-gateway/index.js`:
1. **`authenticate` middleware** — reads `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, attaches `req.user` (id, name, email, role). 401 on missing/invalid.
2. **`authorize(...roles)` middleware** — 403 unless `req.user.role` is allowed.
3. **Proxy mounts** with `http-proxy-middleware`, each guarded. Proxy `target` is read from the env var in the table above (e.g. `process.env.MEMBER_URL`) — **never a hardcoded host** — so the same code works in compose and on EC2. Use `pathRewrite` to strip `/api` (e.g. `/api/members` → `/members`; `/api/auth` → ``).
4. `GET /health` returns ok.

> **Critical gotcha:** do **not** call `express.json()` globally on the gateway. Body parsing consumes the stream and breaks proxied POST/PUT bodies. The gateway only needs the `Authorization` header for auth, so leave the body unparsed and let services parse it. (If JSON parsing is ever added at the gateway, use http-proxy-middleware's `fixRequestBody` in `on.proxyReq`.)

**RBAC matrix (enforced at gateway):**
- `/api/auth/register`, `/api/auth/login` → **public**
- `/api/auth/users` (GET, DELETE) → **admin**
- `/api/members` POST/PUT/DELETE → **admin**; GET → **admin, trainer, member**
- `/api/plans` write → **admin**; GET → **all roles**
- `/api/subscriptions` write → **admin**; GET → **admin, trainer, member**
- `/api/trainers` write → **admin**; GET → **all roles**
- `/api/workouts` write → **admin, trainer**; GET → **all roles**
- `/api/attendance` → **admin, trainer, member**

## Step 4 — Infrastructure (Docker + env, compose now / EC2 later)
- Write a `Dockerfile` for each of the 7 services (node:20-alpine, `WORKDIR /app`, copy `package*.json`, `npm install`, copy source, `EXPOSE <port>`, `CMD ["node","index.js"]`). Same images run locally and on EC2.
- Write `docker-compose.yaml` wiring all 7 services on a shared network for **local dev**:
  - host port maps: gateway `8080:8080`, services `4001:4001` … `4006:4006` (no `5000`).
  - env per service: `uri` (Atlas), `JWT_SECRET`, `PORT`.
  - gateway env points at compose service names: `IDENTITY_URL=http://identity-service:4001`, `MEMBER_URL=http://member-service:4002`, etc.
- **No hardcoded hosts anywhere** — the gateway reads service URLs from env only. To move to EC2 later you change those env values (to instance private IP/DNS, e.g. `MEMBER_URL=http://10.0.x.x:4002`) and redeploy the same image; no code edits.
- Add `.env.example` (root + per service) documenting `uri`, `JWT_SECRET`, `PORT`, and the gateway's `*_URL` vars. (`.env` is already gitignored.)
- MongoDB is **Atlas** (cloud) — one connection string shared by all services; works identically from compose and from every EC2 instance, no DB container needed.

### EC2-later notes (documented, not built now)
- One service per instance (or grouped); run each via `docker run` (or a tiny per-instance compose) with that instance's `.env`.
- Open the service `PORT`s (4001–4006) in the **security group** only to the gateway instance; expose `8080` publicly on the gateway instance.
- Allowlist the EC2 egress IPs in **Atlas Network Access**.

## Step 5 — Postman collection (the deliverable for testing)
- Create `postman/gym-fitness.postman_collection.json` + `postman/gym-fitness.postman_environment.json`.
- Environment vars: `baseUrl` = `http://localhost:8080`, `token` (auto-filled).
- Folders per service; every endpoint above as a request against `{{baseUrl}}/api/...`.
- On the **Login** request add a test script: `pm.environment.set("token", pm.response.json().token)` so subsequent requests auto-auth via `Bearer {{token}}`.
- Include the **seed-admin** request first so graders can bootstrap, then login as admin.

## Critical files
- Fix: `identity-service/index.js`, requires casing in it; remove `identity-service/index-claude.js`, `identity-service/test.js`.
- New per service: `index.js`, `dbConnect.js`, `models/*.js`, updated `package.json`, `Dockerfile` (member/membership/trainer/workout/attendance).
- New gateway: `api-gateway/index.js`, `api-gateway/package.json`, `api-gateway/Dockerfile`.
- New root: `docker-compose.yaml`, `.env.example`, `postman/` collection + environment.

## Verification (end-to-end in Postman)
1. Provide a real `uri` (MongoDB Atlas) and a `JWT_SECRET` in `.env`.
2. Start everything: `docker compose up --build` (or run each service with `npm install && node index.js` for local dev).
3. `GET http://localhost:8080/health` → ok.
4. `POST /api/auth/seed-admin` → admin created; `POST /api/auth/login` as admin → token saved by test script.
5. Walk the Postman folders: create a member → create a plan → subscribe the member → create a trainer → create/assign a workout → check-in attendance. Confirm 2xx + correct JSON.
6. **RBAC checks:** log in as a `member`, retry an admin-only write (e.g. `POST /api/plans`) → expect **403**; call with no token → **401**.
