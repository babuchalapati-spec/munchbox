import { useEffect, useState } from 'react';
import { listCateringRequests, quoteCateringRequest } from '../../api/catering';

const STATUS_LABEL = {
  requested: 'New request',
  quoted: 'Quote sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export default function Catering() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});

  async function refresh() {
    setLoading(true);
    setRequests(await listCateringRequests());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function setDraft(id, field, value) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  async function sendQuote(reqItem) {
    const draft = drafts[reqItem._id] || {};
    const discount = Number(draft.discount || 0);
    const updated = await quoteCateringRequest(reqItem._id, {
      quotedTotal: reqItem.estimatedTotal,
      discount,
      ownerNote: draft.ownerNote || '',
    });
    setRequests((prev) => prev.map((r) => (r._id === reqItem._id ? updated : r)));
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Catering requests</h1>
      {requests.length === 0 ? (
        <p>No catering requests yet.</p>
      ) : (
        <div className="order-list">
          {requests.map((r) => (
            <div className="card order-card" key={r._id}>
              <div className="order-card-header">
                <div>
                  <strong>{r.user?.name || 'Customer'}</strong>
                  <span className="muted"> · {r.user?.phone || r.phone}</span>
                  {r.shop?.name ? <span className="muted"> · 🍽️ {r.shop.name}</span> : null}
                </div>
                <span className="status-badge">{STATUS_LABEL[r.status] || r.status}</span>
              </div>

              <p className="muted">
                {r.headcount} people · event {new Date(r.eventDate).toLocaleDateString()}
              </p>
              <ul className="order-items">
                {r.items.map((it, idx) => (
                  <li key={idx}>
                    {it.quantity} × {it.name} @ ₹{it.unitPrice} = ₹{it.quantity * it.unitPrice}
                  </li>
                ))}
              </ul>
              <p className="muted">{r.address}</p>
              {r.notes ? <p className="muted">Note: {r.notes}</p> : null}
              <p>
                <strong>Estimate: ₹{r.estimatedTotal}</strong>
                {r.quotedTotal != null && (
                  <span> · Quoted: ₹{r.quotedTotal} (discount ₹{r.discount})</span>
                )}
              </p>

              {(r.status === 'requested' || r.status === 'quoted') && (
                <div className="form-grid" style={{ marginTop: 8 }}>
                  <label>
                    Discount (₹)
                    <input
                      type="number"
                      min="0"
                      value={drafts[r._id]?.discount ?? ''}
                      onChange={(e) => setDraft(r._id, 'discount', e.target.value)}
                    />
                  </label>
                  <label>
                    Note to customer
                    <input
                      value={drafts[r._id]?.ownerNote ?? ''}
                      onChange={(e) => setDraft(r._id, 'ownerNote', e.target.value)}
                    />
                  </label>
                  <div className="form-actions">
                    <button onClick={() => sendQuote(r)}>
                      {r.status === 'quoted' ? 'Update quote' : 'Send quote'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
