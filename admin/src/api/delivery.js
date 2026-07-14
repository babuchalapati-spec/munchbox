import client from './client';

export async function listDeliveryAccounts() {
  const { data } = await client.get('/auth/delivery-accounts');
  return data.users;
}

export async function createDeliveryAccount(payload) {
  const { data } = await client.post('/auth/delivery-accounts', payload);
  return data.user;
}

export async function reviewKyc(id, action, reason) {
  const { data } = await client.put(`/auth/delivery-accounts/${id}/kyc-review`, { action, reason });
  return data.user;
}
