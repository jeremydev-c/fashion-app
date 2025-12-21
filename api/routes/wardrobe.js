const express = require('express');
const ClothingItem = require('../models/ClothingItem');

const router = express.Router();

// Simple placeholder auth: later we’ll use real user auth; for now accept userId param/body.

// GET /wardrobe/items?userId=123 (userId optional for now)
router.get('/items', async (req, res) => {
  try {
    const { userId } = req.query;
    const query = userId ? { userId } : {};
    const items = await ClothingItem.find(query).sort({ favorite: -1, updatedAt: -1 });
    res.json({ items });
  } catch (err) {
    console.error('GET /wardrobe/items error', err);
    res.status(500).json({ error: 'Failed to load wardrobe items' });
  }
});

// POST /wardrobe/items
router.post('/items', async (req, res) => {
  try {
    const { userId, name, category, color, brand, size, imageUrl, tags, favorite } = req.body;
    if (!userId || !name || !category) {
      return res.status(400).json({ error: 'userId, name and category are required' });
    }

    const item = await ClothingItem.create({
      userId,
      name,
      category,
      color,
      brand,
      size,
      imageUrl,
      tags,
      favorite: !!favorite,
    });

    res.status(201).json({ item });
  } catch (err) {
    console.error('POST /wardrobe/items error', err);
    res.status(500).json({ error: 'Failed to create wardrobe item' });
  }
});

// PATCH /wardrobe/items/:id
router.patch('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const item = await ClothingItem.findByIdAndUpdate(id, updates, { new: true });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item });
  } catch (err) {
    console.error('PATCH /wardrobe/items/:id error', err);
    res.status(500).json({ error: 'Failed to update wardrobe item' });
  }
});

// DELETE /wardrobe/items/:id
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ClothingItem.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /wardrobe/items/:id error', err);
    res.status(500).json({ error: 'Failed to delete wardrobe item' });
  }
});

module.exports = router;


