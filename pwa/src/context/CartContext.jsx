import React, {createContext, useContext, useMemo, useState} from 'react';

const CartContext = createContext(null);

// The cart holds items from a single shop at a time (one shop per order).
export function CartProvider({children}) {
  const [items, setItems] = useState([]);
  const [shop, setShop] = useState(null); // { _id, name, location, perKmRate }

  function addItem(item, itemShop) {
    if (shop && itemShop && itemShop._id !== shop._id) {
      return {conflict: true, currentShop: shop, newShop: itemShop};
    }
    if (!shop && itemShop) setShop(itemShop);
    setItems((prev) => [...prev, {...item, key: `${Date.now()}-${Math.random()}`}]);
    return {ok: true};
  }

  function replaceWith(item, itemShop) {
    setShop(itemShop || null);
    setItems([{...item, key: `${Date.now()}-${Math.random()}`}]);
  }

  function removeItem(key) {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      if (next.length === 0) setShop(null);
      return next;
    });
  }

  function updateQuantity(key, delta) {
    setItems((prev) => {
      const next = prev
        .map((i) => (i.key === key ? {...i, quantity: i.quantity + delta} : i))
        .filter((i) => i.quantity > 0);
      if (next.length === 0) setShop(null);
      return next;
    });
  }

  function clear() {
    setItems([]);
    setShop(null);
  }

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{items, shop, addItem, replaceWith, removeItem, updateQuantity, clear, total}}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
