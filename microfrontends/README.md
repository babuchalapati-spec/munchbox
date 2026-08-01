# Munchbox micro-frontends (target architecture, scaffolded)

Read [`ARCHITECTURE.md`](../ARCHITECTURE.md) §7 first. This folder scaffolds the
**admin/shop dashboard** as a shell + independently-deployable modules using
[Vite Module Federation](https://github.com/originjs/vite-plugin-federation).

**The four React Native mobile apps are explicitly out of scope** — see ARCHITECTURE.md
§7 for why. `pwa/` (the customer web app) would follow the same pattern with its own
shell later; not scaffolded in this pass.

**Nothing in here replaces `admin/` yet.** The existing admin/shop dashboard keeps
running unchanged. This is where migration work lands once the pattern below is proven
and the team decides to invest in it.

## What's fully wired vs. stubbed

| Module | Status | Port |
|---|---|---|
| [shell](shell/) | ✅ Working host app | 5100 |
| [orders-mf](orders-mf/) | ✅ Working remote, exposes `OrdersApp` | 5101 |
| [shops-mf](shops-mf/) | 📄 README stub only | 5102 (reserved) |
| [delivery-mf](delivery-mf/) | 📄 README stub only | 5103 (reserved) |
| [finance-mf](finance-mf/) | 📄 README stub only | 5104 (reserved) |
| [catering-mf](catering-mf/) | 📄 README stub only | 5105 (reserved) |
| [settings-mf](settings-mf/) | 📄 README stub only | 5106 (reserved) |

`shell` + `orders-mf` are real, buildable Vite apps — verified in this pass with
`npm install && vite build` in each, then `vite preview` serving both and confirming the
shell's HTML and orders-mf's `remoteEntry.js` are both reachable. That's the proof this
pattern works end to end; the remaining five modules are documented stubs following the
exact same recipe (see "Building a new module" below).

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

## Building a new module (e.g. shops-mf)

1. Copy `orders-mf`'s structure: `package.json`, `vite.config.js`, `src/App.jsx`,
   `src/main.jsx`, `index.html`. Rename the federation `name`/`exposes` key.
2. Add one line to `shell/vite.config.js`'s `remotes` map and one `<Route>` +
   `lazy(() => import('shops_mf/ShopsApp'))` in `shell/src/App.jsx`.
3. Point it at the gateway (`VITE_GATEWAY_URL`) the same way `orders-mf` does — never at
   a specific microservice directly, so the gateway's monolith-fallback keeps working
   during migration.
