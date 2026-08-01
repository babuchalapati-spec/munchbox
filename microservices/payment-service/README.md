# payment-service

A thin integration layer over Razorpay (and any future gateway). Owns no persistent
data of its own — every confirmed payment gets posted to finance-service as a ledger
entry. Isolating this means a gateway credential rotation, provider swap, or webhook
signature change touches exactly one service.

## Owns

Nothing persistent. Wraps `backend/src/utils/razorpay.js`.

## Depends on

- `finance-service` — post confirmed payments as ledger credits, look up failed payments

## Migrated from (monolith source)

`backend/src/routes/paymentRoutes.js`, the Razorpay portions of
`backend/src/controllers/orderController.js` (`createRazorpayPaymentOrder`,
`reportPaymentFailure`), `backend/src/utils/razorpay.js`.

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/payments/razorpay/order` | Create a Razorpay order for checkout | JWT |
| POST | `/payments/razorpay/failed` | Client reports a failed payment attempt | JWT |
| GET | `/payments/failures` | Admin view of failed payments | JWT (admin) |
| PUT | `/payments/failures/:id/resolve` | Mark a failure resolved | JWT (admin) |
| GET | `/payments/upi/pending` | UPI payments awaiting confirmation | JWT (admin) |
| PUT | `/payments/upi/:id/review` | Confirm/reject a UPI payment | JWT (admin) |

Events published: `payment.confirmed`, `payment.failed`.

## Not yet implemented

Bootable skeleton only (`GET /health`).
