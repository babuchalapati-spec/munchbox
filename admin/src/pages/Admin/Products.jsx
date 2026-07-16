import { useEffect, useMemo, useState } from 'react';
import { listProducts, createProduct, updateProduct, deleteProduct, setProductBlocked } from '../../api/products';
import { listShops } from '../../api/shops';
import { useAuth } from '../../context/AuthContext';
import { API_ORIGIN } from '../../api/client';

const emptyForm = {
  name: '',
  description: '',
  category: '',
  basePrice: '',
  isCustomizable: false,
  available: true,
  image: null,
};

// An item photo is either a local upload (/uploads/x.jpg) or a pasted online link.
function imageSrc(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`;
}

export default function Products() {
  const { user } = useAuth();
  const isShopOwner = user?.role === 'shop';
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  const shopName = useMemo(() => {
    const map = {};
    shops.forEach((s) => {
      map[s._id] = s.name;
    });
    return map;
  }, [shops]);

  // The API populates shop as an object for admins, but a shop owner's own list may carry a plain id.
  function shopLabel(p) {
    if (p.shop && typeof p.shop === 'object') return p.shop.name;
    return shopName[p.shop] || '—';
  }

  async function refresh() {
    setLoading(true);
    try {
      const [productsData, shopsData] = await Promise.all([listProducts(), listShops()]);
      const ownShop = user?.shop?._id || user?.shop;
      setProducts(
        isShopOwner
          ? productsData.filter((p) => (p.shop?._id || p.shop) === ownShop)
          : productsData
      );
      setShops(shopsData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value,
    }));
  }

  function startEdit(product) {
    setEditingId(product._id);
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      basePrice: product.basePrice,
      isCustomizable: product.isCustomizable,
      available: product.available,
      image: null,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('description', form.description);
    fd.append('category', form.category);
    fd.append('basePrice', form.basePrice);
    fd.append('isCustomizable', form.isCustomizable);
    fd.append('available', form.available);
    if (form.image) fd.append('image', form.image);

    try {
      if (editingId) {
        await updateProduct(editingId, fd);
      } else {
        await createProduct(fd);
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return;
    await deleteProduct(id);
    await refresh();
  }

  // Admin can hide an item customers shouldn't see. It does NOT gate new items — a shop's
  // item is already live; this only pulls a bad one back down.
  async function toggleBlocked(product) {
    let reason;
    if (!product.blocked) {
      reason = window.prompt('Why are you hiding this item? (the shop will see this)', 'Not suitable');
      if (reason === null) return;
    }
    setBusyId(product._id);
    setError('');
    try {
      await setProductBlocked(product._id, !product.blocked, reason);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>{isShopOwner ? 'My menu' : 'Items across all shops'}</h1>
      <p className="muted">
        {isShopOwner
          ? 'Items you add go live for customers straight away. Untick “Available” to take one off the menu.'
          : 'Shops add and price their own items — they go live as soon as the shop adds them. You can hide an item here if something is wrong with it.'}
      </p>
      {error && <p className="error">{error}</p>}

      {isShopOwner && (
        <form className="card form" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Edit item' : 'New item'}</h2>
          <div className="form-grid">
            <label>
              Name
              <input name="name" value={form.name} onChange={handleChange} required />
            </label>
            <label>
              Category
              <select name="category" value={form.category} onChange={handleChange} required>
                <option value="">Choose a category</option>
                <option value="Cake">Cake</option>
                <option value="Food">Food</option>
                <option value="Catering">Catering</option>
              </select>
            </label>
            <label>
              Base price
              <input name="basePrice" type="number" min="0" value={form.basePrice} onChange={handleChange} required />
            </label>
            <label>
              Image
              <input name="image" type="file" accept="image/*" onChange={handleChange} />
            </label>
            <label className="checkbox">
              <input name="isCustomizable" type="checkbox" checked={form.isCustomizable} onChange={handleChange} />
              Customizable
            </label>
            <label className="checkbox">
              <input name="available" type="checkbox" checked={form.available} onChange={handleChange} />
              Available
            </label>
          </div>
          <label>
            Description
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} />
          </label>
          <div className="form-actions">
            <button type="submit">{editingId ? 'Save changes' : 'Add item'}</button>
            {editingId && (
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : products.length === 0 ? (
        <p className="muted">
          {isShopOwner ? 'No items yet — add your first one above.' : 'No shop has added any items yet.'}
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Shop</th>
              <th>Category</th>
              <th>Base price</th>
              <th>Customers see it</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id}>
                <td>{imageSrc(p.imageUrl) ? <img className="thumb" src={imageSrc(p.imageUrl)} alt={p.name} /> : '—'}</td>
                <td>{p.name}</td>
                <td>{shopLabel(p)}</td>
                <td>{p.category}</td>
                <td>₹{p.basePrice}</td>
                <td>
                  {p.blocked ? (
                    <span style={{ color: '#c62828', fontWeight: 600 }}>
                      Hidden by admin{p.blockedReason ? ` — ${p.blockedReason}` : ''}
                    </span>
                  ) : p.available ? (
                    <span style={{ color: '#2e7d32', fontWeight: 600 }}>Yes</span>
                  ) : (
                    <span className="muted">Out of stock (shop)</span>
                  )}
                </td>
                <td className="row-actions">
                  {isShopOwner ? (
                    <>
                      <button onClick={() => startEdit(p)}>Edit</button>
                      <button onClick={() => handleDelete(p._id)}>Delete</button>
                    </>
                  ) : (
                    <button onClick={() => toggleBlocked(p)} disabled={busyId === p._id}>
                      {p.blocked ? 'Unhide' : 'Hide from customers'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
