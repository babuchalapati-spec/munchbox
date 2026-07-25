# Munchbox

Cakes, food and catering ordering platform: **four separate Android apps**, an installable
customer web app, an admin dashboard, and one Node/Express + MongoDB backend that serves
all of them.

```
Munchbox/
├── backend/    # Express API; also serves the web apps and the APK downloads
├── pwa/        # Customer web app (installable PWA) — served at /
├── admin/      # Admin dashboard (React + Vite)  — served at /admin
└── mobile/     # React Native app — builds into FOUR APKs (one per role)
```

## The four apps

One React Native codebase, four Android product flavors. Each has its own application id,
so all four install side by side on one phone, and each opens straight into its own role.

| App | Package | APK | Role it signs in |
| --- | --- | --- | --- |
| Munchbox | `com.munchbox.customer` | `Munchbox.apk` | customer |
| Munchbox Partner | `com.munchbox.partner` | `MunchboxPartner.apk` | delivery |
| Munchbox Shop | `com.munchbox.shop` | `MunchboxShop.apk` | shop |
| Munchbox Admin | `com.munchbox.admin` | `MunchboxAdmin.apk` | admin |

The flavor sets a `main_component_name` string resource; `index.js` registers one
component per app and passes an `appType` down, and that is what selects the login screen,
the screen set, and which APK the update check asks for. See
`mobile/android/app/build.gradle` and `mobile/src/appType.js`.

Signing in with the wrong kind of account (a delivery account on the customer app) shows a
"wrong app for this account" screen instead of empty lists.

**Munchbox Admin** is the dashboard in a WebView (`mobile/src/screens/AdminScreen.js`).
That's deliberate: dashboard changes go live on a pull-to-refresh, with no new APK.

### Build the APKs

```powershell
.\build-apks.ps1                 # all four
.\build-apks.ps1 -Only partner   # just one
```

Each APK is copied into `backend/downloads/` under the name above, which is what the
install page links to and what the in-app updater downloads.

Before a release, bump **both**:
- `versionCode` in `mobile/android/app/build.gradle`
- `APP_VERSION_CODE` in `mobile/src/updateCheck.js`

Installed apps compare their own `APP_VERSION_CODE` against what the server advertises, so
if these drift, users are either never offered the update or are offered one forever.

## How the apps find the server on any network

`mobile/src/api/client.js` resolves the backend at every launch, in this order:

1. A manual address set under **Server settings**, if it still answers.
2. Any LAN address used before (probed in parallel, ~2.5s) — fast path on the dev WiFi.
3. `PUBLIC_API_URL` — the always-on Render URL. Not probed, because free hosting sleeps
   when idle and takes up to ~50s to wake; it's the answer whenever nothing local
   responds, so probing it would only delay startup.

That's what lets a downloaded APK work on mobile data, on someone else's WiFi, anywhere,
with nothing to configure. The 60s request timeout exists for the same reason — the first
request of the day may be waiting for the free tier to boot.

## Running it locally

```bash
cd backend && npm install && npm run dev     # http://localhost:5001
cd pwa     && npm install && npm run dev     # http://localhost:5174
cd admin   && npm install && npm run dev     # http://localhost:5173
```

`backend/.env`:

```
PORT=5001
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/CAKE?retryWrites=true&w=majority
JWT_SECRET=change-this-to-a-long-random-string
ADMIN_EMAIL=admin@munchbox.com
ADMIN_PASSWORD=admin123        # CHANGE before going live
ADMIN_PHONE=                   # optional: lets the admin use the dashboard's OTP tab
PUBLIC_BASE_URL=               # optional locally; required on Render (see below)
```

> `backend/.env` is gitignored and is the only place the real connection string belongs.
> The deployed server reads `MONGO_URI` from the Render dashboard instead.

## Staying online in the background (local server + tunnel)

`munchbox-daemon.ps1` is a supervisor that keeps the API and an ngrok tunnel alive
independently of any terminal or editor — close VSCode and it stays up. It also picks up
code changes with no manual step:

- `backend/src/**` → nodemon restarts the API within a second of saving
- `pwa/src/**` → the customer web app is rebuilt into `pwa/dist`
- `admin/src/**` → the dashboard is rebuilt into `admin/dist`, so the Admin APK shows the
  new UI on its next refresh

APKs are **not** rebuilt automatically: an Android release build takes minutes and needs a
version bump to be worth publishing. Run `build-apks.ps1` for that.

```
start-munchbox.bat      # bring it up now (hidden, survives closing VSCode)
stop-munchbox.bat       # take the local server and this project's tunnel down
install-autostart.bat   # run once: also comes back at every login
```

Logs land in `logs/`: `daemon.log`, `server.log`, `ngrok.log`, `build.pwa.log`,
`build.admin.log`, and `tunnel-url.txt` (the tunnel's current public URL).

### About the tunnel URL

The daemon uses a **Cloudflare quick tunnel** (`cloudflared`), and writes the live URL to
`logs/tunnel-url.txt`. It needs no account and no reserved name, and any number of them
can run at once on one machine.

The trade-off is that the URL is **random and changes every time the tunnel restarts**.
That's fine, because the tunnel is not what installed apps rely on — they use the Render
URL. The tunnel is for testing an unreleased local change from a phone that isn't on this
WiFi: enter the current URL once under **Server settings** and the app remembers it.

**Why not ngrok?** It's wired up (`$TunnelProvider = 'ngrok'` in `munchbox-daemon.ps1`)
but unusable on this account as things stand:

- The installed agent was 3.3.1 and the account requires 3.20.0+, so it was rejected with
  `ERR_NGROK_121`. `tools/ngrok.exe` in this repo is 3.39.9, which fixes that.
- More fundamentally, a free account has exactly **one** reserved domain and every
  endpoint it starts claims that same one. Another project's tunnel already holds it, so
  a second concurrent tunnel fails with `ERR_NGROK_334: endpoint is already online`
  instead of falling back to a random address.

To use ngrok anyway, you need a reserved domain of your own (second free account, or a
paid plan). Then set `$TunnelProvider = 'ngrok'` and `$TunnelUrl` in the daemon, and
`TUNNEL_API_URL` in `mobile/src/api/client.js` to the same value.

Either way, keep the in-app update check infrequent — it polls every 6 hours on purpose.
At the 60s interval it used to use, a single phone would spend ~43k requests a month.

## Deploying the backend to Render (the always-on URL)

`render.yaml` describes the service. It installs the backend, then builds **both** web apps
so one URL serves everything:

| Path | What |
| --- | --- |
| `/` | customer web app |
| `/admin` | admin dashboard (also what the Admin APK loads) |
| `/download` | install page for all four APKs |
| `/downloads/*.apk` | the APK files |
| `/api/*` | the API |

First deploy:

1. Push to GitHub, then in Render: **New → Blueprint**, point it at this repo.
2. Set the environment variables from the list above. **`PUBLIC_BASE_URL` must be the
   service's own URL** (`https://munchbox-backend.onrender.com`) — it's what
   `/api/app/version` puts in the APK download links, so without it phones are handed a
   link built from whatever `Host` header the request arrived with.
3. Allow Render's outbound IPs in MongoDB Atlas (Network Access), or the server starts and
   immediately fails to connect.
4. Upload the four APKs once from **Admin → Settings → Publish APK** — `backend/downloads`
   is gitignored, so the deploy doesn't carry them.

If `PUBLIC_API_URL` in `mobile/src/api/client.js` doesn't match the service's real URL,
change it there and rebuild the APKs.

> Render's free tier stops the service when it's idle. The first request after that waits
> for it to boot, which is what the long client timeout above is for.

## Notes

- Uploads go to `backend/uploads/` on disk. Render's filesystem is ephemeral — for
  production, move uploads to object storage or they vanish on redeploy.
- SMS is DLT-compliant Fast2SMS; configure it in **Admin → Settings**.
- Razorpay wallet top-ups and live bike tracking are configured in the dashboard too.
