import client from './client';

export async function listPaymentFailures() {
  const { data } = await client.get('/payments/failures');
  return data.failures;
}

export async function resolvePaymentFailure(id) {
  const { data } = await client.put(`/payments/failures/${id}/resolve`);
  return data.failure;
}
