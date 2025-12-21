const express = require('express');
const Outfit = require('../models/Outfit');

const router = express.Router();

/**
 * GET /outfits?userId=123
 * Get all outfits for a user
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const outfits = await Outfit.find({ userId })
      .sort({ favorite: -1, updatedAt: -1 })
      .populate('items.itemId');

    res.json({ outfits });
  } catch (err) {
    console.error('GET /outfits error', err);
    res.status(500).json({ error: 'Failed to load outfits' });
  }
});

/**
 * GET /outfits/:id
 * Get a single outfit
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const outfit = await Outfit.findById(id).populate('items.itemId');

    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    res.json({ outfit });
  } catch (err) {
    console.error('GET /outfits/:id error', err);
    res.status(500).json({ error: 'Failed to load outfit' });
  }
});

/**
 * POST /outfits
 * Create a new outfit (with duplicate detection)
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      name,
      description,
      items,
      occasion,
      season,
      weather,
      tags,
      imageUrl,
    } = req.body;

    if (!userId || !name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'userId, name, and items array are required' });
    }

    // Check for duplicate outfit (same items)
    const itemIds = items.map((item) => item.itemId.toString()).sort();
    const existingOutfits = await Outfit.find({ userId });
    
    const duplicate = existingOutfits.find((outfit) => {
      const existingItemIds = outfit.items
        .map((item) => item.itemId.toString())
        .sort();
      // Check if arrays have same length and same items
      return (
        existingItemIds.length === itemIds.length &&
        existingItemIds.every((id, idx) => id === itemIds[idx])
      );
    });

    if (duplicate) {
      return res.status(409).json({ 
        error: 'This outfit is already saved',
        existingOutfitId: duplicate._id.toString(),
      });
    }

    const outfit = await Outfit.create({
      userId,
      name,
      description,
      items,
      occasion,
      season,
      weather,
      tags,
      imageUrl,
    });

    res.status(201).json({ outfit });
  } catch (err) {
    console.error('POST /outfits error', err);
    res.status(500).json({ error: 'Failed to create outfit' });
  }
});

/**
 * PATCH /outfits/:id
 * Update an outfit
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const outfit = await Outfit.findByIdAndUpdate(id, updates, { new: true });
    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    res.json({ outfit });
  } catch (err) {
    console.error('PATCH /outfits/:id error', err);
    res.status(500).json({ error: 'Failed to update outfit' });
  }
});

/**
 * DELETE /outfits/:id
 * Delete an outfit
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Outfit.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /outfits/:id error', err);
    res.status(500).json({ error: 'Failed to delete outfit' });
  }
});

module.exports = router;

