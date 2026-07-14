const express = require('express');
const { listExpenses, createExpense, deleteExpense, getOverview } = require('../controllers/financeController');
const { protect, adminOnly } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Revenue by area + P&L — admin only, since this is the platform's own financials.
router.get('/overview', protect, adminOnly, asyncHandler(getOverview));
router.get('/expenses', protect, adminOnly, asyncHandler(listExpenses));
router.post('/expenses', protect, adminOnly, asyncHandler(createExpense));
router.delete('/expenses/:id', protect, adminOnly, asyncHandler(deleteExpense));

module.exports = router;
