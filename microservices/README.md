# Munchbox microservices (target architecture, scaffolded)

Read [`ARCHITECTURE.md`](../ARCHITECTURE.md) at the repo root first — it explains why
this split exists, the full service map with diagrams, and the migration order. This
folder is the scaffold that document describes: every service listed there has a
bootable skeleton here (`GET /health`) and a README documenting exactly what it owns and
the API contract it should grow into.

**Nothing in here runs in production yet.** The existing `backend/` monolith keeps
serving every client app unchanged. This folder is where migration work lands,
one service at a time, in the order ARCHITECTURE.md §6 lays out.

## Services

| Service | Port | Owns | Migration phase |
|---|---|---|---|
| [gateway](gateway/) | 4000 | — (routes to everything) | Phase 1 |
| [catering-service](catering-service/) | 4005 | `CateringRequest` | Phase 2 (first) |
| [notification-service](notification-service/) | 4008 | — (SMS integration) | Phase 3 |
| [media-service](media-service/) | 4010 | uploaded files | Phase 3 |
| [catalog-service](catalog-service/) | 4002 | `Shop`, `Product`, `Coupon` | Phase 4 |
| [finance-service](finance-service/) | 4006 | `LedgerEntry`, `Expense`, shop billing | Phase 5 |
| [delivery-service](delivery-service/) | 4004 | live tracking, work area | Phase 6 |
| [order-service](order-service/) | 4003 | `Order`, `Message` | Phase 7 |
| [identity-service](identity-service/) | 4001 | `User`, `Otp` | Phase 7 (last) |
| [admin-config-service](admin-config-service/) | 4009 | `Settings` | Phase 3–4 |

## Running everything locally

```
docker compose up
```

Brings up the gateway + all ten service skeletons + the existing monolith together, so
you can point a client at the gateway's URL and watch requests fall through to the
monolith (nothing's migrated yet, so every request should behave identically to talking
to the monolith directly).

Without Docker, run each service's `npm install && npm run dev` in its own terminal —
tedious for ten services, which is exactly the problem `docker-compose.yml` solves.

## Adding real logic to a service

1. Pick the next service in migration-phase order (table above).
2. Copy the relevant handler(s) out of `backend/src/controllers/*.js` into that
   service's `src/`, using its README's "API contract" table as the target shape.
3. Point the gateway's matching `SERVICE_ROUTES` entry (in `gateway/src/index.js`) at
   the new service instead of relying on the monolith fallback — this is the one line
   that actually cuts traffic over.
4. Delete the now-redundant routes from the monolith once the new service has been
   running in production without issues.

Each step is independently revertible: undo step 3 and traffic goes straight back to the
monolith.
