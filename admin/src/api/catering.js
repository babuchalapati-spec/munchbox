import client from './client';

export async function listCateringRequests(status) {
  const { data } = await client.get('/catering', { params: status ? { status } : {} });
  return data.requests;
}

export async function quoteCateringRequest(id, payload) {
  const { data } = await client.put(`/catering/${id}/quote`, payload);
  return data.request;
}
