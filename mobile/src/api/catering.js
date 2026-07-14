import client from './client';

export async function createCateringRequest(payload) {
  const { data } = await client.post('/catering', payload);
  return data.request;
}

export async function listMyCateringRequests() {
  const { data } = await client.get('/catering/mine');
  return data.requests;
}

export async function respondToCateringQuote(id, accept) {
  const { data } = await client.put(`/catering/${id}/respond`, { accept });
  return data.request;
}
