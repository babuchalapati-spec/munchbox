# gateway

The single public entry point for every client app (4 mobile apps, the customer PWA,
the admin/shop dashboard). Verifies the JWT once and forwards identity to downstream
services as headers, then routes by path prefix to whichever service owns that domain.

## Why a gateway at all

Six different client apps currently each need to know the backend's URL directly
(`mobile/src/api/client.js`, `pwa/src/api/client.js`, `admin/src/api/client.js` all
duplicate this). A gateway means:

- Clients only ever need one URL, forever — which service actually handles a request
  can change without any client update.
- Auth is verified in exactly one place instead of ten.
- Cross-cutting concerns (rate limiting, request logging, CORS) live in one file.

## How the fallback works

`SERVICE_ROUTES` in `src/index.js` lists every prefix that has a real service behind it.
Anything not listed falls through to `MONOLITH_URL` — the existing, unchanged backend.
This is what makes Phase 1 of the migration (ARCHITECTURE.md §6) safe: the gateway can
go live in front of production traffic on day one, forwarding 100% of it to the
monolith exactly as today, with zero behavior change. Each subsequent phase just adds
one more entry to `SERVICE_ROUTES` and deletes that domain's routes from the monolith.

## Local development

```
cp .env.example .env
npm install
npm run dev
```

See `../docker-compose.yml` at the microservices root to run the gateway alongside every
service (and the existing monolith) together.
