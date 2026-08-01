# Munchbox micro-frontends (target architecture, scaffolded)

Read [`ARCHITECTURE.md`](../ARCHITECTURE.md) §7 first. This folder scaffolds the
**admin/shop dashboard** as a shell + independently-deployable modules using
[Vite Module Federation](https://github.com/originjs/vite-plugin-federation).

**The four React Native mobile apps are explicitly out of scope** — see ARCHITECTURE.md
§7 for why. `pwa/` (the customer web app) would follow the same pattern with its own
shell — a natural next step once this one is adopted, not scaffolded in this pass.

**Nothing in here replaces `admin/` yet.** The existing admin/shop dashboard keeps
running unchanged. This is where migration work lands once the team decides to cut
traffic over.

## Modules

| Module | Exposes | Port | Talks to (via gateway) |
|---|---|---|---|
| [shell](shell/) | — (host) | 5100 | — |
| [orders-mf](orders-mf/) | `OrdersApp` | 5101 | `/api/orders` |
| [shops-mf](shops-mf/) | `ShopsApp` | 5102 | `/api/catalog` |
| [delivery-mf](delivery-mf/) | `DeliveryApp` | 5103 | `/api/delivery` |
| [finance-mf](finance-mf/) | `FinanceApp` | 5104 | `/api/finance` |
| [catering-mf](catering-mf/) | `CateringApp` | 5105 | `/api/catering` |
| [settings-mf](settings-mf/) | `SettingsApp` | 5106 | `/api/config` |

All six are real, buildable Vite apps — every one builds cleanly and boot-serves its
`remoteEntry.js`/HTML (verified with `vite build` + `vite preview` across the whole set).
Each module's UI mirrors its corresponding page in `admin/src/pages/Admin/` (shops-mf,
for instance, carries over the same "visible to customers" check added there this
session) and calls the gateway exactly the way it will once the matching backend service
actually exists — until then, every one of them shows a clear, expected "reach the
gateway once that service is migrated" message rather than failing silently. See
ARCHITECTURE.md §6 for the migration order each module's message references.

## How Module Federation works here

- Each `*-mf` folder is its **own Vite app** with its own `package.json`, builds to its
  own `dist/`, and can be deployed to its own static host independently.
- `vite.config.js` in each remote uses the federation plugin's `exposes` to publish one
  or more components under a name (`orders_mf/OrdersApp`).
- `shell/vite.config.js` lists every remote it knows how to load under `remotes`, by URL.
- At runtime, the shell's browser fetches `orders-mf`'s `remoteEntry.js` and dynamically
  imports `OrdersApp` — no build-time coupling between the two apps at all. Redeploying
  `orders-mf` alone, with no shell rebuild, is the entire point.

## Running the working example locally

```
cd orders-mf && npm install && npm run build && npm run preview   # serves on :5101
cd ../shell   && npm install && npm run build && npm run preview  # serves on :5100
```

Open `http://localhost:5100/orders` — the shell loads `OrdersApp` from `orders-mf`
across the network. `orders-mf` also runs completely standalone
(`npm run dev` → `http://localhost:5101`) for independent development, which is the
other half of the point: a team working on orders never needs the shell running at all.

## Building the next module (e.g. a customer-PWA shell + browse-mf)

1. Copy `orders-mf`'s structure: `package.json`, `vite.config.js`, `src/App.jsx`,
   `src/main.jsx`, `index.html`. Rename the federation `name`/`exposes` key.
2. Add one line to the relevant shell's `vite.config.js` `remotes` map and one `<Route>`
   + `lazy(() => import('...'))` in that shell's `src/App.jsx`.
3. Point it at the gateway (`VITE_GATEWAY_URL`) the same way every existing module does —
   never at a specific microservice directly, so the gateway's monolith-fallback keeps
   working during migration.

## Running all six modules + the shell together

```
for d in orders-mf shops-mf delivery-mf finance-mf catering-mf settings-mf shell; do
  (cd $d && npm install && npm run build) &
done; wait
for d in orders-mf shops-mf delivery-mf finance-mf catering-mf settings-mf shell; do
  (cd $d && npm run preview &)
done
```

Then open `http://localhost:5100` and click through every nav item — each one loads its
module fresh across the network from that module's own preview server.
