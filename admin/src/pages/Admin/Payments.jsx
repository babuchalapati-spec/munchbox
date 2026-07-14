import { useEffect, useState } from 'react';
import { listPendingTopUps, reviewTopUp } from '../../api/ledger';
import { getSettings, updateSettings } from '../../api/settings';

export default function Payments() {
  const [pending, setPending] = useState([]);
  const [upi, setUpi] = useState({ upiId: '', payeeName: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [savingUpi, setSavingUpi] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const [entries, settings] = await Promise.all([listPendingTopUps(), getSettings()]);
      setPending(entries);
      setUpi({
        upiId: settings.payments?.upiId || '',
        payeeName: settings.payments?.payeeName || 'Munchbox',
        phone: settings.payments?.phone || '',
      });
    } catch (err) {
      setError('Could not load payments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function saveUpi(e) {
    e.preventDefault();
    setSavingUpi(true);
    setMsg('');
    setError('');
    try {
      await updateSettings({ payments: upi });
      setMsg('UPI details saved. Shops will pay into this ID.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save UPI details');
    } finally {
      setSavingUpi(false);
    }
  }

  async function decide(id, action) {
    if (action === 'confirm' && !window.confirm('Confirm you received this money? The balance will be credited.')) return;
    setBusyId(id);
    setError('');
    try {
      await reviewTopUp(id, action);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading payments...</p>;

  return (
    <div>
      <h1>Payments & deposits</h1>
      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      {msg && <p style={{ color: '#2e7d32' }}>{msg}</p>}

      <h2 style={{ marginTop: 16 }}>Your UPI ID (where shops send money)</h2>
      <form onSubmit={saveUpi} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 24 }}>
        <label>
          UPI ID
          <input
            value={upi.upiId}
            onChange={(e) => setUpi((s) => ({ ...s, upiId: e.target.value }))}
            placeholder="munchbox@okhdfcbank"
          />
        </label>
        <label>
          Payee name
          <input value={upi.payeeName} onChange={(e) => setUpi((s) => ({ ...s, payeeName: e.target.value }))} />
        </label>
        <label>
          Contact phone
          <input value={upi.phone} onChange={(e) => setUpi((s) => ({ ...s, phone: e.target.value }))} />
        </label>
        <button type="submit" disabled={savingUpi}>{savingUpi ? 'Saving...' : 'Save UPI'}</button>
      </form>

      <h2>Pending payments to confirm ({pending.length})</h2>
      <p style={{ color: '#776b63' }}>
        A shop/partner paid by UPI and submitted the reference. Check the money arrived, then confirm — the balance is
        credited only after you confirm.
      </p>

      {pending.length === 0 ? (
        <p style={{ color: '#2e7d32', fontWeight: 600 }}>✅ No payments waiting.</p>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e6e0da' }}>
              <th>Who</th>
              <th>Role</th>
              <th>Amount</th>
              <th>UPI reference</th>
              <th>Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((e) => (
              <tr key={e._id} style={{ borderBottom: '1px solid #e6e0da' }}>
                <td>
                  <strong>{e.owner?.name || '—'}</strong>
                  <div style={{ color: '#776b63', fontSize: '0.8rem' }}>{e.owner?.email || e.owner?.phone}</div>
                </td>
                <td>{e.ownerRole}</td>
                <td style={{ fontWeight: 700, color: '#2e7d32' }}>₹{e.amount}</td>
                <td>{e.metadata?.reference || '—'}</td>
                <td style={{ color: '#776b63', fontSize: '0.85rem' }}>
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => decide(e._id, 'confirm')}
                    disabled={busyId === e._id}
                    style={{ background: '#2e7d32', color: '#fff', marginRight: 6 }}
                  >
                    Confirm & credit
                  </button>
                  <button
                    onClick={() => decide(e._id, 'reject')}
                    disabled={busyId === e._id}
                    style={{ background: '#c62828', color: '#fff' }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
