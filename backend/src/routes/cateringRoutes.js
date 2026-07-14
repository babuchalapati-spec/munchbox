const express = require('express');
const {
  createRequest,
  listMyRequests,
  listAllRequests,
  quoteRequest,
  respondToQuote,
} = require('../controllers/cateringController');
const { protect, adminOrShop, requireShopSubscription } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/', protect, asyncHandler(createRequest));
router.get('/mine', protect, asyncHandler(listMyRequests));
router.get('/', protect, adminOrShop, requireShopSubscription, asyncHandler(listAllRequests));
router.put('/:id/quote', protect, adminOrShop, requireShopSubscription, asyncHandler(quoteRequest));
router.put('/:id/respond', protect, asyncHandler(respondToQuote));

module.exports = router;
