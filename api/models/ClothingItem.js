const mongoose = require('mongoose');

const SemanticAxesSchema = new mongoose.Schema(
  {
    formality: { type: Number, min: 0, max: 1 },
    structure: { type: Number, min: 0, max: 1 },
    texture: { type: Number, min: 0, max: 1 },
    boldness: { type: Number, min: 0, max: 1 },
    softness: { type: Number, min: 0, max: 1 },
    warmth: { type: Number, min: 0, max: 1 },
    polish: { type: Number, min: 0, max: 1 },
    ruggedness: { type: Number, min: 0, max: 1 },
    minimalism: { type: Number, min: 0, max: 1 },
    versatility: { type: Number, min: 0, max: 1 },
  },
  { _id: false },
);

const SemanticProfileSchema = new mongoose.Schema(
  {
    summary: { type: String },
    materials: [{ type: String }],
    texture: { type: String },
    silhouette: { type: String },
    structure: { type: String },
    dressCode: { type: String },
    aesthetics: [{ type: String }],
    vibeKeywords: [{ type: String }],
    pairingKeywords: [{ type: String }],
    axes: { type: SemanticAxesSchema },
    embedding: [{ type: Number }],
    embeddingVersion: { type: String },
    sourceModel: { type: String },
    generatedAt: { type: Date },
  },
  { _id: false },
);

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
    hexColors: [{ type: String }], // Hex codes from vision analysis (e.g., "#1B2A4A")
    colorTemperature: { type: String, enum: ['warm', 'cool', 'neutral'] }, // Visual tone
    printScale: { type: String, enum: ['micro', 'small', 'medium', 'large', 'oversized'] },
    fabricSurface: { type: String, enum: ['matte', 'satin', 'glossy', 'metallic', 'sheer', 'nubby', 'brushed', 'waxed'] },
    visualWeight: { type: Number, min: 0, max: 1 }, // 0=airy/sheer, 1=heavy/dense
    layeringRole: { type: String, enum: ['base', 'mid', 'outer', 'standalone'] },
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
    semanticProfile: { type: SemanticProfileSchema },
  },
  {
    timestamps: true,
  },
);

ClothingItemSchema.index({ userId: 1, favorite: -1, updatedAt: -1 });
// Add compound indexes for frequent Wardrobe filtering queries
ClothingItemSchema.index({ userId: 1, category: 1 });
ClothingItemSchema.index({ userId: 1, color: 1 });
ClothingItemSchema.index({ userId: 1, category: 1, color: 1 });

module.exports = mongoose.model('ClothingItem', ClothingItemSchema);
