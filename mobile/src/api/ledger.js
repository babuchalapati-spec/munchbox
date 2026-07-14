import client, {API_URL} from './client';

export async function listLedger(params = {}) {
  const { data } = await client.get('/auth/ledger', { params });
  return data; // { entries, balance, pendingTopUps }
}

// URL for the PDF statement — opened via Linking, not fetched here, so the phone's
// own PDF viewer handles printing/sharing/saving. Needs the token as a query param
// since Linking.openURL can't attach an Authorization header.
export function getLedgerPdfUrl(token) {
  return `${API_URL}/auth/ledger/pdf?token=${encodeURIComponent(token)}`;
}

// Where to send the UPI payment (admin's UPI id / contact).
export async function getPaymentInfo() {
  const { data } = await client.get('/settings/payment-info');
  return data.payments; // { upiId, payeeName, phone, note }
}

// Tell the admin you paid by UPI. Creates a pending credit until the admin confirms.
export async function requestTopUp(amount, reference) {
  const { data } = await client.post('/auth/ledger/topup', { amount, reference });
  return data;
}
