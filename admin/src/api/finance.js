import client from './client';

export async function getFinanceOverview() {
  const { data } = await client.get('/finance/overview');
  return data; // { revenueByArea, shopRevenue, deliveryRevenue, totalRevenue, totalExpenses, taxPercent, taxAmount, netProfit }
}

export async function listExpenses() {
  const { data } = await client.get('/finance/expenses');
  return data.expenses;
}

export async function createExpense(payload) {
  const { data } = await client.post('/finance/expenses', payload);
  return data.expense;
}

export async function deleteExpense(id) {
  await client.delete(`/finance/expenses/${id}`);
}
