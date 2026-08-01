# catering-service

Owns catering requests end to end — a customer's initial ask, the shop's quote, and the
customer's accept/decline. Fully self-contained today (zero shared mutable state with
orders), which is exactly why this is the **recommended first real split**
(ARCHITECTURE.md §6, Phase 2) — lowest risk way to prove the whole pattern (gateway
routing, independent deploy, independent DB) before touching anything higher-stakes.

## Owns

- `CateringRequest`

## Depends on

- `catalog-service` — look up the shop being requested

## Migrated from (monolith source)

`backend/src/controllers/cateringController.js`, `backend/src/models/CateringRequest.js`.

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/catering` | Customer submits a catering request | JWT (customer) |
| GET | `/catering/mine` | Customer's own requests | JWT (customer) |
| GET | `/catering` | Shop/admin view of requests | JWT (shop/admin) |
| PUT | `/catering/:id/quote` | Shop sends a quote | JWT (shop) |
| PUT | `/catering/:id/respond` | Customer accepts/declines | JWT (customer) |

## Not yet implemented

Bootable skeleton only (`GET /health`). This is the best starting point for an actual
migration exercise — port `cateringController.js`'s five handlers in here, point the
gateway at this service for the `/catering/*` prefix, and the monolith's own
`cateringRoutes.js` can be deleted once traffic is confirmed flowing through here.
