# identity-service

Owns who a user is and whether they're allowed to log in. Every other service trusts a
JWT the gateway has already verified against this service's secret — no other service
should re-implement login/password logic.

## Owns

- `User` (all four roles: customer, delivery, shop, admin)
- `Otp` (OTP codes for phone verification)

## Depends on

- `notification-service` — to actually deliver an OTP SMS

## Migrated from (monolith source)

`backend/src/controllers/authController.js`, `backend/src/models/User.js`,
`backend/src/models/Otp.js`, `backend/src/utils/twoFactor.js`.

**Not migrated here — stays out of identity's scope on purpose:** the ledger/wallet
endpoints and shop/delivery *account-approval* endpoints currently living in
`authRoutes.js` belong to finance-service and a shared admin-approval concern
respectively (see ARCHITECTURE.md §2 — this file file mixing concerns is exactly the
kind of boundary violation the split is meant to fix, not preserve).

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/identity/register` | Customer email/password signup | public |
| POST | `/identity/login` | Email/password login (any role) | public |
| POST | `/identity/request-otp` | Send OTP to a phone number | public |
| POST | `/identity/verify-otp` | Verify OTP, issue JWT | public |
| POST | `/identity/shop-register` | Shop owner self-registration (pending approval) | public |
| POST | `/identity/delivery-register` | Delivery partner self-registration | public |
| GET | `/identity/me` | Current user profile | JWT |
| PUT | `/identity/me` | Update own profile | JWT |
| PUT | `/identity/kyc` | Delivery partner submits/updates KYC docs | JWT (delivery) |
| POST | `/identity/verify-2fa` | Complete a 2FA-gated login | ticket |

Events published (to notification-service and any other subscriber):
`user.registered`, `otp.requested`, `kyc.submitted`.

## Not yet implemented

This is a bootable skeleton (`GET /health` only) — route handlers should be ported from
`authController.js` incrementally, in the order described in ARCHITECTURE.md §6.
