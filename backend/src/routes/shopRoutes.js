const express = require('express');
const {
  listShops,
  getShop,
  createShop,
  updateShop,
  deleteShop,
  deliveryQuote,
  updateSubscription,
} = require('../controllers/shopController');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/', optionalAuth, asyncHandler(listShops));
router.get('/:id', asyncHandler(getShop));
router.post('/', protect, adminOnly, upload.single('image'), asyncHandler(createShop));
router.put('/:id', protect, adminOnly, upload.single('image'), asyncHandler(updateShop));
router.put('/:id/subscription', protect, adminOnly, asyncHandler(updateSubscription));
router.delete('/:id', protect, adminOnly, asyncHandler(deleteShop));
router.post('/:id/delivery-quote', protect, asyncHandler(deliveryQuote));

module.exports = router;
