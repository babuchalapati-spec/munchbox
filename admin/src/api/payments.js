import client from './client';

export async function listPaymentFailures() {
  const { data } = await client.get('/payments/failures');
  return data.failures;
}

export async function resolvePaymentFailure(id) {
  const { data } = await client.put(`/payments/failures/${id}/resolve`);
  return data.failure;
}

export async function listPendingUpiPayments() {
  const { data } = await client.get('/payments/upi/pending');
  return data.orders;
}

export async function reviewUpiPayment(orderId, action) {
  const { data } = await client.put(`/payments/upi/${orderId}/review`, { action });
  return data.order;
}
