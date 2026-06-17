# Project Plan: Gym & Fitness Membership App

## 1. Project Explanation in Words

This project is a microservice-based Gym & Fitness Membership App. The system is built for a gym that needs to manage users, members, trainers, workout plans, membership plans, and attendance records.

The client will not call each service directly. Every request from Postman goes through the API Gateway first. The API Gateway verifies JWT tokens, checks the user's role, and then forwards the request to the correct microservice.

The Auth Service is the Registration-Login microservice required by the assignment. In this codebase, the real in-progress entry file is `identity-service/index.js`. The `index-claude.js` file is only a test/reference file and is not the final service entry point.

The app has three roles:

| Role | Access |
| --- | --- |
| `admin` | Full system access. Can manage users, members, trainers, plans, workouts, and attendance. |
| `trainer` | Can manage workout plans and update trainer-related data. |
| `member` | Can browse workouts, check in/out, and view allowed member data. |

The normal project flow is:

1. Create the first app admin using `/seed-admin`.
2. Log in as admin and receive a JWT token.
3. Register member and trainer users.
4. Manage member profiles.
5. Manage trainer profiles.
6. Create workout plans.
7. Create membership plans.
8. Record member check-in and check-out.
9. Test all APIs from Postman through the API Gateway.
10. Capture clear screenshots for documentation.

The MongoDB Atlas admin account is separate from the app admin user. The MongoDB admin manages the database.

## 2. Current Grading Target

The latest project instruction says:

| Area | Score |
| --- | ---: |
| Project | 25 |
| Documentation | 5 |
| Total | 30 |

The point breakdown can be added in [rubric.md](rubric.md).

## 3. Technology Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 18 |
| Framework | Express.js |
| Database | MongoDB Atlas |
| Authentication | JWT with `jsonwebtoken` and `bcryptjs` |
| Proxy | `http-proxy` |
| Containerization | Docker and Docker Compose |
| Load Balancer | Nginx |
| Cloud | AWS EC2 Ubuntu 22.04 |
<!-- | Final scale-up option | Kubernetes with Minikube | -->

## 4. Technical Architecture

```text
                        +---------------------------------+
                        |           EC2 #1                |
Postman / Client -----> |   Nginx Load Balancer (:80)     |
                        |   api-gateway        (:3000)    |
                        |   auth-service       (:3001)    |
                        +---------------+-----------------+
                                        |
                         JWT verified and role checked
                                        |
                   +--------------------+--------------------+
                   |                                         |
                   v                                         v
        +------------------------+          +----------------------------------+
        |        EC2 #2          |          |             EC2 #3              |
        | member-service  :3002  |          | workout-service    :3004        |
        | member-service  :3007  |          | membership-service :3005        |
        | trainer-service :3003  |          | attendance-service :3006        |
        +-----------+------------+          +----------------+-----------------+
                    |                                      |
                    +------------------+-------------------+
                                       v
                              +----------------+
                              | MongoDB Atlas  |
                              | 6 collections  |
                              +----------------+
```

Architecture rules:

1. All API calls must pass through the API Gateway.
2. JWT verification happens before protected routes are forwarded.
3. Role-based authorization is enforced before forwarding.
4. Microservices connect to MongoDB Atlas.
5. Services are containerized with Docker.
6. Deployment uses a maximum of 3 EC2 instances.
7. Public Nginx traffic goes to the API Gateway first.
8. The API Gateway forwards member routes to an internal Nginx upstream that load balances two `member-service` instances.

## 5. Microservices and Ports

| # | Microservice | Port | Purpose |
| ---: | --- | ---: | --- |
| 1 | `api-gateway` | 3000 | Single entry point, JWT verification, RBAC, proxy routing |
| 2 |  `identity-service` | 3001 | Registration, login, JWT generation, user management |
| 3 | `member-service` | 3002 | Member profile and membership plan data |
| 4 | `trainer-service` | 3003 | Trainer profiles and availability |
| 5 | `workout-service` | 3004 | Workout plans created by trainers/admins |
| 6 | `membership-service` | 3005 | Membership plan catalog |
| 7 | `attendance-service` | 3006 | Member check-in/check-out records |
| 8 | `member-service` second instance | 3007 | Extra member-service instance for Nginx load balancing |

## 6. API Gateway Routes

The API Gateway is the only public API entry point.

| Method | Gateway Route | Auth | Forwards To |
| --- | --- | --- | --- |
| POST | `/register` | admin | auth-service |
| POST | `/login` | Public | auth-service |
| GET | `/users` | admin | auth-service |
| DELETE | `/users/:id` | admin | auth-service |
| POST | `/members` | admin | member-service |
| GET | `/members` | admin | member-service |
| GET | `/members/me` | member | member-service |
| PUT | `/members/me` | member | member-service |
| GET | `/members/:id` | admin | member-service |
| PUT | `/members/:id` | admin | member-service |
| DELETE | `/members/:id` | admin | member-service |
| POST | `/trainers` | admin | trainer-service |
| GET | `/trainers` | all roles | trainer-service |
| GET | `/trainers/me` | trainer | trainer-service |
| PUT | `/trainers/me` | trainer | trainer-service |
| GET | `/trainers/:id` | all roles | trainer-service |
| PUT | `/trainers/:id` | admin | trainer-service |
| DELETE | `/trainers/:id` | admin | trainer-service |
| POST | `/workouts` | trainer, admin | workout-service |
| GET | `/workouts` | all roles | workout-service |
| GET | `/workouts/my` | trainer | workout-service |
| GET | `/workouts/:id` | all roles | workout-service |
| PUT | `/workouts/:id` | trainer, admin | workout-service |
| DELETE | `/workouts/:id` | admin | workout-service |
| POST | `/plans` | admin | membership-service |
| GET | `/plans` | all roles | membership-service |
| PUT | `/plans/:id` | admin | membership-service |
| DELETE | `/plans/:id` | admin | membership-service |
| POST | `/checkin` | member, admin | attendance-service |
| PUT | `/checkout/me` | member | attendance-service |
| PUT | `/checkout/:id` | admin | attendance-service |
| GET | `/attendance/me` | member | attendance-service |
| GET | `/attendance/member/:memberId` | trainer, admin | attendance-service |
| GET | `/attendance` | admin | attendance-service |

## 7. Role Authorization Rules

The gateway should use role middleware similar to:

```text
authRole('member')  -> passes for member and admin
authRole('trainer') -> passes for trainer and admin
authRole('admin')   -> passes for admin only
```

Rules:

1. `admin` can access any route.
2. `trainer` can access trainer-level routes and public/all-role routes.
3. `member` can access member-level routes and public/all-role routes.
4. A token from one role must not work for a route restricted to another higher role.
5. Role authorization is not enough for user-owned records. Member and trainer self-service routes must use `/me` or must verify ownership inside the target service.
6. MongoDB `_id` values are safe for admin-managed routes, but normal members should not need to know their member profile `_id`.
7. The API Gateway should forward the authenticated user's identity to services after JWT verification, for example `x-user-id`, `x-user-role`, and `x-user-email`.
8. Services must never trust a client-supplied `userId`, `memberId`, or `trainerId` for ownership decisions. They should use the verified identity forwarded by the gateway.

Required security screenshots:

| Test | Expected Result |
| --- | --- |
| Wrong email/password on login | `401 Invalid credentials` |
| Fake or invalid token on protected route | `403 Invalid token` or `401 Unauthorized` |
| Member token on admin route | `403 Unauthorized` |
| Member token requesting `/members/:id` | `403 Unauthorized` because arbitrary member IDs are admin-only |
| Member token requesting `/members/me` | Own profile only |
| Member token requesting `/checkout/:id` | `403 Unauthorized` because arbitrary checkout IDs are admin-only |
| Member token requesting `/checkout/me` | Closes their own latest open attendance record |
| Trainer token updating someone else's workout | `403 Unauthorized` unless the workout belongs to that trainer |

## 8. Microservice APIs

### 8.1 Auth Service

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | Public | Create user, hash password, save to DB |
| POST | `/login` | Public | Verify password and return JWT |
| GET | `/users` | admin | Get all users without passwords |
| DELETE | `/users/:id` | admin | Delete a user |

JWT payload should include the MongoDB user `_id`:

```js
{
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role
}
```

### 8.2 Member Service

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/members` | admin | Create a member profile for a registered user |
| GET | `/members` | admin | List all members |
| GET | `/members/me` | member | Get the logged-in member's own profile using JWT user ID |
| PUT | `/members/me` | member | Update the logged-in member's own allowed profile fields |
| GET | `/members/:id` | admin | Get one member profile by MongoDB member `_id` |
| PUT | `/members/:id` | admin | Update any member profile or plan by MongoDB member `_id` |
| DELETE | `/members/:id` | admin | Remove member |

Member ownership rule:

1. `members._id` is the MongoDB ID of the member profile document.
2. `members.userId` stores the MongoDB `_id` of the auth user from the `users` collection.
3. A member should use `/members/me`; the service finds the profile with `Member.findOne({ userId: req.user.id })`.
4. A member must not call `/members/:id` because that exposes arbitrary member document IDs.

### 8.3 Trainer Service

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/trainers` | all roles | List all trainers |
| POST | `/trainers` | admin | Create a trainer profile for a registered trainer user |
| GET | `/trainers/me` | trainer | Get the logged-in trainer's own profile using JWT user ID |
| PUT | `/trainers/me` | trainer | Update the logged-in trainer's own allowed profile fields |
| GET | `/trainers/:id` | all roles | View one trainer's public profile by MongoDB trainer `_id` |
| PUT | `/trainers/:id` | admin | Update any trainer profile by MongoDB trainer `_id` |
| DELETE | `/trainers/:id` | admin | Remove trainer |

Trainer ownership rule:

1. `trainers._id` is the MongoDB ID of the trainer profile document.
2. `trainers.userId` stores the MongoDB `_id` of the auth user from the `users` collection.
3. A trainer should use `/trainers/me`; the service finds the profile with `Trainer.findOne({ userId: req.user.id })`.
4. `GET /trainers/:id` can be available to all roles because it is public trainer profile data.
5. Trainers must not update arbitrary `/trainers/:id`; admin uses `:id`, trainers use `/me`.

### 8.4 Workout Service

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/workouts` | trainer, admin | Create workout plan |
| GET | `/workouts` | all roles | List all workouts |
| GET | `/workouts/my` | trainer | List workouts created by the logged-in trainer |
| GET | `/workouts/:id` | all roles | View one workout by MongoDB workout `_id` |
| PUT | `/workouts/:id` | trainer, admin | Update workout; trainer must own the workout |
| DELETE | `/workouts/:id` | admin | Delete workout |

Workout ownership rule:

1. `workouts._id` is the MongoDB ID of the workout document.
2. `workouts.trainerId` stores the MongoDB `_id` of the trainer profile or trainer auth user, depending on the final implementation choice.
3. A trainer can update a workout only if the workout belongs to that trainer.
4. Admin can update or delete any workout by MongoDB workout `_id`.

### 8.5 Membership Service

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/plans` | admin | Create membership plan |
| GET | `/plans` | all roles | List membership plans |
| PUT | `/plans/:id` | admin | Update plan pricing/features |
| DELETE | `/plans/:id` | admin | Remove plan |

### 8.6 Attendance Service

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/checkin` | member, admin | Log gym entry; member creates only their own record |
| PUT | `/checkout/me` | member | Log gym exit for the logged-in member's latest open attendance record |
| PUT | `/checkout/:id` | admin | Log gym exit by MongoDB attendance record `_id` |
| GET | `/attendance/me` | member | View the logged-in member's own visit history |
| GET | `/attendance/member/:memberId` | trainer, admin | View one member's visit history by MongoDB member `_id` |
| GET | `/attendance` | admin | View all attendance logs |

Attendance ownership rule:

1. `attendances._id` is the MongoDB ID of the attendance record.
2. `attendances.memberId` stores the MongoDB `_id` of the member profile.
3. A member checks out with `/checkout/me`; the service finds the latest attendance record where `memberId` is the logged-in member profile and `checkOut` is empty.
4. Admin can use `/checkout/:id` when manually closing a specific attendance record.
5. A member views history with `/attendance/me`; trainer/admin can use `/attendance/member/:memberId`.

## 9. MongoDB Collections and Schemas

MongoDB creates `_id` automatically for every document. This project uses that `_id` as the route ID for admin-managed routes such as `/users/:id`, `/members/:id`, `/trainers/:id`, `/workouts/:id`, `/plans/:id`, and admin-only `/checkout/:id`.

For relationships between collections, store the referenced document's MongoDB `_id`. In Mongoose this can be `mongoose.Schema.Types.ObjectId`; if stored as `String` in the current simple implementation, it must still contain the MongoDB `_id` value.

### 9.1 `users` Collection

```js
{
  name: String,
  email: String,
  password: String,
  role: String,
  createdAt: Date
}
```

Notes:

| Field | Purpose |
| --- | --- |
| `email` | Required and unique |
| `password` | Stored as bcrypt hash |
| `role` | `member`, `trainer`, or `admin`; default should be `member` |

### 9.2 `members` Collection

```js
{
  userId: ObjectId,
  name: String,
  phone: String,
  plan: String,
  joinDate: Date,
  isActive: Boolean
}
```

Notes:

| Field | Purpose |
| --- | --- |
| `_id` | MongoDB member profile ID used by admin routes |
| `userId` | MongoDB user `_id` from the auth `users` collection |
| `plan` | `basic`, `premium`, or `vip` |
| `isActive` | Whether the member account is active |

### 9.3 `trainers` Collection

```js
{
  userId: ObjectId,
  name: String,
  specialization: String,
  bio: String,
  experienceYears: Number,
  isAvailable: Boolean,
  createdAt: Date
}
```

Notes:

| Field | Purpose |
| --- | --- |
| `_id` | MongoDB trainer profile ID used by admin routes and public trainer viewing |
| `userId` | MongoDB user `_id` from the auth `users` collection |
| `isAvailable` | Whether the trainer is available for assignment or booking |

### 9.4 `workouts` Collection

```js
{
  title: String,
  trainerId: ObjectId,
  description: String,
  difficulty: String,
  targetMuscle: String,
  exercises: [
    {
      name: String,
      sets: Number,
      reps: Number
    }
  ],
  createdAt: Date
}
```

Notes:

| Field | Purpose |
| --- | --- |
| `_id` | MongoDB workout ID |
| `trainerId` | MongoDB trainer profile `_id` or trainer user `_id`; choose one and use it consistently |
| `difficulty` | `beginner`, `intermediate`, or `advanced` |
| `targetMuscle` | `chest`, `back`, `legs`, `arms`, or `full body` |

### 9.5 `plans` Collection

```js
{
  name: String,
  price: Number,
  features: [String],
  duration: Number,
  isActive: Boolean
}
```

Notes:

| Field | Purpose |
| --- | --- |
| `_id` | MongoDB membership plan ID used by admin routes |
| `name` | `basic`, `premium`, or `vip` |
| `duration` | Duration in months |

### 9.6 `attendances` Collection

```js
{
  memberId: ObjectId,
  checkIn: Date,
  checkOut: Date,
  duration: Number
}
```

Notes:

| Field | Purpose |
| --- | --- |
| `_id` | MongoDB attendance record ID used for checkout |
| `memberId` | MongoDB member profile `_id`; for member routes, resolve it from the logged-in user's profile |
| `duration` | Calculated in minutes on checkout |

## 10. EC2 Deployment Split

The assignment allows a maximum of 3/4 EC2 instances. This plan uses 3 EC2 instances.

| EC2 | Services | Ports |
| --- | --- | --- |
| EC2 #1 | Nginx, api-gateway, auth-service | `80`, `3000`, `3001` |
| EC2 #2 | member-service instance 1, member-service instance 2, trainer-service | `3002`, `3007`, `3003` |
| EC2 #3 | workout-service, membership-service, attendance-service | `3004`, `3005`, `3006` |
| Atlas | MongoDB cloud database | Cloud managed |

Security group plan:

| Port | Access |
| --- | --- |
| `22` | Developer SSH only |
| `80` | Public Postman/client access through Nginx |
| `3000` | Gateway access; can be public for testing or internal behind Nginx |
| `3001-3007` | Internal service access from gateway/Nginx only |

## 11. Docker Plan

Each service uses the same Dockerfile pattern:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE <PORT>
CMD ["node", "index.js"]
```

Each service should also have a `.dockerignore`:

```text
node_modules
.env
npm-debug.log
.git
.gitignore
*.md
.DS_Store
```

The root `docker-compose.yaml` is for local testing before EC2 deployment.

## 12. Nginx Load Balancer Plan

Nginx on EC2 #1 has two jobs:

1. Public port `80` forwards client/Postman traffic to the API Gateway.
2. Internal port `8081` load balances `member-service` across two running member-service instances on EC2 #2.

This keeps the assignment rule correct: all public API calls still pass through the API Gateway. The gateway then forwards member routes to the internal load-balancer URL.

```nginx
upstream member_service {
    server <EC2-2-IP>:3002;
    server <EC2-2-IP>:3007;
}

server {
    listen 80;

    location / {
        proxy_pass http://localhost:3000;
    }
}

server {
    listen 8081;

    location / {
        proxy_pass http://member_service;
    }
}
```

Load balancer proof:

1. Run both member-service instances on EC2 #2.
2. Configure the API Gateway member-service target to use `http://localhost:8081`.
3. Send repeated Postman requests to `/members` through public port `80`.
4. Check logs for both member-service containers.
5. Capture screenshots showing traffic reached both instances.

## 13. Environment Variables

### 13.1 `api-gateway/.env`

```text
PORT=3000
JWT_SECRET=gym_secret_2024
AUTH_IP=<EC2-1-IP>
MEMBER_IP=<EC2-2-IP>
TRAINER_IP=<EC2-2-IP>
WORKOUT_IP=<EC2-3-IP>
MEMBERSHIP_IP=<EC2-3-IP>
ATTENDANCE_IP=<EC2-3-IP>
MEMBER_LB_URL=http://localhost:8081
```

### 13.2 `identity-service/.env`

```text
PORT=3001
MONGO_URI=mongodb+srv://admin:<password>@gym-fitness-cluster.ayrgmkz.mongodb.net/auth-db
JWT_SECRET=gym_secret_2024
```

### 13.3 Service `.env` Files

```text
member-service:
PORT=3002
MONGO_URI=mongodb+srv://admin:<password>@gym-fitness-cluster.ayrgmkz.mongodb.net/member-db

trainer-service:
PORT=3003
MONGO_URI=mongodb+srv://admin:<password>@gym-fitness-cluster.ayrgmkz.mongodb.net/trainer-db

workout-service:
PORT=3004
MONGO_URI=mongodb+srv://admin:<password>@gym-fitness-cluster.ayrgmkz.mongodb.net/workout-db

membership-service:
PORT=3005
MONGO_URI=mongodb+srv://admin:<password>@gym-fitness-cluster.ayrgmkz.mongodb.net/membership-db

attendance-service:
PORT=3006
MONGO_URI=mongodb+srv://admin:<password>@gym-fitness-cluster.ayrgmkz.mongodb.net/attendance-db
```

## 14. Build Order

| Phase | Work |
| --- | --- |
| Phase 1 | Finish Auth Service in `identity-service/index.js`, including register, login, JWT, users, seed-admin |
| Phase 2 | Build API Gateway with `http-proxy`, token middleware, and role middleware |
| Phase 3 | Implement member-service and trainer-service |
| Phase 4 | Implement workout-service, membership-service, and attendance-service |
| Phase 5 | Add Dockerfiles and root Docker Compose |
| Phase 6 | Test all routes locally through gateway |
| Phase 7 | Deploy to 3 EC2 instances |
| Phase 8 | Configure Nginx load balancer |
| Phase 9 | Test from Postman using EC2 public IP |
| Phase 10 | Capture documentation screenshots |

## 15. Postman Testing Checklist

Security tests:

| Test | Expected Result |
| --- | --- |
| `POST /auth/login` with wrong password | `401 Invalid credentials` |
| Protected route with fake token | `403 Invalid token` or `401 Unauthorized` |
| Member token on admin route | `403 Unauthorized` |

Per-service tests:

| Service | Tests |
| --- | --- |
| auth-service | Register member, register trainer, seed admin, login all roles |
| member-service | Get all, get one, update, delete |
| trainer-service | Create, list, update, delete |
| workout-service | Create, list, update, delete |
| membership-service | Create plan, list plans, update plan, delete plan |
| attendance-service | Check in, check out, view member history, view all logs |

MongoDB Atlas checks:

| Check | Expected Result |
| --- | --- |
| Collections visible | `users`, `members`, `trainers`, `workouts`, `plans`, `attendances` |
| Data inserted | Each collection has data after Postman testing |

Docker checks:

| Check | Expected Result |
| --- | --- |
| `docker compose up --build` | Starts all services locally |
| Gateway routes | All services reachable through gateway |

EC2 checks:

| Check | Expected Result |
| --- | --- |
| Public Postman test | Calls work through EC2 public IP |
| Load balancing | Traffic splits across member-service ports `3002` and `3007` |

## 16. Screenshot Checklist for Documentation

Screenshots must be large, readable, and organized.

| Screenshot | Required Content |
| --- | --- |
| Title page | Project title |
| Architecture | EC2 split, API Gateway, Nginx, services, MongoDB Atlas |
| Service API table | Microservice name and API names |
| MongoDB schema code | Collection name and schema code |
| Postman success calls | URL, method, token/header when needed, response status/body |
| Wrong UID/password | Failed login response |
| Invalid token | Gateway rejection response |
| Unauthorized role | One role token blocked from another role's route |
| Load balancing | Nginx config and proof of traffic split |
| EC2 deployment | Running containers or successful public IP request |

## 17. Final Documentation Structure

The final documentation should be organized like this:

1. Title of the Project.
2. Project overview in words.
3. Tech stack.
4. Role system.
5. Architecture diagram.
6. Microservice name and API name in each microservice.
7. MongoDB collection names and schema code.
8. Docker setup.
9. EC2 deployment split.
10. Load balancing code screenshot and proof.
11. Postman API call screenshots.
12. Required testing screenshots.
13. Rubric table from [rubric.md](rubric.md).

## 18. Final Success Criteria

The project is complete when:

1. Every API call passes through the API Gateway.
2. JWT authentication works through login and protected routes.
3. Role-based authorization blocks invalid role access.
4. At least 6/7 microservices are present and working.
5. Each microservice has multiple database-connected APIs.
6. MongoDB Atlas stores data for all collections.
7. Services run locally with Docker Compose.
8. Services deploy across 3 EC2 instances.
9. Nginx load balancing works for two member-service instances.
10. Postman screenshots clearly prove success and required security failures.
