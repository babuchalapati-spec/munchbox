import {useNavigate} from 'react-router-dom';
import {useCart} from '../context/CartContext';

export default function Cart() {
  const {items, shop, total, updateQuantity, removeItem} = useCart();
  const navigate = useNavigate();

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>Your cart</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {items.length === 0 ? (
          <p className="muted">Your cart is empty.</p>
        ) : (
          <>
            {shop && <p className="muted">🏪 {shop.name}</p>}
            {items.map((item) => (
              <div key={item.key} className="card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 700}}>{item.name}</div>
                  {item.weight && <div className="muted">{item.weight}</div>}
                  <div className="muted">₹{item.price} each</div>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                  <button className="tab" style={{width: 32, flex: '0 0 auto'}} onClick={() => updateQuantity(item.key, -1)}>−</button>
                  <span>{item.quantity}</span>
                  <button className="tab" style={{width: 32, flex: '0 0 auto'}} onClick={() => updateQuantity(item.key, 1)}>+</button>
                </div>
              </div>
            ))}
            <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12, fontSize: 16}}>
              <span>Items total</span>
              <span>₹{total}</span>
            </div>
          </>
        )}
      </div>
      {items.length > 0 && (
        <div style={{position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e6e0da', padding: 16}}>
          <button className="btn" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
        </div>
      )}
    </div>
  );
}
