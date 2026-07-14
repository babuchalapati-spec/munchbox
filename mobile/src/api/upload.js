import client from './client';

function normalizeUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith('content://') || uri.startsWith('file://')) return uri;
  return `file://${uri}`;
}

// Uploads a picked image (from react-native-image-picker asset) and returns its URL.
export async function uploadImage(asset) {
  const form = new FormData();
  const fileName = asset.fileName || asset.uri?.split('/').pop() || `photo-${Date.now()}.jpg`;
  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = asset.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg');

  form.append('image', {
    uri: normalizeUri(asset.uri),
    name: fileName,
    type: mimeType,
  });

  const { data } = await client.post('/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data.url;
}
