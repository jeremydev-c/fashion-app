const mongoose = require('mongoose');

const ClothingItemSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'other'],
      required: true,
    },
    subcategory: { type: String }, // e.g., "v-neck t-shirt", "skinny jeans"
    color: { type: String },
    colorPalette: [{ type: String }], // Array of colors in the item
    brand: { type: String },
    size: { type: String },
    imageUrl: { type: String },
    thumbnailUrl: { type: String }, // Cloudinary thumbnail
    mediumUrl: { type: String }, // Cloudinary medium size
    cloudinaryPublicId: { type: String }, // For Cloudinary management
    tags: [{ type: String }],
    style: { type: String }, // casual, formal, sporty, etc.
    pattern: { type: String }, // solid, striped, printed, etc.
    fit: { type: String }, // loose, fitted, oversized, etc.
    occasion: [{ type: String }], // work, party, date, etc.
    favorite: { type: Boolean, default: false },
    wearCount: { type: Number, default: 0 },
    lastWorn: { type: Date },
    // AI metadata
    aiConfidence: { type: Number, min: 0, max: 1 }, // AI detection confidence
    aiProcessed: { type: Boolean, default: false }, // Whether AI has processed this
  },
  {
    timestamps: true,
  },
);

ClothingItemSchema.index({ userId: 1, favorite: -1, updatedAt: -1 });

module.exports = mongoose.model('ClothingItem', ClothingItemSchema);



