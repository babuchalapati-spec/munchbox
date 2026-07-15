import {useEffect, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import client, {imageUri} from '../api/client';
import {useCart} from '../context/CartContext';

function customizationKind(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('cake')) return 'cake';
  if (c.includes('cater')) return 'catering';
  return 'food';
}

export default function ProductDetail() {
  const {id} = useParams();
  const navigate = useNavigate();
  const {addItem, replaceWith} = useCart();
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [weight, setWeight] = useState('');
  const [flavor, setFlavor] = useState('');
  const [messageOnCake, setMessageOnCake] = useState('');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [conflict, setConflict] = useState(null);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    client.get(`/products/${id}`).then(({data}) => {
      setProduct(data.product);
      setWeight(data.product.weightOptions?.[0]?.label || '');
      return client.get(`/shops/${data.product.shop}`);
    }).then(({data}) => setShop(data.shop));
  }, [id]);

  if (!product) return <div className="screen page-pad">Loading…</div>;

  const kind = customizationKind(product.category);
  const weightDelta = weight ? (product.weightOptions?.find((w) => w.label === weight)?.priceDelta || 0) : 0;
  const unitPrice = product.basePrice + weightDelta;
  const outOfStock = !product.available;

  function buildItem() {
    return {
      product: product._id,
      name: product.name,
      weight: weight || undefined,
      flavor: kind === 'cake' ? flavor || undefined : undefined,
      messageOnCake: kind === 'cake' ? messageOnCake || undefined : undefined,
      notes: notes || undefined,
      quantity,
      price: unitPrice,
    };
  }

  function handleAdd() {
    if (kind === 'cake' && !flavor.trim()) {
      setValidationError('Please choose a flavour for this cake.');
      return;
    }
    if (kind === 'cake' && !messageOnCake.trim()) {
      setValidationError('Please enter what should be written on the cake (or type "None").');
      return;
    }
    setValidationError('');
    const result = addItem(buildItem(), shop);
    if (result.conflict) {
      setConflict(result);
      return;
    }
    navigate('/cart');
  }

  function confirmReplace() {
    replaceWith(buildItem(), shop);
    setConflict(null);
    navigate('/cart');
  }

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{kind !== 'cake' ? (product.isVeg !== false ? '🟢 ' : '🔴 ') : ''}{product.name}</h2>
      </div>
      <div className="page-pad" style={{flex: 1, paddingBottom: 90}}>
        {product.imageUrl && <img src={imageUri(product.imageUrl)} alt="" onError={(e) => { e.target.style.display = 'none'; }} style={{width: '100%', height: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 16}} />}
        <p className="muted">{product.description}</p>
        {outOfStock && <p className="error">Currently out of stock at this shop</p>}

        {product.weightOptions?.length > 0 && (
          <>
            <label className="label">Weight / size</label>
            <div className="tab-row" style={{flexWrap: 'wrap'}}>
              {product.weightOptions.map((w) => (
                <button key={w.label} className={`tab ${weight === w.label ? 'active' : ''}`} onClick={() => setWeight(w.label)} style={{flex: '0 0 auto', padding: '8px 14px'}}>
                  {w.label}{w.priceDelta ? ` (+₹${w.priceDelta})` : ''}
                </button>
              ))}
            </div>
          </>
        )}

        {kind === 'cake' && (
          <>
            <label className="label">Flavor *</label>
            <input className="input" value={flavor} onChange={(e) => setFlavor(e.target.value)} placeholder="e.g. Chocolate, Vanilla" />
            <label className="label">Message on cake *</label>
            <input className="input" value={messageOnCake} onChange={(e) => setMessageOnCake(e.target.value)} placeholder="e.g. Happy Birthday! (type None if no message)" />
          </>
        )}
        {validationError && <p className="error">{validationError}</p>}

        <label className="label">Notes (optional)</label>
        <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <label className="label">Quantity</label>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <button className="tab" style={{flex: '0 0 auto', width: 40}} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
          <span style={{fontWeight: 700, fontSize: 16}}>{quantity}</span>
          <button className="tab" style={{flex: '0 0 auto', width: 40}} onClick={() => setQuantity((q) => q + 1)}>+</button>
        </div>
      </div>

      <div style={{position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e6e0da', padding: 16}}>
        <button className="btn" onClick={handleAdd} disabled={outOfStock}>
          {outOfStock ? 'Out of stock' : `Add item · ₹${unitPrice * quantity}`}
        </button>
      </div>

      {conflict && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24}}>
          <div className="card" style={{maxWidth: 340}}>
            <p>Your cart has items from <strong>{conflict.currentShop.name}</strong>. Start a new cart with <strong>{conflict.newShop.name}</strong> instead?</p>
            <button className="btn" onClick={confirmReplace}>Start new cart</button>
            <button className="link" onClick={() => setConflict(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
