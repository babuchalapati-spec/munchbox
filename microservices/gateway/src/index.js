// API gateway — the one public entry point every client app (4 mobile apps, the PWA,
// the admin/shop dashboard) talks to. Verifies the JWT once here so downstream services
// can trust `req.headers['x-user-id']` / `x-user-role` instead of each reimplementing
// auth. Routes by path prefix to whichever service owns that domain — see
// ARCHITECTURE.md at the repo root for the full service map.
//
// During migration (ARCHITECTURE.md §6), a prefix that hasn't been split out yet simply
// isn't listed in SERVICE_ROUTES — point that prefix at the existing monolith instead
// until its phase arrives. MONOLITH_URL below is exactly that fallback.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Every microservice this gateway can route to, once it's actually serving traffic.
// Fill these in from each service's PORT as it's split out of the monolith.
const SERVICE_ROUTES = {
  '/api/identity': process.env.IDENTITY_SERVICE_URL || 'http://localhost:4001',
  '/api/catalog': process.env.CATALOG_SERVICE_URL || 'http://localhost:4002',
  '/api/orders': process.env.ORDER_SERVICE_URL || 'http://localhost:4003',
  '/api/delivery': process.env.DELIVERY_SERVICE_URL || 'http://localhost:4004',
  '/api/catering': process.env.CATERING_SERVICE_URL || 'http://localhost:4005',
  '/api/finance': process.env.FINANCE_SERVICE_URL || 'http://localhost:4006',
  '/api/payments': process.env.PAYMENT_SERVICE_URL || 'http://localhost:4007',
  '/api/config': process.env.ADMIN_CONFIG_SERVICE_URL || 'http://localhost:4009',
  '/api/media': process.env.MEDIA_SERVICE_URL || 'http://localhost:4010',
};

// Until every domain is migrated (see ARCHITECTURE.md §6), unmatched paths fall back to
// the existing monolith so the gateway can go live on day one without anything else
// having moved yet (Phase 1: gateway proxies 100% to the monolith).
const MONOLITH_URL = process.env.MONOLITH_URL || 'http://localhost:5001';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

// Verifies the JWT (if present) and forwards identity as headers, so every downstream
// service can trust `x-user-id`/`x-user-role` instead of re-verifying tokens itself.
// A missing/invalid token is NOT rejected here — individual services enforce their own
// auth requirements (some routes are intentionally public), matching the existing
// monolith's `protect` vs `optionalAuth` middleware split.
function attachIdentity(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.headers['x-user-id'] = payload.id;
      req.headers['x-user-role'] = payload.role;
    } catch (err) {
      // Invalid/expired token — leave identity headers unset; downstream 401s if the
      // route requires auth.
    }
  }
  next();
}
app.use(attachIdentity);

Object.entries(SERVICE_ROUTES).forEach(([prefix, target]) => {
  app.use(prefix, createProxyMiddleware({ target, changeOrigin: true, pathRewrite: { [`^${prefix}`]: '' } }));
});

app.use('/', createProxyMiddleware({ target: MONOLITH_URL, changeOrigin: true }));

app.listen(PORT, () => {
  console.log(`[gateway] listening on port ${PORT}, unmatched routes fall back to ${MONOLITH_URL}`);
});
