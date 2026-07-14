const mongoose = require('mongoose');

// Admin-entered operating costs (hosting, marketing, etc.) — subtracted from
// platform commission revenue in the P&L overview.
const expenseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, default: 'general' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
