const express = require('express');
const {
  register,
  login,
  getMe,
  updateMe,
  createDeliveryAccount,
  listDeliveryAccounts,
  createShopAccount,
  listShopAccounts,
  resetShopPassword,
  deliveryRegister,
  submitKyc,
  reviewKyc,
  requestOtp,
  verifyOtp,
  shopRegister,
  setupTwoFactor,
  confirmTwoFactor,
  setShopTwoFactorPermission,
  reviewShopAccount,
  verifyTwoFactorLogin,
  resetPasswordWithOtp,
  setPassword,
} = require('../controllers/authController');
const {
  getLedger,
  exportLedgerPdf,
  createLedgerEntry,
  requestTopUp,
  reviewTopUp,
  listPendingTopUps,
} = require('../controllers/ledgerController');
const { protect, protectViaHeaderOrQuery, adminOnly } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/verify-2fa', asyncHandler(verifyTwoFactorLogin));
router.post('/shop-register', asyncHandler(shopRegister));
router.post('/shop-2fa/setup', protect, asyncHandler(setupTwoFactor));
router.post('/shop-2fa/confirm', protect, asyncHandler(confirmTwoFactor));
router.post('/request-otp', asyncHandler(requestOtp));
router.post('/verify-otp', asyncHandler(verifyOtp));
router.post('/reset-password', asyncHandler(resetPasswordWithOtp));
router.get('/me', protect, asyncHandler(getMe));
router.put('/me', protect, asyncHandler(updateMe));
router.put('/me/password', protect, asyncHandler(setPassword));
router.post('/delivery-register', asyncHandler(deliveryRegister));
router.put('/kyc', protect, asyncHandler(submitKyc));
router.get('/ledger', protect, asyncHandler(getLedger));
router.get('/ledger/pdf', protectViaHeaderOrQuery, asyncHandler(exportLedgerPdf));
router.post('/ledger', protect, adminOnly, asyncHandler(createLedgerEntry));
// UPI balance top-up: shop/partner submits payment → admin confirms → balance credited.
router.post('/ledger/topup', protect, asyncHandler(requestTopUp));
router.get('/ledger/topups/pending', protect, adminOnly, asyncHandler(listPendingTopUps));
router.put('/ledger/topups/:id/review', protect, adminOnly, asyncHandler(reviewTopUp));
router.post('/delivery-accounts', protect, adminOnly, asyncHandler(createDeliveryAccount));
router.get('/delivery-accounts', protect, adminOnly, asyncHandler(listDeliveryAccounts));
router.put('/delivery-accounts/:id/kyc-review', protect, adminOnly, asyncHandler(reviewKyc));
router.post('/shop-accounts', protect, adminOnly, asyncHandler(createShopAccount));
router.get('/shop-accounts', protect, adminOnly, asyncHandler(listShopAccounts));
router.put('/shop-accounts/:id/review', protect, adminOnly, asyncHandler(reviewShopAccount));
router.put('/shop-accounts/:id/two-factor', protect, adminOnly, asyncHandler(setShopTwoFactorPermission));
router.put('/shop-accounts/:id/password', protect, adminOnly, asyncHandler(resetShopPassword));

module.exports = router;
