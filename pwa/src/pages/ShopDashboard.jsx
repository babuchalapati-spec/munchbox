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
  const [newItem, setNewItem] = useState({name: '', category: 'Cake', basePrice: '', addOns: '', imageLink: '', imageFile: null});
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({name: '', basePrice: ''});
  const [savingEdit, setSavingEdit] = useState(false);

  const shopId = user?.shop?._id || user?.shop;

  async function refresh() {
    try {
      const [ordersRes, partnersRes, productsRes, ledgerRes, paymentRes, shopRes] = await Promise.all([
        client.get('/orders'),
        client.get('/orders/delivery-partners'),
        client.get('/products', {params: {shop: shopId}}),
        client.get('/auth/ledger'),
        client.get('/settings/payment-info'),
        shopId ? client.get(`/shops/${shopId}`) : Promise.resolve({data: {shop: null}}),
      ]);
      setOrders(ordersRes.data.orders);
      setPartners(partnersRes.data.partners);
      setProducts(productsRes.data.products);
      setLedger(ledgerRes.data);
      setPaymentInfo(paymentRes.data.payments);
      setShop(shopRes.data.shop);
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
      });
      setNewItem({name: '', category: 'Cake', basePrice: '', addOns: '', imageLink: '', imageFile: null});
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
    setEditDraft({name: product.name, basePrice: String(product.basePrice)});
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
      await client.put(`/products/${productId}`, {name: editDraft.name.trim(), basePrice: Number(editDraft.basePrice)});
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

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>🏪 {user?.name}</h2>
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
              <div className="muted">Total: ₹{order.totalAmount} · {order.payment?.method === 'online' ? `Online (${order.payment.status})` : 'Cash on Delivery'}</div>
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
                    <div><strong>{p.name}</strong><br /><span className="muted">₹{p.basePrice}</span></div>
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
