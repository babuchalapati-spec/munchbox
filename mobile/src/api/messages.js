import client from './client';

export async function listMessages(orderId, channel = 'customer') {
  const { data } = await client.get(`/orders/${orderId}/messages`, { params: { channel } });
  return data.messages;
}

export async function sendMessage(orderId, text, channel = 'customer') {
  const { data } = await client.post(`/orders/${orderId}/messages`, { text, channel });
  return data.chatMessage;
}
