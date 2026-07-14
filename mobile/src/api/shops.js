import client from './client';

export async function listShops() {
  const { data } = await client.get('/shops');
  return data.shops;
}

export async function getShop(id) {
  const { data } = await client.get(`/shops/${id}`);
  return data.shop;
}

export async function deliveryQuote(shopId, lat, lng) {
  const { data } = await client.post(`/shops/${shopId}/delivery-quote`, { lat, lng });
  return data; // { distanceKm, deliveryFee, perKmRate }
}
