const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const { enforceItemLimit, requireFeature } = require('../middleware/planLimits');
const { sanitizeSemanticProfile } = require('../utils/semanticStyleProfile');

const router = express.Router();

const VALID_CATEGORIES = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'other'];
const VALID_STYLES = ['casual', 'formal', 'sporty', 'streetwear', 'bohemian', 'minimalist', 'vintage', 'modern'];
const VALID_PATTERNS = ['solid', 'striped', 'printed', 'floral', 'geometric', 'abstract', 'plaid', 'polka-dot'];
const VALID_FITS = ['loose', 'fitted', 'oversized', 'relaxed', 'slim'];
const SEMANTIC_FIELDS = new Set([
  'name',
  'category',
  'subcategory',
  'color',
  'colorTemperature',
  'tags',
  'style',
  'pattern',
  'fit',
  'occasion',
  'fabricSurface',
  'visualWeight',
  'semanticProfile',
]);

function cleanString(value, maxLen = 160) {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!normalized) return undefined;
  return normalized.slice(0, maxLen);
}

function cleanStringArray(values, maxItems = 8, maxLen = 32) {
  if (!Array.isArray(values)) return undefined;
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const cleaned = cleanString(value, maxLen);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }

  return result.length > 0 ? result : undefined;
}

function cleanOptionalEnum(value, allowed) {
  const cleaned = cleanString(value, 40);
  if (!cleaned) return undefined;
  const normalized = cleaned.toLowerCase();
  return allowed.includes(normalized) ? normalized : undefined;
}

function cleanOptionalNumber(value, min = 0, max = 1) {
  if (value == null || value === '') return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return undefined;
  return Math.max(min, Math.min(max, numeric));
}

function buildWardrobeItemPayload(source = {}, { existingItem = null } = {}) {
  const existing = existingItem?.toObject ? existingItem.toObject() : existingItem || {};
  const has = (key) => Object.prototype.hasOwnProperty.call(source, key);

  const payload = {
    userId: has('userId') ? cleanString(source.userId, 100) : existing.userId,
    name: has('name') ? cleanString(source.name, 120) : existing.name,
    category: has('category')
      ? cleanOptionalEnum(source.category, VALID_CATEGORIES)
      : existing.category,
    subcategory: has('subcategory') ? cleanString(source.subcategory, 80) : existing.subcategory,
    color: has('color') ? cleanString(source.color, 40) : existing.color,
    colorPalette: has('colorPalette')
      ? cleanStringArray(source.colorPalette, 5, 30)
      : existing.colorPalette,
    brand: has('brand') ? cleanString(source.brand, 80) : existing.brand,
    size: has('size') ? cleanString(source.size, 30) : existing.size,
    imageUrl: has('imageUrl') ? cleanString(source.imageUrl, 500) : existing.imageUrl,
    thumbnailUrl: has('thumbnailUrl') ? cleanString(source.thumbnailUrl, 500) : existing.thumbnailUrl,
    mediumUrl: has('mediumUrl') ? cleanString(source.mediumUrl, 500) : existing.mediumUrl,
    cloudinaryPublicId: has('cloudinaryPublicId')
      ? cleanString(source.cloudinaryPublicId, 160)
      : existing.cloudinaryPublicId,
    hexColors: has('hexColors') ? cleanStringArray(source.hexColors, 5, 7) : existing.hexColors,
    colorTemperature: has('colorTemperature') ? cleanOptionalEnum(source.colorTemperature, ['warm', 'cool', 'neutral']) : existing.colorTemperature,
    printScale: has('printScale') ? cleanOptionalEnum(source.printScale, ['micro', 'small', 'medium', 'large', 'oversized']) : existing.printScale,
    fabricSurface: has('fabricSurface') ? cleanOptionalEnum(source.fabricSurface, ['matte', 'satin', 'glossy', 'metallic', 'sheer', 'nubby', 'brushed', 'waxed']) : existing.fabricSurface,
    visualWeight: has('visualWeight') ? cleanOptionalNumber(source.visualWeight, 0, 1) : existing.visualWeight,
    layeringRole: has('layeringRole') ? cleanOptionalEnum(source.layeringRole, ['base', 'mid', 'outer', 'standalone']) : existing.layeringRole,
    tags: has('tags') ? cleanStringArray(source.tags, 10, 24) : existing.tags,
    style: has('style') ? cleanOptionalEnum(source.style, VALID_STYLES) : existing.style,
    pattern: has('pattern') ? cleanOptionalEnum(source.pattern, VALID_PATTERNS) : existing.pattern,
    fit: has('fit') ? cleanOptionalEnum(source.fit, VALID_FITS) : existing.fit,
    occasion: has('occasion') ? cleanStringArray(source.occasion, 8, 24) : existing.occasion,
    favorite: has('favorite') ? !!source.favorite : existing.favorite,
    aiConfidence: has('aiConfidence') ? cleanOptionalNumber(source.aiConfidence) : existing.aiConfidence,
    aiProcessed: has('aiProcessed') ? !!source.aiProcessed : existing.aiProcessed,
  };

  const semanticSource = {
    ...existing,
    ...payload,
  };

  if (payload.userId && payload.name && payload.category) {
    payload.semanticProfile = sanitizeSemanticProfile(source.semanticProfile || existing.semanticProfile || {}, semanticSource);
  }

  return payload;
}

// Simple placeholder auth: later we'll use real user auth; for now accept userId param/body.

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
router.post('/items', enforceItemLimit(), async (req, res) => {
  try {
    const payload = buildWardrobeItemPayload(req.body || {});
    if (!payload.userId || !payload.name || !payload.category) {
      return res.status(400).json({ error: 'userId, name and category are required' });
    }

    const item = await ClothingItem.create(payload);
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
    const existingItem = await ClothingItem.findById(id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const payload = buildWardrobeItemPayload(req.body || {}, { existingItem });
    const updateKeys = Object.keys(req.body || {});
    const touchedSemanticFields = updateKeys.some((key) => SEMANTIC_FIELDS.has(key));

    if (!touchedSemanticFields) delete payload.semanticProfile;
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'favorite')) delete payload.favorite;
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'aiProcessed')) delete payload.aiProcessed;
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'aiConfidence')) delete payload.aiConfidence;

    const item = await ClothingItem.findByIdAndUpdate(id, payload, { new: true });
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

// GET /wardrobe/can-bulk?userId=123
// Check if user's plan allows bulk upload (used by frontend before opening bulk camera)
router.get('/can-bulk', requireFeature('bulkUpload'), (_req, res) => {
  res.json({ allowed: true });
});

module.exports = router;
