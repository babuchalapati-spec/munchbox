import { useEffect, useState } from 'react';
import { listPendingTopUps, reviewTopUp } from '../../api/ledger';
import { getSettings, updateSettings } from '../../api/settings';
import { listPaymentFailures, resolvePaymentFailure } from '../../api/payments';
import { listOrders } from '../../api/orders';

export default function Payments() {
  const [pending, setPending] = useState([]);
  const [upi, setUpi] = useState({ upiId: '', payeeName: '', phone: '' });
  const [failures, setFailures] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [savingUpi, setSavingUpi] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const [entries, settings, failedPayments, orders] = await Promise.all([
        listPendingTopUps(),
        getSettings(),
        listPaymentFailures(),
        listOrders(),
      ]);
      setPending(entries);
      setUpi({
        upiId: settings.payments?.upiId || '',
        payeeName: settings.payments?.payeeName || 'Munchbox',
        phone: settings.payments?.phone || '',
      });
      setFailures(failedPayments);
      setRecentOrders(orders.filter((o) => o.payment?.method === 'online').slice(0, 20));
    } catch (err) {
      setError('Could not load payments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function resolveFailure(id) {
    setBusyId(id);
    try {
      await resolvePaymentFailure(id);
      setFailures((prev) => prev.filter((f) => f._id !== id));
    } catch (err) {
      setError('Could not update this failed payment');
    } finally {
      setBusyId(null);
    }
  }

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

      {failures.length > 0 && (
        <div style={{ background: '#fdecea', border: '1px solid #c62828', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, color: '#c62828' }}>⚠️ {failures.length} customer payment{failures.length > 1 ? 's' : ''} failed</h2>
          <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #f3c6c2' }}>
                <th>Customer</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>When</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f._id} style={{ borderBottom: '1px solid #f3c6c2' }}>
                  <td>
                    <strong>{f.user?.name || '—'}</strong>
                    <div style={{ color: '#776b63', fontSize: '0.8rem' }}>{f.user?.phone || f.user?.email}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>₹{f.amount}</td>
                  <td>{f.reason || '—'}</td>
                  <td style={{ color: '#776b63', fontSize: '0.85rem' }}>{new Date(f.createdAt).toLocaleString()}</td>
                  <td>
                    <button onClick={() => resolveFailure(f._id)} disabled={busyId === f._id}>
                      Mark resolved
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 16 }}>Recent online payments (customers)</h2>
      {recentOrders.length === 0 ? (
        <p style={{ color: '#776b63' }}>No online payments yet.</p>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e6e0da' }}>
              <th>Customer</th>
              <th>Shop</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o._id} style={{ borderBottom: '1px solid #e6e0da' }}>
                <td>{o.user?.name || '—'}</td>
                <td>{o.shop?.name || '—'}</td>
                <td style={{ fontWeight: 700 }}>₹{o.totalAmount}</td>
                <td style={{ color: o.payment?.status === 'paid' ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                  {o.payment?.status === 'paid' ? '✅ Paid' : o.payment?.status || 'pending'}
                </td>
                <td style={{ color: '#776b63', fontSize: '0.85rem' }}>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
