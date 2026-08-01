# admin-config-service

Owns platform-wide configuration that changes far less often than everything else:
published app versions/APKs, SMS + Razorpay credentials, the shop onboarding agreement
template, and the platform tax rate. Kept separate so a config change never requires
redeploying order-service or any other high-traffic service.

## Owns

- `Settings` (the existing singleton document: `app`/`partnerApp`/`shopApp`/`adminApp`
  version info, `sms`, `razorpay`, `shopAgreement`, `finance.taxPercent`, `maps`)

## Depends on

- `media-service` — APK file storage for `POST /config/publish-apk`

## Migrated from (monolith source)

`backend/src/controllers/settingsController.js`, `backend/src/models/Settings.js`.

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/config` | Full settings (admin) | JWT (admin) |
| PUT | `/config` | Update settings | JWT (admin) |
| POST | `/config/publish-apk` | Publish a new app build | JWT (admin) |
| GET | `/config/app/version?type=` | Public version-check endpoint every app polls | public |
| GET | `/config/payment-info` | Public UPI payment details for checkout | public |

## Not yet implemented

Bootable skeleton only (`GET /health`).
