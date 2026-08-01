# shops-mf (stub — not yet scaffolded as a running app)

Would expose `ShopsApp`: the Shops list/edit + Shop approvals + Item approvals screens
currently in `admin/src/pages/Admin/{Shops,ShopAccounts,ItemApprovals}.jsx`. Talks to
`catalog-service` via the gateway (`/api/catalog/*`).

Reserved dev port: **5102**. Build using `orders-mf` as the template — see
`../README.md`'s "Building a new module" section.
