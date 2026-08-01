import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listLedger, openLedgerPdf } from '../../api/ledger';
import { listShopAccounts } from '../../api/shops';
import { listDeliveryAccounts } from '../../api/delivery';

export default function Ledger() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [shopAccounts, setShopAccounts] = useState([]);
  const [deliveryAccounts, setDeliveryAccounts] = useState([]);
  const [ownerId, setOwnerId] = useState('');
  const [entries, setEntries] = useState([]);
  const [balance, setBalance] = useState(0);
  const [dailySummary, setDailySummary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin picks a specific shop or delivery partner to inspect — mixing everyone's
  // entries together in one list made credits/debits impossible to tell apart.
  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([listShopAccounts(), listDeliveryAccounts()])
      .then(([shops, partners]) => {
        setShopAccounts(shops);
        setDeliveryAccounts(partners);
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    const params = isAdmin ? (ownerId ? { ownerId } : {}) : { role: user?.role };
    listLedger(params)
      .catch(() => ({ entries: [], balance: 0, dailySummary: [] }))
      .then((data) => {
        setEntries(data.entries || []);
        setBalance(data.balance || 0);
        setDailySummary(data.dailySummary || []);
        setLoading(false);
      });
  }, [isAdmin, user?.role, ownerId]);

  const summary = useMemo(
    () => ({
      credits: entries.filter((e) => e.direction === 'credit').reduce((sum, e) => sum + Number(e.amount || 0), 0),
      debits: entries.filter((e) => e.direction === 'debit').reduce((sum, e) => sum + Number(e.amount || 0), 0),
    }),
    [entries]
  );

  const viewingAll = isAdmin && !ownerId;

  function ownerLabel(entry) {
    if (entry.owner && typeof entry.owner === 'object') {
      return `${entry.ownerRole === 'shop' ? '🏪' : '🛵'} ${entry.owner.name}`;
    }
    return entry.ownerRole || '—';
  }

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>Ledger</h2>
          <p className="muted">Deposits, settlements and other account activity for shops and delivery partners.</p>
        </div>
        {!viewingAll && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="pill">Balance: ₹{balance.toFixed(2)}</div>
            <button type="button" onClick={() => openLedgerPdf(ownerId || undefined)}>
              📄 Download PDF
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="filters" style={{ marginBottom: 16 }}>
          <label>
            Owner
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">— All (mixed across owners) —</option>
              <optgroup label="Shops">
                {shopAccounts.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.shop?.name || s.name} ({s.name})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Delivery partners">
                {deliveryAccounts.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </div>
      )}

      {viewingAll && (
        <p className="muted" style={{ marginBottom: 16 }}>
          Showing everyone's activity together — pick a shop or delivery partner above for their own running balance.
        </p>
      )}

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <strong>Total credits</strong>
          <div>₹{summary.credits.toFixed(2)}</div>
        </div>
        <div className="card">
          <strong>Total debits</strong>
          <div>₹{summary.debits.toFixed(2)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Daily credits & debits</h3>
        {dailySummary.length ? (
          <div className="grid two">
            {dailySummary.map((day) => (
              <div key={day.date} className="card">
                <strong>{day.date}</strong>
                <div>Credits: ₹{Number(day.credits || 0).toFixed(2)}</div>
                <div>Debits: ₹{Number(day.debits || 0).toFixed(2)}</div>
                <div className="muted">Entries: {day.entries}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No daily activity yet.</p>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                {viewingAll && <th>Owner</th>}
                <th>Kind</th>
                <th>Description</th>
                <th style={{ color: '#2e7d32' }}>Credit</th>
                <th style={{ color: '#c62828' }}>Debit</th>
                {!viewingAll && <th>Balance</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry._id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  {viewingAll && <td>{ownerLabel(entry)}</td>}
                  <td>{entry.kind}</td>
                  <td>{entry.description}</td>
                  <td style={{ color: '#2e7d32', fontWeight: 600 }}>
                    {entry.direction === 'credit' ? `₹${Number(entry.amount || 0).toFixed(2)}` : ''}
                  </td>
                  <td style={{ color: '#c62828', fontWeight: 600 }}>
                    {entry.direction === 'debit' ? `₹${Number(entry.amount || 0).toFixed(2)}` : ''}
                  </td>
                  {!viewingAll && <td>₹{Number(entry.balanceAfter || 0).toFixed(2)}</td>}
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan={viewingAll ? 7 : 6}>No transactions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
