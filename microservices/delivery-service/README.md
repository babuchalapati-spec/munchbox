# delivery-service

Owns partner-facing delivery operations: which unassigned orders a partner can see and
claim, their preferred work area, and their live GPS position while out for delivery.
Split out from order-service because location writes are high-frequency (every 5–8
seconds per active delivery) and bursty — an outage here should never block placing new
orders.

## Owns (target — currently fields on `Order` and `User.kyc`)

- `DeliveryAssignment` *(new)* — which partner is assigned to which order, claim history
- `PartnerLocation` *(new)* — live lat/lng + timestamp per active delivery
- `workArea` *(moves off `User.kyc`)* — partner's home base + radius fallback

## Depends on

- `order-service` — to know which orders exist and update their status on pickup/delivery
- `identity-service` — partner KYC/verification status gate

## Migrated from (monolith source)

The delivery-partner-specific functions inside `backend/src/controllers/orderController.js`:
`listAvailableOrders`, `claimOrder`, `setWorkArea`, `updateOrderLocation` — and the native
Android background-tracking pipeline this session added
(`mobile/android/.../location/LocationTrackingService.kt` posts directly to
`PUT /orders/:id/location`, which becomes `PUT /delivery/orders/:id/location` here).

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/delivery/available?lat=&lng=` | Nearby unclaimed orders, work-area fallback | JWT (delivery) |
| GET | `/delivery/assigned` | Partner's current deliveries | JWT (delivery) |
| PUT | `/delivery/orders/:id/claim` | Claim an order | JWT (delivery) |
| PUT | `/delivery/work-area` | Set home base + radius | JWT (delivery) |
| PUT | `/delivery/orders/:id/location` | Post a live GPS fix | JWT (delivery) |

Events published: `delivery.assigned`, `delivery.location.updated` (order-service
subscribes to mirror `currentLocation` for the customer-facing tracking read).

## Not yet implemented

Bootable skeleton only (`GET /health`) — see ARCHITECTURE.md §6, Phase 6.
