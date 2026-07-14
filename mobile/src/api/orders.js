import client from './client';

export async function placeOrder(payload) {
  const {data} = await client.post('/orders', payload);
  return data.order;
}

// Creates a Razorpay order for the same checkout details/amount the customer is about
// to place — priced server-side so the amount can't be tampered with from the app.
export async function createRazorpayOrder(payload) {
  const {data} = await client.post('/payments/razorpay/order', payload);
  return data; // { razorpayOrderId, amount, currency, keyId, totalAmount }
}

// Tells the backend a Razorpay checkout attempt failed/was cancelled, so the admin
// can see it under Payments instead of it disappearing silently.
export async function reportPaymentFailure(payload) {
  const {data} = await client.post('/payments/razorpay/failed', payload);
  return data.failure;
}

export async function listMyCoupons() {
  const {data} = await client.get('/orders/coupons');
  return data.coupons;
}

export async function courierQuote(pickupLocation, deliveryLocation) {
  const {data} = await client.post('/orders/courier/quote', {
    pickupLocation,
    deliveryLocation,
  });
  return data; // { distanceKm, deliveryFee, perKmRate }
}

export async function placeCourierOrder(payload) {
  const {data} = await client.post('/orders/courier', payload);
  return data.order;
}

export async function listMyOrders() {
  const {data} = await client.get('/orders/mine');
  return data.orders;
}

// Admin/shop: all orders (a shop owner only sees their own shop's orders — enforced
// server-side).
export async function listOrders(params) {
  const {data} = await client.get('/orders', {params});
  return data.orders;
}

export async function getOrder(id) {
  const {data} = await client.get(`/orders/${id}`);
  return data.order;
}

export async function cancelOrder(id) {
  const {data} = await client.put(`/orders/${id}/cancel`);
  return data.order;
}

export async function listAssignedOrders() {
  const {data} = await client.get('/orders/assigned');
  return data.orders;
}

export async function listAvailableOrders(lat, lng) {
  const {data} = await client.get('/orders/available', {params: {lat, lng}});
  return data.available;
}

export async function claimOrder(id) {
  const {data} = await client.put(`/orders/${id}/claim`);
  return data.order;
}

export async function updateOrderStatus(id, status) {
  const {data} = await client.put(`/orders/${id}/status`, {status});
  return data.order;
}

export async function confirmPickup(id, code) {
  const {data} = await client.put(`/orders/${id}/pickup`, {code});
  return data.order;
}

export async function confirmDelivery(id, code) {
  const {data} = await client.put(`/orders/${id}/deliver`, {code});
  return data.order;
}

// Shop/admin: list delivery partners to assign, and assign one to an order.
export async function listDeliveryPartners() {
  const {data} = await client.get('/orders/delivery-partners');
  return data.partners;
}

export async function assignDelivery(id, deliveryUserId) {
  const {data} = await client.put(`/orders/${id}/assign`, {deliveryUserId});
  return data.order;
}

export async function updateOrderLocation(id, lat, lng) {
  const {data} = await client.put(`/orders/${id}/location`, {lat, lng});
  return data.order;
}

// { eta: { distanceKm, etaMinutes, estimated } | null }
export async function getOrderEta(id) {
  const {data} = await client.get(`/orders/${id}/eta`);
  return data.eta;
}

export async function rateOrder(id, payload) {
  const {data} = await client.put(`/orders/${id}/rate`, payload);
  return data.order;
}
