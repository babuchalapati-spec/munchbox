# settings-mf (stub — not yet scaffolded as a running app)

Would expose `SettingsApp`: the Settings screen currently in
`admin/src/pages/Admin/Settings.jsx` (app version/APK publish, SMS + Razorpay
credentials, shop agreement template). Talks to `admin-config-service` via the gateway.
Admin-only, lowest-traffic module — safe place to try a shell upgrade or a new build
tool version first.

Reserved dev port: **5106**. Build using `orders-mf` as the template — see
`../README.md`'s "Building a new module" section.
