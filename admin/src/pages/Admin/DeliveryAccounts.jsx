import { useEffect, useState } from 'react';
import { listDeliveryAccounts, createDeliveryAccount, reviewKyc } from '../../api/delivery';

const emptyForm = { name: '', email: '', password: '', phone: '' };
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace('/api', '');

const KYC_LABEL = { pending: 'Pending review', verified: 'Verified', rejected: 'Rejected' };
const KYC_COLOR = { pending: '#a86b00', verified: '#2e7d32', rejected: '#c62828' };

const DOCS = [
  ['photoUrl', 'Photo'],
  ['aadhaarUrl', 'Aadhaar'],
  ['licenseUrl', 'License'],
  ['rcUrl', 'RC book'],
];

export default function DeliveryAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  async function refresh() {
    setLoading(true);
    setAccounts(await listDeliveryAccounts());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await createDeliveryAccount(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create account');
    }
  }

  async function verify(id) {
    const updated = await reviewKyc(id, 'verify');
    setAccounts((prev) => prev.map((a) => (a._id === id ? { ...a, kyc: updated.kyc } : a)));
  }

  async function reject(id) {
    const reason = prompt('Reason for rejection?');
    if (reason === null) return;
    const updated = await reviewKyc(id, 'reject', reason);
    setAccounts((prev) => prev.map((a) => (a._id === id ? { ...a, kyc: updated.kyc } : a)));
  }

  const counts = {
    all: accounts.length,
    pending: accounts.filter((a) => (a.kyc?.status || 'pending') === 'pending').length,
    verified: accounts.filter((a) => a.kyc?.status === 'verified').length,
    rejected: accounts.filter((a) => a.kyc?.status === 'rejected').length,
  };
  const visible = statusFilter === 'all' ? accounts : accounts.filter((a) => (a.kyc?.status || 'pending') === statusFilter);

  return (
    <div>
      <h1>Delivery partners</h1>

      <div className="dash-stats" style={{ marginBottom: 24 }}>
        <button className="stat-tile" onClick={() => setStatusFilter('all')} style={statusFilter === 'all' ? { borderColor: '#c2185b' } : undefined}>
          <span className="stat-num">{counts.all}</span>
          <span className="stat-label">All partners</span>
        </button>
        <button className="stat-tile" onClick={() => setStatusFilter('pending')} style={statusFilter === 'pending' ? { borderColor: '#c2185b' } : undefined}>
          <span className="stat-num" style={{ color: '#a86b00' }}>{counts.pending}</span>
          <span className="stat-label">Pending review</span>
        </button>
        <button className="stat-tile" onClick={() => setStatusFilter('verified')} style={statusFilter === 'verified' ? { borderColor: '#c2185b' } : undefined}>
          <span className="stat-num" style={{ color: '#2e7d32' }}>{counts.verified}</span>
          <span className="stat-label">Verified</span>
        </button>
        <button className="stat-tile" onClick={() => setStatusFilter('rejected')} style={statusFilter === 'rejected' ? { borderColor: '#c2185b' } : undefined}>
          <span className="stat-num" style={{ color: '#c62828' }}>{counts.rejected}</span>
          <span className="stat-label">Rejected</span>
        </button>
      </div>

      <div className="card">
        <h2>➕ New delivery account (manual)</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
          <div className="form-grid">
            <label>
              Name
              <input name="name" value={form.name} onChange={handleChange} required />
            </label>
            <label>
              Email
              <input name="email" type="email" value={form.email} onChange={handleChange} required />
            </label>
            <label>
              Password
              <input name="password" type="password" value={form.password} onChange={handleChange} required />
            </label>
            <label>
              Phone
              <input name="phone" value={form.phone} onChange={handleChange} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Create account</button>
          </div>
        </form>
      </div>

      <h2 style={{ margin: '0 0 0.9rem' }}>👤 Partner records ({visible.length})</h2>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="muted">No partners in this category.</p>
      ) : (
        <div className="order-list">
          {visible.map((a) => {
            const status = a.kyc?.status || 'pending';
            return (
              <div className="card" key={a._id}>
                <div className="order-card-header">
                  <div>
                    <strong style={{ fontSize: '1.02rem' }}>{a.name}</strong>
                    <div className="muted" style={{ marginTop: 2 }}>
                      📞 {a.phone || '—'} &nbsp;·&nbsp; ✉️ {a.email}
                      {a.kyc?.vehicleNumber ? <> &nbsp;·&nbsp; 🏍️ {a.kyc.vehicleNumber}</> : null}
                    </div>
                  </div>
                  <span
                    className="status-badge"
                    style={{ background: 'transparent', color: KYC_COLOR[status], border: `1px solid ${KYC_COLOR[status]}` }}
                  >
                    {KYC_LABEL[status] || status}
                  </span>
                </div>

                <div style={{ marginTop: 12, marginBottom: 4, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)' }}>
                  Documents
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                  {DOCS.map(([key, label]) =>
                    a.kyc?.[key] ? (
                      <a key={key} href={`${API_ORIGIN}${a.kyc[key]}`} target="_blank" rel="noreferrer" style={{ textAlign: 'center' }}>
                        <img
                          src={`${API_ORIGIN}${a.kyc[key]}`}
                          alt={label}
                          style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }}
                        />
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{label}</div>
                      </a>
                    ) : (
                      <div key={key} style={{ width: 92, textAlign: 'center' }}>
                        <div style={{ width: 92, height: 92, borderRadius: 8, border: '1px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)', fontSize: '0.75rem' }}>
                          Not added
                        </div>
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{label}</div>
                      </div>
                    )
                  )}
                </div>

                {a.kyc?.rejectionReason ? <p className="muted">Rejection reason: {a.kyc.rejectionReason}</p> : null}

                {status !== 'verified' && (
                  <div className="row-actions">
                    <button onClick={() => verify(a._id)} style={{ background: '#2e7d32' }}>Approve</button>
                    <button onClick={() => reject(a._id)} style={{ background: '#c62828' }}>Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
