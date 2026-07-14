import { useEffect, useState } from 'react';
import { listShopAccounts, reviewShopAccount, setShopTwoFactor, resetShopPassword } from '../../api/shops';

const STATUS_LABEL = { pending: 'Awaiting approval', active: 'Approved', rejected: 'Rejected' };
const STATUS_COLOR = { pending: '#a86b00', active: '#2e7d32', rejected: '#c62828' };

function depositLabel(shop) {
  if (!shop?.deposit?.required) return '—';
  return shop.deposit.paid ? `✅ Paid ₹${shop.deposit.amount}` : `⏳ Awaiting ₹${shop.deposit.amount}`;
}

export default function ShopAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      setAccounts(await listShopAccounts());
    } catch (err) {
      setError('Could not load shop accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function approve(id) {
    const requireDeposit = window.confirm(
      'Require a security deposit before this shop goes live?\n\n' +
        'OK = require a deposit (shop stays hidden from customers until paid)\n' +
        'Cancel = activate immediately, no deposit'
    );
    let depositAmount = 0;
    if (requireDeposit) {
      const amt = window.prompt('Deposit amount (₹):', '2000');
      if (amt === null) return;
      depositAmount = Number(amt);
      if (!depositAmount || depositAmount <= 0) {
        setError('Enter a valid deposit amount');
        return;
      }
    }
    setBusyId(id);
    setError('');
    try {
      await reviewShopAccount(id, 'approve', { days: 30, requireDeposit, depositAmount });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id) {
    const reason = window.prompt('Reason for rejection (shown to the owner):', 'Details not acceptable');
    if (reason === null) return;
    setBusyId(id);
    setError('');
    try {
      await reviewShopAccount(id, 'reject', { reason });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  // Two-factor is opt-in per shop — this is the admin's permission switch for it.
  async function toggleTwoFactor(account) {
    setBusyId(account._id);
    setError('');
    try {
      await setShopTwoFactor(account._id, !account.twoFactor?.allowed);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update two-factor permission');
    } finally {
      setBusyId(null);
    }
  }

  // Admin sets a new password when an owner has forgotten theirs and has no phone
  // on file for OTP login.
  async function resetPassword(account) {
    const password = window.prompt(`New password for ${account.name} (${account.email}):`);
    if (!password) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setBusyId(account._id);
    setError('');
    try {
      await resetShopPassword(account._id, password);
      window.alert(`Password updated. Share it with the shop owner:\n\n${password}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading shop accounts...</p>;

  const pending = accounts.filter((a) => a.status === 'pending');
  const others = accounts.filter((a) => a.status !== 'pending');

  return (
    <div>
      <h1>Shop accounts</h1>
      <p style={{ color: '#776b63' }}>
        Shops that owners register from the app appear here. Approve one to let the owner log in.
      </p>
      {error && <p style={{ color: '#c62828' }}>{error}</p>}

      <h2 style={{ marginTop: 16 }}>Awaiting approval ({pending.length})</h2>
      {pending.length === 0 ? (
        <p style={{ color: '#776b63' }}>No shops waiting for approval.</p>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e6e0da' }}>
              <th>Owner</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Shop</th>
              <th>2FA</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((a) => (
              <tr key={a._id} style={{ borderBottom: '1px solid #e6e0da' }}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>{a.phone || '—'}</td>
                <td>{a.shop?.name || '—'} <span style={{ color: '#776b63' }}>({a.shop?.category || '—'})</span></td>
                <td>
                  {a.twoFactor?.enabled ? '✅ set up' : a.twoFactor?.allowed ? '🔓 allowed' : '—'}
                  <button
                    onClick={() => toggleTwoFactor(a)}
                    disabled={busyId === a._id}
                    style={{ marginLeft: 6, fontSize: '0.8rem' }}
                  >
                    {a.twoFactor?.allowed ? 'Disallow' : 'Allow'}
                  </button>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => approve(a._id)} disabled={busyId === a._id} style={{ background: '#2e7d32', color: '#fff', marginRight: 6 }}>
                    Approve
                  </button>
                  <button onClick={() => reject(a._id)} disabled={busyId === a._id} style={{ background: '#c62828', color: '#fff', marginRight: 6 }}>
                    Reject
                  </button>
                  <button onClick={() => resetPassword(a)} disabled={busyId === a._id}>
                    Set password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 24 }}>All shop accounts</h2>
      <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e6e0da' }}>
            <th>Owner</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Shop</th>
            <th>2FA</th>
            <th>Deposit</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {others.map((a) => (
            <tr key={a._id} style={{ borderBottom: '1px solid #e6e0da' }}>
              <td>{a.name}</td>
              <td>{a.email}</td>
              <td>{a.phone || '—'}</td>
              <td>{a.shop?.name || '—'}</td>
              <td>
                {a.twoFactor?.enabled ? '✅ set up' : a.twoFactor?.allowed ? '🔓 allowed' : '—'}
                <button
                  onClick={() => toggleTwoFactor(a)}
                  disabled={busyId === a._id}
                  style={{ marginLeft: 6, fontSize: '0.8rem' }}
                >
                  {a.twoFactor?.allowed ? 'Disallow' : 'Allow'}
                </button>
              </td>
              <td>{depositLabel(a.shop)}</td>
              <td style={{ color: STATUS_COLOR[a.status] || '#776b63', fontWeight: 600 }}>
                {STATUS_LABEL[a.status] || a.status}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {a.status !== 'active' && (
                  <button onClick={() => approve(a._id)} disabled={busyId === a._id} style={{ background: '#2e7d32', color: '#fff', marginRight: 6 }}>
                    Approve
                  </button>
                )}
                <button onClick={() => resetPassword(a)} disabled={busyId === a._id}>
                  Set password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
