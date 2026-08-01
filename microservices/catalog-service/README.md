# catalog-service

Owns what's for sale and where — shops, their menus, and coupons. Read-heavy (every
customer browsing the app hits this), so it's the first candidate for its own caching
layer or read replica once traffic justifies it.

## Owns

- `Shop` (name, category, address, location, per-km delivery rate, images)
- `Product` (menu items per shop)
- `Coupon`

**Explicitly does not own** `Shop.subscription` / `Shop.deposit` / `Shop.agreement` in
the target design — see ARCHITECTURE.md §4. Until finance-service exists, catalog-service
keeps these fields as-is and just exposes a computed `isLiveToCustomers` flag so
order-service and the storefronts never have to know the underlying rule.

## Depends on

- `finance-service` (future) — to resolve whether a shop is live (subscription active,
  deposit paid or agreement signed)

## Migrated from (monolith source)

`backend/src/controllers/shopController.js`, `backend/src/controllers/productController.js`,
`backend/src/models/Shop.js`, `backend/src/models/Product.js`, `backend/src/models/Coupon.js`,
`backend/src/utils/geo.js` (geocoding).

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/catalog/shops?lat=&lng=&category=` | List shops, distance-sorted and 15km-filtered when a location is given | optional |
| GET | `/catalog/shops/:id` | Shop detail | public |
| POST | `/catalog/shops` | Admin creates a shop directly | JWT (admin) |
| PUT | `/catalog/shops/:id` | Update shop | JWT (admin) |
| GET | `/catalog/products?shop=` | List products, optionally by shop | optional |
| POST | `/catalog/products` | Shop owner adds a product | JWT (shop) |
| PUT | `/catalog/products/:id/review` | Admin approves/hides a product | JWT (admin) |

## Not yet implemented

Bootable skeleton only (`GET /health`) — see ARCHITECTURE.md §6, Phase 4.
