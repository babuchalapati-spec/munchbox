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

  return (
    <div>
      <h1>Delivery partners</h1>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>New delivery account (manual)</h2>
        {error && <p className="error">{error}</p>}
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

      <h2>Partners & KYC</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="order-list">
          {accounts.map((a) => {
            const status = a.kyc?.status || 'pending';
            return (
              <div className="card order-card" key={a._id}>
                <div className="order-card-header">
                  <div>
                    <strong>{a.name}</strong>
                    <span className="muted"> · {a.phone || a.email}</span>
                    {a.kyc?.vehicleNumber ? <span className="muted"> · 🏍 {a.kyc.vehicleNumber}</span> : null}
                  </div>
                  <span className="status-badge" style={{ color: KYC_COLOR[status] }}>
                    {KYC_LABEL[status] || status}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
                  {DOCS.map(([key, label]) =>
                    a.kyc?.[key] ? (
                      <a key={key} href={`${API_ORIGIN}${a.kyc[key]}`} target="_blank" rel="noreferrer">
                        <img
                          src={`${API_ORIGIN}${a.kyc[key]}`}
                          alt={label}
                          style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #e6e0da' }}
                        />
                        <div className="muted" style={{ textAlign: 'center', fontSize: '0.75rem' }}>{label}</div>
                      </a>
                    ) : (
                      <div key={key} className="muted" style={{ fontSize: '0.8rem' }}>{label}: —</div>
                    )
                  )}
                </div>

                {a.kyc?.rejectionReason ? <p className="muted">Reason: {a.kyc.rejectionReason}</p> : null}

                {status !== 'verified' && (
                  <div className="row-actions">
                    <button onClick={() => verify(a._id)}>Approve</button>
                    <button onClick={() => reject(a._id)}>Reject</button>
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
