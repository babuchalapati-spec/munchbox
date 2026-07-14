import client from './client';

export async function listShops() {
  const { data } = await client.get('/shops');
  return data.shops;
}

export async function createShop(payload) {
  const { data } = await client.post('/shops', payload);
  return data.shop;
}

export async function updateShop(id, payload) {
  const { data } = await client.put(`/shops/${id}`, payload);
  return data.shop;
}

export async function deleteShop(id) {
  await client.delete(`/shops/${id}`);
}

export async function updateSubscription(id, payload) {
  const { data } = await client.put(`/shops/${id}/subscription`, payload);
  return data.shop;
}

// Shop-owner accounts (self-registered) awaiting login approval.
export async function listShopAccounts() {
  const { data } = await client.get('/auth/shop-accounts');
  return data.users;
}

export async function reviewShopAccount(id, action, extra = {}) {
  const { data } = await client.put(`/auth/shop-accounts/${id}/review`, { action, ...extra });
  return data;
}

// Grants or revokes a shop's permission to use two-factor login — 2FA is opt-in per
// shop, not a blanket requirement, so this is the admin's on/off switch for it.
export async function setShopTwoFactor(id, allowed) {
  const { data } = await client.put(`/auth/shop-accounts/${id}/two-factor`, { allowed });
  return data.user;
}

// Admin sets a new password for a shop owner who's forgotten theirs.
export async function resetShopPassword(id, password) {
  const { data } = await client.put(`/auth/shop-accounts/${id}/password`, { password });
  return data;
}
