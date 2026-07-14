import client from './client';

export async function listProducts() {
  const { data } = await client.get('/products');
  return data.products;
}

export async function listPendingProducts() {
  const { data } = await client.get('/products/pending');
  return data.products;
}

export async function reviewProduct(id, action, reason) {
  const { data } = await client.put(`/products/${id}/review`, {
    action,
    reason,
  });
  return data.product;
}

export async function createProduct(formData) {
  const { data } = await client.post('/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.product;
}

export async function updateProduct(id, formData) {
  const { data } = await client.put(`/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.product;
}

export async function deleteProduct(id) {
  await client.delete(`/products/${id}`);
}

// Admin safety valve: hide a shop's item from customers (or put it back). Items are never
// approved by the admin — a shop's item is live from the moment the shop adds it.
export async function setProductBlocked(id, blocked, reason) {
  const { data } = await client.put(`/products/${id}/block`, {
    action: blocked ? 'block' : 'unblock',
    reason,
  });
  return data.product;
}
