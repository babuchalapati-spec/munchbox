# notification-service

A thin integration layer for outbound SMS (and, eventually, push notifications). Owns no
persistent data. Exists as its own service so a provider swap — like the Fast2SMS/DLT
delivery problems this project has already hit in production — is a one-service change
instead of a scattered find-and-replace through identity-service.

## Owns

Nothing persistent. Wraps `backend/src/utils/sms.js`.

## Depends on

Nothing — this is a leaf service, called by others, never calls out except to the SMS
provider.

## Migrated from (monolith source)

`backend/src/utils/sms.js` and the inline OTP-sending calls currently inside
`authController.js`'s `requestOtp`.

## API contract (target)

This service is called internally by other services, not exposed to client apps directly.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/notifications/sms` | Send an SMS (`{to, message}`) | service-to-service token |

Events consumed: `otp.requested` (identity-service), `order.status.changed`
(order-service, future customer SMS updates).

## Not yet implemented

Bootable skeleton only (`GET /health`) — recommended second split alongside
media-service (ARCHITECTURE.md §6, Phase 3), since both are stateless and low-risk.
