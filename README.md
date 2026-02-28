# 🩺 Smart Patient Symptom Checker & Appointment Platform – Backend

This is the **backend** of the **Smart Patient Symptom Checker & Appointment Platform**, built with **Node.js**, **Express**, and **TypeScript**. It supports authentication, doctor/patient management, appointment booking, real-time chat, and integrates with an ML-based symptom checker.

---

## 🧰 Tech Stack

- 🟦 Node.js + Express  
- 🌀 TypeScript  
- 🔐 JWT Authentication  
- 🧾 RESTful APIs  
- 📬 Socket.io (for real-time chat)  
- 🛢️ PostgreSQL
- 📦 Dotenv, Bcrypt, Cors, etc.

---

## 📦 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/gdg-charusat/CareXpert_backend
cd careXpert_backend
```

PORT=3000

# PostgreSQL
# DATABASE_URL=postgresql://user:password@localhost:5432/careXpert


**new docker setup**
-install docker and do the setup
-then check the .env.example use that env sample and use the same url
-compose up the docker file by right clicking the file(add docker extension too) 
-check your docker container must be running, check for error if there are none then
-npx prisma migrate dev (no new migration files must be created,if created then delete the file and use "npx prisma migrate deploy")
-happy coding

---

## 🔔 Real-time Notifications

- **Namespace:** `/notifications`
- **Auth:** JWT required (same as chat)
- **How it works:**  
  When a notification is created in the backend (e.g., appointment accepted/rejected, prescription added), the server emits a `new_notification` event to the user's room in `/notifications`.  
  The frontend can listen for this event to update the UI instantly, eliminating the need for polling `/api/notifications/unread-count`.

**Example client usage:**
```js
const socket = io("/notifications", { auth: { token: "JWT_HERE" } });
socket.on("new_notification", (payload) => {
  // Update UI, show toast, etc.
});
```

---

## ⚡ Caching Strategy (Redis)

CareXpert uses **Redis** as a caching layer to reduce database load and improve response times for high-traffic, read-heavy endpoints.

### Setup

Redis must be running before starting the backend.

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 --name carexpert-redis redis:7-alpine

# Or add to docker-compose.yaml (already supported via REDIS_URL)
```

Set `REDIS_URL` in your `.env` (default: `redis://localhost:6379`).

### Cached Endpoints

| Endpoint | Cache Key Pattern | TTL | Invalidated When |
|---|---|---|---|
| `GET /patient/fetchAllDoctors` | `doctors:all` | 5 min | Timeslot added/updated/deleted, appointment booked/cancelled |
| `GET /patient/search-doctors` | `doctors:{specialty}:{location}` | 1 hour | — (TTL expiry only) |
| `GET /patient/:doctorId/timeSlots` | `timeslots:{doctorId}:{date}` | 1 min | Timeslot added/updated/deleted, appointment booked/cancelled |

### Cache-Control Response Headers

Every response includes an `X-Cache` header:
- `X-Cache: HIT` – data served from Redis
- `X-Cache: MISS` – data fetched from the database and then stored in Redis

(Only applicable on endpoints using the `cacheMiddleware`.)

### Fallback Behaviour

If the Redis server is **unavailable**, all cache operations are silently swallowed and every request falls through to the database.  The application continues to function normally – just without the performance benefit of caching.

### Cache Invalidation Rules

| Action | Keys Invalidated |
|---|---|
| Patient books appointment | `timeslots:{doctorId}:*`, `doctors:all` |
| Patient cancels appointment | `timeslots:*` |
| Doctor cancels appointment | `timeslots:{doctorId}:*`, `doctors:all` |
| Doctor adds timeslot | `timeslots:{doctorId}:*`, `doctors:all` |
| Doctor updates timeslot | `timeslots:{doctorId}:*`, `doctors:all` |
| Doctor deletes timeslot | `timeslots:{doctorId}:*`, `doctors:all` |
| Doctor bulk-generates timeslots | `timeslots:{doctorId}:*`, `doctors:all` |
| Doctor completes/cancels appointment | `timeslots:{doctorId}:*`, `doctors:all` |

### Reusable Cache Middleware

For new read-only routes, apply caching in one line:

```ts
import { cacheMiddleware } from '../middlewares/cache.middleware';

router.get('/some-endpoint', isAuthenticated, cacheMiddleware(300), handler);
```

Pass `cacheMiddleware(0)` to disable caching (e.g. in tests).

### Running Cache Tests

```bash
npm test -- --testPathPattern=cache
```

No Redis instance is required – the tests mock the Redis client.
