# finance-service

Owns money movement: the ledger (every credit/debit for shops and delivery partners),
expenses, failed-payment records, and shop billing state (subscription, deposit,
agreement). The one service where correctness matters more than speed — migrate this
carefully, with reconciliation tests comparing pre/post-migration wallet balances
exactly (ARCHITECTURE.md §6, Phase 5).

## Owns

- `LedgerEntry` — every credit/debit; wallet balance is always *derived* by summing these,
  never stored directly
- `Expense`
- `PaymentFailure`
- `ShopBilling` *(new — see ARCHITECTURE.md §4)*: what's currently
  `Shop.subscription` / `Shop.deposit` / `Shop.agreement`

## Depends on

- `identity-service` — resolve which user/shop a ledger entry belongs to
- `payment-service` — receives confirmed Razorpay/UPI payments to post as ledger credits

## Migrated from (monolith source)

`backend/src/controllers/ledgerController.js`, `backend/src/controllers/financeController.js`,
`backend/src/models/LedgerEntry.js`, `backend/src/models/Expense.js`,
`backend/src/models/PaymentFailure.js`, plus the ledger endpoints currently living
(misplaced) inside `backend/src/routes/authRoutes.js`, and `Shop.subscription` /
`deposit` / `agreement` handling from `shopController.js`'s `updateSubscription` and
`signAgreement`.

## API contract (target)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/finance/ledger?ownerId=` | Ledger entries + running balance | JWT |
| GET | `/finance/ledger/pdf` | Statement PDF | JWT |
| POST | `/finance/ledger/topup` | Submit a UPI top-up reference | JWT |
| PUT | `/finance/ledger/topups/:id/review` | Admin confirms/rejects a top-up | JWT (admin) |
| GET | `/finance/overview` | Revenue-by-area, P&L | JWT (admin) |
| POST | `/finance/expenses` | Record an expense | JWT (admin) |
| PUT | `/finance/shops/:id/subscription` | Admin activates/extends a shop | JWT (admin) |
| PUT | `/finance/shops/:id/agreement/sign` | Shop owner signs onboarding agreement | JWT (shop) |

Events consumed: `order.delivered` (post platform commission), `payment.confirmed`
(post a ledger credit). Events published: `shop.billing.changed` (catalog-service
recomputes `isLiveToCustomers`).

## Not yet implemented

Bootable skeleton only (`GET /health`) — see ARCHITECTURE.md §6, Phase 5.
