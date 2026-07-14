const express = require('express');
const { searchAddress, reverseGeocode } = require('../utils/geo');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Address -> list of matching places (user picks the right one, so the map point is exact).
router.get(
  '/search',
  protect,
  asyncHandler(async (req, res) => {
    const results = await searchAddress(req.query.q, Number(req.query.limit) || 5);
    res.json({ results });
  })
);

// Coordinates -> address (used after grabbing GPS, to show the user where they are).
router.get(
  '/reverse',
  protect,
  asyncHandler(async (req, res) => {
    const place = await reverseGeocode(Number(req.query.lat), Number(req.query.lng));
    res.json({ place });
  })
);

module.exports = router;
