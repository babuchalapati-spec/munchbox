const express = require('express');
const {
  placeOrder,
  placeCourierOrder,
  courierQuote,
  listMyCoupons,
  listMyOrders,
  listAllOrders,
  listAssignedOrders,
  getOrder,
  assignDelivery,
  listDeliveryPartners,
  listAvailableOrders,
  setWorkArea,
  claimOrder,
  updateOrderStatus,
  updateOrderLocation,
  confirmPickup,
  confirmDelivery,
  getOrderEta,
  rateOrder,
  cancelOrder,
} = require('../controllers/orderController');
const { listMessages, sendMessage } = require('../controllers/messageController');
const { protect, adminOnly, deliveryOnly, adminOrShop, requireShopSubscription } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/', protect, asyncHandler(placeOrder));
router.post('/courier', protect, asyncHandler(placeCourierOrder));
router.post('/courier/quote', protect, asyncHandler(courierQuote));
router.get('/coupons', protect, asyncHandler(listMyCoupons));
router.get('/mine', protect, asyncHandler(listMyOrders));
router.get('/assigned', protect, deliveryOnly, asyncHandler(listAssignedOrders));
router.get('/available', protect, deliveryOnly, asyncHandler(listAvailableOrders));
router.put('/work-area', protect, deliveryOnly, asyncHandler(setWorkArea));
router.put('/:id/claim', protect, deliveryOnly, asyncHandler(claimOrder));
router.get('/', protect, adminOrShop, requireShopSubscription, asyncHandler(listAllOrders));
router.get('/delivery-partners', protect, adminOrShop, asyncHandler(listDeliveryPartners));
router.get('/:id', protect, asyncHandler(getOrder));
router.put('/:id/assign', protect, adminOrShop, asyncHandler(assignDelivery));
router.put('/:id/status', protect, asyncHandler(updateOrderStatus));
router.put('/:id/pickup', protect, asyncHandler(confirmPickup));
router.put('/:id/deliver', protect, asyncHandler(confirmDelivery));
router.put('/:id/location', protect, asyncHandler(updateOrderLocation));
router.get('/:id/eta', protect, asyncHandler(getOrderEta));
router.put('/:id/rate', protect, asyncHandler(rateOrder));
router.put('/:id/cancel', protect, asyncHandler(cancelOrder));
router.get('/:id/messages', protect, asyncHandler(listMessages));
router.post('/:id/messages', protect, asyncHandler(sendMessage));

module.exports = router;
