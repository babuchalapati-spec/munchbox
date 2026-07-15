const express = require('express');
const {
  createRazorpayPaymentOrder,
  reportPaymentFailure,
  listPaymentFailures,
  resolvePaymentFailure,
  listPendingUpiPayments,
  reviewUpiPayment,
} = require('../controllers/orderController');
const { protect, adminOnly, adminOrShop } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/razorpay/order', protect, asyncHandler(createRazorpayPaymentOrder));
router.post('/razorpay/failed', protect, asyncHandler(reportPaymentFailure));
router.get('/failures', protect, adminOnly, asyncHandler(listPaymentFailures));
router.put('/failures/:id/resolve', protect, adminOnly, asyncHandler(resolvePaymentFailure));
router.get('/upi/pending', protect, adminOrShop, asyncHandler(listPendingUpiPayments));
router.put('/upi/:id/review', protect, adminOrShop, asyncHandler(reviewUpiPayment));

module.exports = router;
