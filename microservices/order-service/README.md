# order-service

Owns the order lifecycle end to end — placement, status transitions, pickup/delivery
confirmation codes, ratings, and the order-scoped chat between customer/shop/partner.
This is the highest-coupling service (depends on catalog, identity, finance, and
delivery) and should be the **last** one migrated out of the monolith (ARCHITECTURE.md §6).

## Owns

- `Order` (both shop orders and point-to-point courier orders)
- `Message` (chat scoped to an order)

## Depends on

- `catalog-service` — validate shop/products, price items, get pickup location
- `identity-service` — resolve customer/partner identities
- `finance-service` — compute delivery fee + platform commission, check wallet balance
- `delivery-service` — partner assignment and live location (read side)

## Migrated from (monolith source)

`backend/src/controllers/orderController.js` (order-lifecycle portion only — the
delivery-matching/tracking portion of this same file belongs to delivery-service, see
that service's README), `backend/src/models/Order.js`,
`backend/src/controllers/messageController.js`, `backend/src/models/Message.js`,
`backend/src/utils/distance.js`.

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/orders` | Place a shop order | JWT (customer) |
| POST | `/orders/courier` | Place a point-to-point courier order | JWT (customer) |
| GET | `/orders/mine` | Customer's own orders | JWT (customer) |
| GET | `/orders/:id` | Order detail (role-scoped) | JWT |
| PUT | `/orders/:id/status` | Advance order status | JWT (shop/delivery) |
| PUT | `/orders/:id/pickup` | Partner confirms pickup via code | JWT (delivery) |
| PUT | `/orders/:id/deliver` | Partner confirms delivery via code | JWT (delivery) |
| PUT | `/orders/:id/rate` | Customer rates shop + partner | JWT (customer) |
| GET | `/orders/:id/eta` | Live ETA to destination | JWT |
| GET/POST | `/orders/:id/messages` | Order chat | JWT |

Events published: `order.placed`, `order.status.changed`, `order.delivered`,
`order.cancelled` — finance-service subscribes to `order.delivered` to post commission.

## Not yet implemented

Bootable skeleton only (`GET /health`) — see ARCHITECTURE.md §6, Phase 7 (migrate last).
