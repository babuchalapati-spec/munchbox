# catering-mf (stub — not yet scaffolded as a running app)

Would expose `CateringApp`: the Catering requests screen currently in
`admin/src/pages/Admin/Catering.jsx`. Talks to `catering-service` via the gateway —
pairs naturally with catering-service being the recommended first backend split
(ARCHITECTURE.md §6, Phase 2), so this is also a reasonable first micro-frontend to
build for real once the pattern here is adopted.

Reserved dev port: **5105**. Build using `orders-mf` as the template — see
`../README.md`'s "Building a new module" section.
