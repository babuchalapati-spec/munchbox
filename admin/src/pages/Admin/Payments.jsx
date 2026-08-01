import { useEffect, useState } from 'react';
import { listPendingTopUps, reviewTopUp } from '../../api/ledger';
import { getSettings, updateSettings } from '../../api/settings';
import { listPaymentFailures, resolvePaymentFailure, listPendingUpiPayments, reviewUpiPayment } from '../../api/payments';
import { listOrders } from '../../api/orders';

export default function Payments() {
  const [pending, setPending] = useState([]);
  const [upi, setUpi] = useState({ upiId: '', payeeName: '', phone: '' });
  const [failures, setFailures] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [pendingUpiOrders, setPendingUpiOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [savingUpi, setSavingUpi] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const [entries, settings, failedPayments, orders, pendingUpi] = await Promise.all([
        listPendingTopUps(),
        getSettings(),
        listPaymentFailures(),
        listOrders(),
        listPendingUpiPayments(),
      ]);
      setPending(entries);
      setUpi({
        upiId: settings.payments?.upiId || '',
        payeeName: settings.payments?.payeeName || 'Munchbox',
        phone: settings.payments?.phone || '',
      });
      setFailures(failedPayments);
      setRecentOrders(orders.filter((o) => o.payment?.method === 'online').slice(0, 20));
      setPendingUpiOrders(pendingUpi);
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

  async function decideUpiOrder(orderId, action) {
    if (action === 'confirm' && !window.confirm('Confirm this customer payment arrived?')) return;
    setBusyId(orderId);
    setError('');
    try {
      await reviewUpiPayment(orderId, action);
      setPendingUpiOrders((prev) => prev.filter((o) => o._id !== orderId));
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
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

  if (loading) return <p className="muted">Loading payments…</p>;

  const totalToReview = failures.length + pendingUpiOrders.length + pending.length;

  return (
    <div>
      <h1>Payments &amp; deposits</h1>
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}
      {msg && <p style={{ color: '#2e7d32', fontWeight: 600, marginBottom: 16 }}>✅ {msg}</p>}

      <div className="dash-stats" style={{ marginBottom: 24 }}>
        <div className="stat-tile" style={{ cursor: 'default' }}>
          <span className="stat-num">{totalToReview}</span>
          <span className="stat-label">Total needing review</span>
        </div>
        <div className="stat-tile" style={{ cursor: 'default' }}>
          <span className="stat-num" style={{ color: failures.length ? '#c62828' : '#2e7d32' }}>{failures.length}</span>
          <span className="stat-label">Failed payments</span>
        </div>
        <div className="stat-tile" style={{ cursor: 'default' }}>
          <span className="stat-num">{pendingUpiOrders.length}</span>
          <span className="stat-label">Customer UPI to confirm</span>
        </div>
        <div className="stat-tile" style={{ cursor: 'default' }}>
          <span className="stat-num">{pending.length}</span>
          <span className="stat-label">Shop/partner top-ups</span>
        </div>
      </div>

      {failures.length > 0 && (
        <div className="card" style={{ borderColor: '#f3c6c2', background: '#fdecea' }}>
          <h2 style={{ color: '#c62828' }}>⚠️ {failures.length} customer payment{failures.length > 1 ? 's' : ''} failed</h2>
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>When</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f._id}>
                  <td>
                    <strong>{f.user?.name || '—'}</strong>
                    <div className="muted">{f.user?.phone || f.user?.email}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>₹{f.amount}</td>
                  <td>{f.reason || '—'}</td>
                  <td className="muted">{new Date(f.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="btn-outline" onClick={() => resolveFailure(f._id)} disabled={busyId === f._id}>
                      Mark resolved
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2>💳 Customer UPI payments to confirm ({pendingUpiOrders.length})</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          A customer paid by UPI at checkout and submitted a reference. Check the money arrived, then confirm — the shop
          won't see this order as paid until you do.
        </p>
        {pendingUpiOrders.length === 0 ? (
          <p style={{ color: '#2e7d32', fontWeight: 600 }}>✅ No customer UPI payments waiting.</p>
        ) : (
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Shop</th>
                <th>Amount</th>
                <th>UPI reference</th>
                <th>Placed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingUpiOrders.map((o) => (
                <tr key={o._id}>
                  <td>
                    <strong>{o.user?.name || '—'}</strong>
                    <div className="muted">{o.user?.phone}</div>
                  </td>
                  <td>{o.shop?.name || '—'}</td>
                  <td style={{ fontWeight: 700 }}>₹{o.totalAmount}</td>
                  <td>{o.payment?.upiReference || '—'}</td>
                  <td className="muted">{new Date(o.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => decideUpiOrder(o._id, 'confirm')} disabled={busyId === o._id} style={{ background: '#2e7d32' }}>
                        Confirm
                      </button>
                      <button onClick={() => decideUpiOrder(o._id, 'reject')} disabled={busyId === o._id} style={{ background: '#c62828' }}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>🏪 Shop/partner top-ups to confirm ({pending.length})</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          A shop/partner paid by UPI and submitted the reference. Check the money arrived, then confirm — the balance is
          credited only after you confirm.
        </p>
        {pending.length === 0 ? (
          <p style={{ color: '#2e7d32', fontWeight: 600 }}>✅ No payments waiting.</p>
        ) : (
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
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
                <tr key={e._id}>
                  <td>
                    <strong>{e.owner?.name || '—'}</strong>
                    <div className="muted">{e.owner?.email || e.owner?.phone}</div>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{e.ownerRole}</td>
                  <td style={{ fontWeight: 700, color: '#2e7d32' }}>₹{e.amount}</td>
                  <td>{e.metadata?.reference || '—'}</td>
                  <td className="muted">{new Date(e.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => decide(e._id, 'confirm')} disabled={busyId === e._id} style={{ background: '#2e7d32' }}>
                        Confirm &amp; credit
                      </button>
                      <button onClick={() => decide(e._id, 'reject')} disabled={busyId === e._id} style={{ background: '#c62828' }}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>📜 Recent online payments (customers)</h2>
        {recentOrders.length === 0 ? (
          <p className="muted">No online payments yet.</p>
        ) : (
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Shop</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o._id}>
                  <td>{o.user?.name || '—'}</td>
                  <td>{o.shop?.name || '—'}</td>
                  <td style={{ fontWeight: 700 }}>₹{o.totalAmount}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={o.payment?.status === 'paid' ? { background: '#d4edda', color: '#1e6b32' } : { background: '#f8d7da', color: '#a52834' }}
                    >
                      {o.payment?.status === 'paid' ? '✅ Paid' : o.payment?.status || 'pending'}
                    </span>
                  </td>
                  <td className="muted">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h2>🏦 Your UPI ID (where shops send money)</h2>
        <form onSubmit={saveUpi} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <button type="submit" disabled={savingUpi} style={{ alignSelf: 'flex-start' }}>
            {savingUpi ? 'Saving…' : 'Save UPI'}
          </button>
        </form>
      </div>
    </div>
  );
}
