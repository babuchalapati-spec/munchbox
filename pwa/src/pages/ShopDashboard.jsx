import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import client, {imageUri} from '../api/client';
import {useAuth} from '../context/AuthContext';

const NEXT_STATUS = {
  placed: {next: 'confirmed', label: 'Confirm order'},
  confirmed: {next: 'baking', label: 'Start baking / preparing'},
  baking: {next: 'ready', label: 'Mark ready for pickup'},
};

const CATEGORIES = ['Cake', 'Food', 'Catering'];

function osmEmbedUrl(lat, lng) {
  const d = 0.008;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

// Live map of the assigned delivery partner's position, polled every 10s —
// shown while they're heading to the shop or out for delivery.
function DeliveryTrackingMap({orderId}) {
  const [location, setLocation] = useState(null);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const [orderRes, etaRes] = await Promise.all([
          client.get(`/orders/${orderId}`),
          client.get(`/orders/${orderId}/eta`),
        ]);
        if (cancelled) return;
        setLocation(orderRes.data.order.currentLocation || null);
        setEta(etaRes.data.eta);
      } catch (err) {
        // ignore — retried next tick
      }
    }
    poll();
    const iv = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [orderId]);

  if (!location) return <p className="muted" style={{fontSize: 12, marginTop: 8}}>Waiting for the delivery partner's location...</p>;

  return (
    <div style={{marginTop: 8}}>
      <div style={{width: '100%', height: 160, borderRadius: 10, overflow: 'hidden', background: '#e6e0da'}}>
        <iframe title="delivery location" width="100%" height="160" style={{border: 0}} src={osmEmbedUrl(location.lat, location.lng)} />
      </div>
      <p style={{fontSize: 12, fontWeight: 600, marginTop: 6}}>
        {eta ? `📍 ${eta.distanceKm} km away · ETA ~${eta.etaMinutes} min${eta.estimated ? ' (estimated)' : ''}` : 'Calculating ETA...'}
      </p>
    </div>
  );
}

// Parses "Extra cheese +40, Olives +20" into [{name, price}], matching the mobile app.
function parseAddOns(text) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/(.+?)\s*\+?\s*(\d+)?\s*$/);
      return {name: (m?.[1] || part).trim(), price: Number(m?.[2] || 0)};
    });
}

export default function ShopDashboard() {
  const {user, logout} = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [assignPicks, setAssignPicks] = useState({});
  const [shop, setShop] = useState(null);
  const [ledger, setLedger] = useState({entries: [], balance: 0, pendingTopUps: []});
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpReference, setTopUpReference] = useState('');
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newItem, setNewItem] = useState({name: '', category: 'Cake', basePrice: '', addOns: '', imageLink: '', imageFile: null, isVeg: true});
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({name: '', basePrice: '', imageLink: '', imageFile: null});
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingUpiOrders, setPendingUpiOrders] = useState([]);

  const shopId = user?.shop?._id || user?.shop;

  async function refresh() {
    try {
      const [ordersRes, partnersRes, productsRes, ledgerRes, paymentRes, shopRes, upiRes] = await Promise.all([
        client.get('/orders'),
        client.get('/orders/delivery-partners'),
        client.get('/products', {params: {shop: shopId}}),
        client.get('/auth/ledger'),
        client.get('/settings/payment-info'),
        shopId ? client.get(`/shops/${shopId}`) : Promise.resolve({data: {shop: null}}),
        client.get('/payments/upi/pending'),
      ]);
      setOrders(ordersRes.data.orders);
      setPartners(partnersRes.data.partners);
      setProducts(productsRes.data.products);
      setLedger(ledgerRes.data);
      setPaymentInfo(paymentRes.data.payments);
      setShop(shopRes.data.shop);
      setPendingUpiOrders(upiRes.data.orders);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load shop data');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function payByUpi() {
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) return setError('Enter how much you want to add');
    if (!paymentInfo?.upiId) {
      setError('The admin has not added a UPI ID yet. Please contact the admin.');
      return;
    }
    const url = `upi://pay?pa=${encodeURIComponent(paymentInfo.upiId)}&pn=${encodeURIComponent(paymentInfo.payeeName || 'Munchbox')}&am=${amount}&cu=INR&tn=${encodeURIComponent('Munchbox shop advance')}`;
    window.location.href = url;
  }

  async function submitTopUp() {
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) return setError('Enter how much you paid');
    setError('');
    setTopUpBusy(true);
    try {
      const {data} = await client.post('/auth/ledger/topup', {amount, reference: topUpReference.trim()});
      setTopUpAmount('');
      setTopUpReference('');
      setTopUpOpen(false);
      setMessage(data.message || 'Payment submitted. The admin will confirm and credit your balance.');
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit payment');
    } finally {
      setTopUpBusy(false);
    }
  }

  async function addItem() {
    if (!newItem.name.trim() || !newItem.basePrice) {
      setError('Enter an item name and price.');
      return;
    }
    setError('');
    setAdding(true);
    try {
      let imageUrl = newItem.imageLink.trim();
      if (!imageUrl && newItem.imageFile) {
        const form = new FormData();
        form.append('image', newItem.imageFile);
        const {data} = await client.post('/uploads', form, {headers: {'Content-Type': 'multipart/form-data'}, timeout: 120000});
        imageUrl = data.url;
      }
      await client.post('/products', {
        name: newItem.name.trim(),
        category: newItem.category,
        basePrice: Number(newItem.basePrice),
        available: true,
        imageUrl,
        addOns: parseAddOns(newItem.addOns),
        isVeg: newItem.category === 'Cake' ? true : newItem.isVeg,
      });
      setNewItem({name: '', category: 'Cake', basePrice: '', addOns: '', imageLink: '', imageFile: null, isVeg: true});
      setMessage('Item added and is now available to customers.');
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not add item');
    } finally {
      setAdding(false);
    }
  }

  async function advance(order) {
    const step = NEXT_STATUS[order.status];
    if (!step) return;
    setError('');
    try {
      await client.put(`/orders/${order._id}/status`, {status: step.next});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status');
    }
  }

  async function assign(order) {
    const deliveryUserId = assignPicks[order._id];
    if (!deliveryUserId) return;
    setError('');
    try {
      await client.put(`/orders/${order._id}/assign`, {deliveryUserId});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not assign delivery partner');
    }
  }

  async function toggleStock(product) {
    setError('');
    try {
      await client.put(`/products/${product._id}`, {available: !product.available});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update stock');
    }
  }

  function startEdit(product) {
    setEditingId(product._id);
    setEditDraft({
      name: product.name,
      basePrice: String(product.basePrice),
      imageLink: /^https?:\/\//i.test(product.imageUrl || '') ? product.imageUrl : '',
      imageFile: null,
      isVeg: product.isVeg !== false,
    });
    setError('');
  }

  async function saveEdit(productId) {
    if (!editDraft.name.trim() || !editDraft.basePrice) {
      setError('Enter a name and price');
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      const payload = {name: editDraft.name.trim(), basePrice: Number(editDraft.basePrice), isVeg: editDraft.isVeg};
      if (editDraft.imageFile) {
        const form = new FormData();
        form.append('image', editDraft.imageFile);
        const {data} = await client.post('/uploads', form, {headers: {'Content-Type': 'multipart/form-data'}, timeout: 120000});
        payload.imageUrl = data.url;
      } else if (editDraft.imageLink.trim()) {
        payload.imageUrl = editDraft.imageLink.trim();
      }
      await client.put(`/products/${productId}`, payload);
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save changes');
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteItem(product) {
    if (!window.confirm(`Remove "${product.name}" from your menu?`)) return;
    setError('');
    try {
      await client.delete(`/products/${product._id}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete item');
    }
  }

  async function reviewUpi(orderId, action) {
    if (action === 'confirm' && !window.confirm('Confirm this customer payment arrived?')) return;
    setError('');
    try {
      await client.put(`/payments/upi/${orderId}/review`, {action});
      setPendingUpiOrders((prev) => prev.filter((o) => o._id !== orderId));
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>🏪 {shop?.name || user?.name}</h2>
        <button className="link" style={{margin: 0}} onClick={handleLogout}>Log out</button>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {error && <p className="error">{error}</p>}
        {message && <p style={{color: '#2e7d32', fontSize: 13, marginBottom: 12}}>{message}</p>}

        {shop?.deposit?.required && !shop.deposit.paid && (
          <div className="card" style={{borderColor: '#c62828', borderWidth: 1}}>
            <p style={{fontWeight: 700}}>⏳ Activation deposit required</p>
            <p className="muted">
              Pay ₹{shop.deposit.amount} via UPI below to activate your shop. Customers won't see your shop until the
              admin confirms this payment.
            </p>
          </div>
        )}

        <div className="card">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <p style={{fontWeight: 700, margin: 0}}>Advance balance</p>
          </div>
          <p style={{fontSize: 26, fontWeight: 800, color: '#c2185b', margin: '6px 0'}}>₹{Number(ledger.balance || 0).toFixed(2)}</p>
          {Number(ledger.balance || 0) < 500 && (
            <p style={{color: '#c62828', fontSize: 12}}>⚠️ Below ₹500 — customers can't order from your shop until you top up.</p>
          )}
          {ledger.pendingTopUps?.length ? (
            <p style={{color: '#a86b00', fontSize: 12}}>
              ⏳ ₹{ledger.pendingTopUps.reduce((t, e) => t + Number(e.amount || 0), 0)} awaiting admin confirmation
            </p>
          ) : null}

          {!topUpOpen ? (
            <button className="btn" style={{marginTop: 8}} onClick={() => setTopUpOpen(true)}>＋ Add balance (UPI)</button>
          ) : (
            <div style={{marginTop: 8}}>
              <input
                className="input"
                placeholder="Amount ₹ (e.g. 1000)"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <button className="btn btn-outline" onClick={payByUpi} style={{marginBottom: 12}}>💳 Pay ₹{topUpAmount || '0'} via UPI</button>
              {paymentInfo?.upiId && <p className="muted">Or pay manually to UPI ID: <strong>{paymentInfo.upiId}</strong></p>}
              <p className="muted">After paying, enter the reference number and submit:</p>
              <input className="input" placeholder="UPI reference / transaction ID" value={topUpReference} onChange={(e) => setTopUpReference(e.target.value)} />
              <div style={{display: 'flex', gap: 8}}>
                <button className="btn btn-outline" onClick={() => { setTopUpOpen(false); setTopUpAmount(''); setTopUpReference(''); }}>Cancel</button>
                <button className="btn" onClick={submitTopUp} disabled={topUpBusy}>{topUpBusy ? 'Submitting…' : 'Submit payment'}</button>
              </div>
            </div>
          )}
        </div>

        {pendingUpiOrders.length > 0 && (
          <div className="card" style={{borderColor: '#c62828', borderWidth: 1}}>
            <p style={{fontWeight: 700, marginTop: 0}}>💳 UPI payments to confirm ({pendingUpiOrders.length})</p>
            {pendingUpiOrders.map((o) => (
              <div key={o._id} style={{borderTop: '1px solid #e6e0da', paddingTop: 10, marginTop: 10}}>
                <div><strong>{o.user?.name}</strong> · ₹{o.totalAmount}</div>
                <div className="muted">Reference: {o.payment?.upiReference || '—'}</div>
                <div style={{display: 'flex', gap: 8, marginTop: 6}}>
                  <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '6px 12px', background: '#2e7d32'}} onClick={() => reviewUpi(o._id, 'confirm')}>Confirm</button>
                  <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '6px 12px', background: '#c62828'}} onClick={() => reviewUpi(o._id, 'reject')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3>Orders ({orders.length})</h3>
        {orders.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          orders.map((order) => (
            <div key={order._id} className="card">
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <strong>{order.user?.name || 'Customer'}</strong>
                <span style={{fontWeight: 600}}>{order.status}</span>
              </div>
              {order.items.map((item, idx) => (
                <div key={idx} className="muted">{item.quantity}× {item.name}</div>
              ))}
              <div className="muted">
                Total: ₹{order.totalAmount} ·{' '}
                {order.payment?.method === 'online' || order.payment?.method === 'upi'
                  ? `${order.payment.method === 'upi' ? 'UPI' : 'Online'} (${order.payment.status})`
                  : 'Cash on Delivery'}
              </div>
              <div className="muted">Deliver to: {order.deliveryAddress}</div>

              {NEXT_STATUS[order.status] && (
                <button className="btn" style={{marginTop: 8}} onClick={() => advance(order)}>{NEXT_STATUS[order.status].label}</button>
              )}

              {order.status === 'ready' && !order.assignedTo && (
                <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                  <select
                    className="input"
                    style={{marginBottom: 0}}
                    value={assignPicks[order._id] || ''}
                    onChange={(e) => setAssignPicks((s) => ({...s, [order._id]: e.target.value}))}
                  >
                    <option value="">Choose delivery partner</option>
                    {partners.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '0 14px'}} onClick={() => assign(order)}>Assign</button>
                </div>
              )}
              {order.assignedTo && <div className="muted" style={{marginTop: 6}}>🛵 Assigned: {order.assignedTo.name}</div>}

              {['ready', 'heading_to_shop'].includes(order.status) && order.pickupCode && (
                <div className="card" style={{background: '#c2185b', color: '#fff', textAlign: 'center', marginTop: 8}}>
                  <div style={{fontSize: 12}}>Pickup code — give to delivery partner</div>
                  <div style={{fontSize: 26, fontWeight: 800, letterSpacing: 6, margin: '4px 0'}}>{order.pickupCode}</div>
                </div>
              )}
              {order.status === 'out_for_delivery' && (
                <div style={{marginTop: 6, fontWeight: 600, color: '#2e7d32'}}>📦 Picked up — on the way to customer</div>
              )}
              {order.status === 'delivered' && (
                <div style={{marginTop: 6, fontWeight: 600, color: '#2e7d32'}}>✓ Delivered</div>
              )}

              {['heading_to_shop', 'out_for_delivery'].includes(order.status) && order.assignedTo && (
                <DeliveryTrackingMap orderId={order._id} />
              )}

              <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                <button
                  className="btn btn-outline"
                  style={{width: 'auto', flex: '0 0 auto', padding: '6px 12px', fontSize: 13}}
                  onClick={() => navigate(`/orders/${order._id}/chat?title=${encodeURIComponent(order.user?.name || 'Customer')}`)}
                >
                  💬 Message customer
                </button>
                {order.assignedTo && (
                  <button
                    className="btn btn-outline"
                    style={{width: 'auto', flex: '0 0 auto', padding: '6px 12px', fontSize: 13}}
                    onClick={() => navigate(`/orders/${order._id}/chat?channel=pickup&title=${encodeURIComponent(order.assignedTo?.name || 'Delivery partner')}`)}
                  >
                    🛵 Message {order.assignedTo?.name || 'delivery partner'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        <h3 style={{marginTop: 20}}>Add a menu item</h3>
        <div className="card">
          <input className="input" placeholder="Item name (e.g. Chocolate cake)" value={newItem.name} onChange={(e) => setNewItem((s) => ({...s, name: e.target.value}))} />
          <div className="tab-row">
            {CATEGORIES.map((c) => (
              <button key={c} className={`tab ${newItem.category === c ? 'active' : ''}`} onClick={() => setNewItem((s) => ({...s, category: c}))}>{c}</button>
            ))}
          </div>
          {newItem.category !== 'Cake' && (
            <div className="tab-row">
              <button type="button" className={`tab ${newItem.isVeg ? 'active' : ''}`} style={newItem.isVeg ? {background: '#2e7d32'} : undefined} onClick={() => setNewItem((s) => ({...s, isVeg: true}))}>🟢 Veg</button>
              <button type="button" className={`tab ${!newItem.isVeg ? 'active' : ''}`} style={!newItem.isVeg ? {background: '#c62828'} : undefined} onClick={() => setNewItem((s) => ({...s, isVeg: false}))}>🔴 Non-veg</button>
            </div>
          )}
          <label className="label">Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setNewItem((s) => ({...s, imageFile: e.target.files[0], imageLink: ''}))} style={{marginBottom: 12}} />
          <input className="input" placeholder="Or paste a direct image URL (must end in .jpg/.png, not a webpage)" value={newItem.imageLink} onChange={(e) => setNewItem((s) => ({...s, imageLink: e.target.value, imageFile: null}))} />
          <input className="input" placeholder="Toppings / add-ons (e.g. Extra cheese +40, Olives +20)" value={newItem.addOns} onChange={(e) => setNewItem((s) => ({...s, addOns: e.target.value}))} />
          <input className="input" placeholder="Price ₹" value={newItem.basePrice} onChange={(e) => setNewItem((s) => ({...s, basePrice: e.target.value.replace(/[^0-9]/g, '')}))} />
          <button className="btn" onClick={addItem} disabled={adding}>{adding ? 'Adding…' : '+ Add item'}</button>
        </div>

        <h3 style={{marginTop: 20}}>Menu items ({products.length})</h3>
        {products.map((p) => (
          <div key={p._id} className="card">
            {editingId === p._id ? (
              <>
                <input className="input" value={editDraft.name} onChange={(e) => setEditDraft((d) => ({...d, name: e.target.value}))} placeholder="Item name" />
                <input className="input" value={editDraft.basePrice} onChange={(e) => setEditDraft((d) => ({...d, basePrice: e.target.value.replace(/[^0-9]/g, '')}))} placeholder="Price ₹" />
                {p.imageUrl && (
                  <div style={{width: 60, height: 60, borderRadius: 8, background: '#f6f3f0', overflow: 'hidden', marginBottom: 8}}>
                    <img src={imageUri(p.imageUrl)} alt="" onError={(e) => { e.target.style.display = 'none'; }} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  </div>
                )}
                <label className="label">Change photo (optional)</label>
                <input type="file" accept="image/*" onChange={(e) => setEditDraft((d) => ({...d, imageFile: e.target.files[0], imageLink: ''}))} style={{marginBottom: 12}} />
                <input className="input" placeholder="Or paste a direct image URL (ends in .jpg/.png, not a webpage)" value={editDraft.imageLink} onChange={(e) => setEditDraft((d) => ({...d, imageLink: e.target.value, imageFile: null}))} />
                {p.category !== 'Cake' && (
                  <div className="tab-row">
                    <button type="button" className={`tab ${editDraft.isVeg ? 'active' : ''}`} style={editDraft.isVeg ? {background: '#2e7d32'} : undefined} onClick={() => setEditDraft((d) => ({...d, isVeg: true}))}>🟢 Veg</button>
                    <button type="button" className={`tab ${!editDraft.isVeg ? 'active' : ''}`} style={!editDraft.isVeg ? {background: '#c62828'} : undefined} onClick={() => setEditDraft((d) => ({...d, isVeg: false}))}>🔴 Non-veg</button>
                  </div>
                )}
                <div style={{display: 'flex', gap: 8}}>
                  <button className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                  <button className="btn" onClick={() => saveEdit(p._id)} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save'}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
                    <div style={{width: 48, height: 48, borderRadius: 8, background: '#f6f3f0', flexShrink: 0, overflow: 'hidden'}}>
                      {p.imageUrl && <img src={imageUri(p.imageUrl)} alt="" onError={(e) => { e.target.style.display = 'none'; }} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
                    </div>
                    <div><strong>{p.category !== 'Cake' ? (p.isVeg !== false ? '🟢 ' : '🔴 ') : ''}{p.name}</strong><br /><span className="muted">₹{p.basePrice}</span></div>
                  </div>
                  <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '8px 12px', background: p.available ? '#2e7d32' : '#c62828'}} onClick={() => toggleStock(p)}>
                    {p.available ? '✅ In stock' : '⏸️ Out of stock'}
                  </button>
                </div>
                <div style={{display: 'flex', gap: 16, marginTop: 8}}>
                  <button className="link" style={{margin: 0}} onClick={() => startEdit(p)}>✏️ Edit</button>
                  <button className="link" style={{margin: 0, color: '#c62828'}} onClick={() => deleteItem(p)}>🗑️ Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
