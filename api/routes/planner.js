const express = require('express');
const PlannedOutfit = require('../models/PlannedOutfit');

const router = express.Router();

// GET /planner?userId=123
// Optionally filter by date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { userId, date } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const query = { userId };
    if (date) {
      query.date = date;
    }

    const plans = await PlannedOutfit.find(query).sort({ date: 1, createdAt: -1 });
    res.json({ plans });
  } catch (err) {
    console.error('GET /planner error', err);
    res.status(500).json({ error: 'Failed to load planned outfits' });
  }
});

// POST /planner
// Body: { userId, date(YYYY-MM-DD), title, occasion, timeOfDay, itemIds, notes }
router.post('/', async (req, res) => {
  try {
    const { userId, date, title, occasion, timeOfDay, itemIds, notes } = req.body || {};
    if (!userId || !date || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res
        .status(400)
        .json({ error: 'userId, date and at least one itemId are required' });
    }

    const plan = await PlannedOutfit.create({
      userId,
      date,
      title,
      occasion,
      timeOfDay,
      itemIds,
      notes,
    });

    res.status(201).json({ plan });
  } catch (err) {
    console.error('POST /planner error', err);
    res.status(500).json({ error: 'Failed to save planned outfit' });
  }
});

// DELETE /planner/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PlannedOutfit.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Planned outfit not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /planner/:id error', err);
    res.status(500).json({ error: 'Failed to delete planned outfit' });
  }
});

module.exports = router;



