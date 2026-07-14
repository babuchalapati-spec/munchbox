import client from './client';

export async function listOrders(status) {
  const { data } = await client.get('/orders', { params: status ? { status } : {} });
  return data.orders;
}

export async function getOrder(id) {
  const { data } = await client.get(`/orders/${id}`);
  return data.order;
}

export async function updateOrderStatus(id, status) {
  const { data } = await client.put(`/orders/${id}/status`, { status });
  return data.order;
}

export async function updateOrderLocation(id, lat, lng) {
  const { data } = await client.put(`/orders/${id}/location`, { lat, lng });
  return data.order;
}

// Delivery partners available to assign to an order — accessible to admin AND shop
// (unlike /auth/delivery-accounts, which is admin-only).
export async function listDeliveryPartners() {
  const { data } = await client.get('/orders/delivery-partners');
  return data.partners;
}

export async function assignDelivery(id, deliveryUserId) {
  const { data } = await client.put(`/orders/${id}/assign`, { deliveryUserId });
  return data.order;
}

// { eta: { distanceKm, etaMinutes, estimated } | null }
export async function getOrderEta(id) {
  const { data } = await client.get(`/orders/${id}/eta`);
  return data.eta;
}
