// API gateway — the one public entry point every client app (4 mobile apps, the PWA,
// the admin/shop dashboard) talks to. Verifies the JWT once here so downstream services
// can trust `req.headers['x-user-id']` / `x-user-role` instead of each reimplementing
// auth. Routes by path prefix to whichever service owns that domain — see
// ARCHITECTURE.md at the repo root for the full service map.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const MONOLITH_URL = process.env.MONOLITH_URL || 'http://localhost:5001';

// Every target-shape prefix a client app calls, and the microservice that will
// eventually own it. `envVar` is unset until that service is actually deployed — see
// ARCHITECTURE.md §6 for the order they come online in.
const SERVICES = [
  { prefix: '/api/identity', envVar: 'IDENTITY_SERVICE_URL', port: 4001 },
  { prefix: '/api/catalog', envVar: 'CATALOG_SERVICE_URL', port: 4002 },
  { prefix: '/api/orders', envVar: 'ORDER_SERVICE_URL', port: 4003 },
  { prefix: '/api/delivery', envVar: 'DELIVERY_SERVICE_URL', port: 4004 },
  { prefix: '/api/catering', envVar: 'CATERING_SERVICE_URL', port: 4005 },
  { prefix: '/api/finance', envVar: 'FINANCE_SERVICE_URL', port: 4006 },
  { prefix: '/api/payments', envVar: 'PAYMENT_SERVICE_URL', port: 4007 },
  { prefix: '/api/config', envVar: 'ADMIN_CONFIG_SERVICE_URL', port: 4009 },
  { prefix: '/api/media', envVar: 'MEDIA_SERVICE_URL', port: 4010 },
];

// The target API shape (what client apps/micro-frontends call, per each service's
// README) doesn't line up 1:1 with the monolith's actual routes today — some domains
// were split across files that don't match the new boundaries (ledger lives under
// `/api/auth` today, not `/api/finance`; see ARCHITECTURE.md §2/§4 for why). Until each
// microservice is real, the gateway translates the new shape to the old one so clients
// can be written against the TARGET API now and get real data from the monolith today,
// with zero client-side changes needed when a service actually goes live.
const MONOLITH_REWRITES = {
  '/api/identity': (path) => path.replace(/^\/api\/identity/, '/api/auth'),
  '/api/catalog': (path) => path.replace(/^\/api\/catalog/, '/api'), // /shops, /products already top-level
  '/api/orders': (path) => path, // already matches 1:1
  '/api/delivery': (path) =>
    path.startsWith('/api/delivery/accounts')
      ? path.replace('/api/delivery/accounts', '/api/auth/delivery-accounts')
      : path.replace(/^\/api\/delivery/, '/api/orders'), // available/assigned/work-area/location/claim
  '/api/catering': (path) => path, // already matches 1:1
  '/api/finance': (path) =>
    path.startsWith('/api/finance/ledger') ? path.replace('/api/finance/ledger', '/api/auth/ledger') : path,
  '/api/payments': (path) => path, // already matches 1:1
  '/api/config': (path) => path.replace(/^\/api\/config/, '/api/settings'),
  '/api/media': (path) => path.replace(/^\/api\/media/, '/api/uploads'),
};

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
      // Invalid/expired token, or signed with the monolith's own JWT_SECRET rather than
      // this gateway's — leave identity headers unset. Harmless while every request
      // still goes to the monolith anyway, since it does its own verification.
    }
  }
  next();
}
app.use(attachIdentity);

SERVICES.forEach(({ prefix, envVar, port }) => {
  const realServiceUrl = process.env[envVar];
  if (realServiceUrl) {
    // The real microservice is deployed — route straight to it, target shape unchanged.
    app.use(prefix, createProxyMiddleware({ target: realServiceUrl, changeOrigin: true, pathRewrite: { [`^${prefix}`]: '' } }));
  } else {
    // Not migrated yet — fall back to the monolith, translating the path.
    app.use(
      prefix,
      createProxyMiddleware({
        target: MONOLITH_URL,
        changeOrigin: true,
        pathRewrite: (path) => MONOLITH_REWRITES[prefix](path),
      })
    );
    console.log(`[gateway] ${prefix} -> monolith fallback (${envVar} not set; would use :${port} once deployed)`);
  }
});

app.use('/', createProxyMiddleware({ target: MONOLITH_URL, changeOrigin: true }));

app.listen(PORT, () => {
  console.log(`[gateway] listening on port ${PORT}, unmigrated routes fall back to ${MONOLITH_URL}`);
});
