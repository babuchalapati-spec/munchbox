import { useEffect, useState } from 'react';
import { getFinanceOverview, listExpenses, createExpense, deleteExpense } from '../../api/finance';
import { getSettings, updateSettings } from '../../api/settings';

const emptyExpense = { description: '', amount: '', category: 'general' };

export default function Finance() {
  const [overview, setOverview] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [taxPercent, setTaxPercent] = useState('0');
  const [savingTax, setSavingTax] = useState(false);
  const [form, setForm] = useState(emptyExpense);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const [overviewData, expensesData, settings] = await Promise.all([
        getFinanceOverview(),
        listExpenses(),
        getSettings(),
      ]);
      setOverview(overviewData);
      setExpenses(expensesData);
      setTaxPercent(String(settings.finance?.taxPercent ?? 0));
    } catch (err) {
      setError('Could not load finance data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function saveTax(e) {
    e.preventDefault();
    setSavingTax(true);
    setError('');
    setMessage('');
    try {
      await updateSettings({ finance: { taxPercent: Number(taxPercent) || 0 } });
      setMessage('Tax rate saved.');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save tax rate');
    } finally {
      setSavingTax(false);
    }
  }

  async function addExpense(e) {
    e.preventDefault();
    if (!form.description || !form.amount) {
      setError('Description and amount are required');
      return;
    }
    setError('');
    try {
      await createExpense({ description: form.description, amount: Number(form.amount), category: form.category });
      setForm(emptyExpense);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add expense');
    }
  }

  async function removeExpense(id) {
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(id);
    await refresh();
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Finance</h1>
      <p className="muted">
        Revenue here is the platform's own commission income — not the order value, which belongs to the shop or
        customer.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p style={{ color: '#2e7d32' }}>{message}</p>}

      <div className="grid two" style={{ marginBottom: 20 }}>
        <div className="card">
          <strong>Shop commission revenue</strong>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>₹{overview.shopRevenue.toFixed(2)}</div>
        </div>
        <div className="card">
          <strong>Delivery commission revenue</strong>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>₹{overview.deliveryRevenue.toFixed(2)}</div>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Not broken down by area — daily-minimum commission isn't tied to a single order/shop.
          </p>
        </div>
      </div>

      <h2>Revenue by area (shop commission)</h2>
      {overview.revenueByArea.length === 0 ? (
        <p className="muted">No commission revenue recorded yet.</p>
      ) : (
        <table className="table" style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Area</th>
              <th>Revenue</th>
              <th>Commission entries</th>
            </tr>
          </thead>
          <tbody>
            {overview.revenueByArea.map((a) => (
              <tr key={a.area}>
                <td>{a.area}</td>
                <td>₹{a.shopRevenue.toFixed(2)}</td>
                <td>{a.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ marginTop: -12, marginBottom: 24 }}>
        Area is taken from the last part of each shop's address — as accurate as the addresses shops entered.
      </p>

      <h2>Tax rate</h2>
      <form onSubmit={saveTax} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 24 }}>
        <label>
          Tax on revenue (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
          />
        </label>
        <button type="submit" disabled={savingTax}>
          {savingTax ? 'Saving...' : 'Save'}
        </button>
      </form>

      <h2>Expenses</h2>
      <form className="card form" onSubmit={addExpense} style={{ marginBottom: 20 }}>
        <div className="form-grid">
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Server hosting"
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>
          <label>
            Category
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="general"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit">Add expense</button>
        </div>
      </form>

      {expenses.length === 0 ? (
        <p className="muted">No expenses recorded yet.</p>
      ) : (
        <table className="table" style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e._id}>
                <td>{new Date(e.date).toLocaleDateString()}</td>
                <td>{e.description}</td>
                <td>{e.category}</td>
                <td>₹{Number(e.amount).toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => removeExpense(e._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Profit & Loss</h2>
      <div className="card">
        <div className="summaryRow">Total revenue: ₹{overview.totalRevenue.toFixed(2)}</div>
        <div className="summaryRow">
          Tax ({overview.taxPercent}%): -₹{overview.taxAmount.toFixed(2)}
        </div>
        <div className="summaryRow">Total expenses: -₹{overview.totalExpenses.toFixed(2)}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: 10, color: overview.netProfit >= 0 ? '#2e7d32' : '#c62828' }}>
          Net profit: ₹{overview.netProfit.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
