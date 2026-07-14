import client from './client';

export async function listProducts(shopId) {
  const { data } = await client.get('/products', { params: shopId ? { shop: shopId } : {} });
  return data.products;
}

export async function getProduct(id) {
  const { data } = await client.get(`/products/${id}`);
  return data.product;
}

// Shop owner: add an item to their own shop (shop is derived from the logged-in owner).
export async function createProduct(payload) {
  const { data } = await client.post('/products', payload);
  return data.product;
}

export async function updateProduct(id, payload) {
  const { data } = await client.put(`/products/${id}`, payload);
  return data.product;
}

export async function deleteProduct(id) {
  await client.delete(`/products/${id}`);
}
