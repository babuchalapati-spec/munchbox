const express = require('express');
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  blockProduct,
  listPendingProducts,
  reviewProduct,
} = require('../controllers/productController');
const { protect, optionalAuth, adminOnly, adminOrShop, requireShopSubscription } = require('../middleware/auth');
const upload = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// optionalAuth: customers see every item that isn't blocked; shop owners also see their own blocked ones.
router.get('/', optionalAuth, asyncHandler(listProducts));
router.get('/pending', protect, adminOnly, asyncHandler(listPendingProducts));
router.put('/:id/block', protect, adminOnly, asyncHandler(blockProduct));
router.put('/:id/review', protect, adminOnly, asyncHandler(reviewProduct));
router.get('/:id', asyncHandler(getProduct));
// Only a shop owner adds items — enforced in the controller, which scopes it to their own shop.
router.post('/', protect, adminOrShop, requireShopSubscription, upload.single('image'), asyncHandler(createProduct));
router.put('/:id', protect, adminOrShop, requireShopSubscription, upload.single('image'), asyncHandler(updateProduct));
router.delete('/:id', protect, adminOrShop, requireShopSubscription, asyncHandler(deleteProduct));

module.exports = router;
