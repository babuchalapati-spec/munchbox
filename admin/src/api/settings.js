import client from './client';

export async function getSettings() {
  const { data } = await client.get('/settings');
  return data.settings;
}

export async function updateSettings(payload) {
  const { data } = await client.put('/settings', payload);
  return data.settings;
}

export async function publishApk(formData) {
  const { data } = await client.post('/settings/publish-apk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function testSms(payload) {
  const { data } = await client.post('/settings/test-sms', payload);
  return data;
}
