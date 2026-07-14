const express = require('express');
const {
  createRazorpayPaymentOrder,
  reportPaymentFailure,
  listPaymentFailures,
  resolvePaymentFailure,
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/razorpay/order', protect, asyncHandler(createRazorpayPaymentOrder));
router.post('/razorpay/failed', protect, asyncHandler(reportPaymentFailure));
router.get('/failures', protect, adminOnly, asyncHandler(listPaymentFailures));
router.put('/failures/:id/resolve', protect, adminOnly, asyncHandler(resolvePaymentFailure));

module.exports = router;
