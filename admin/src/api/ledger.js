import client from './client';

export async function listLedger(params = {}) {
  const { data } = await client.get('/auth/ledger', { params });
  return data;
}

export async function createLedgerEntry(payload) {
  const { data } = await client.post('/auth/ledger', payload);
  return data.entry;
}

// UPI top-ups shops/partners submitted, awaiting the admin's confirmation.
export async function listPendingTopUps() {
  const { data } = await client.get('/auth/ledger/topups/pending');
  return data.entries;
}

export async function reviewTopUp(id, action) {
  const { data } = await client.put(`/auth/ledger/topups/${id}/review`, { action });
  return data;
}

// Downloads the PDF statement and opens it in a new tab (browser's own PDF viewer
// handles printing/saving from there).
export async function openLedgerPdf(ownerId) {
  const { data } = await client.get('/auth/ledger/pdf', {
    params: ownerId ? { ownerId } : {},
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  window.open(url, '_blank');
}
