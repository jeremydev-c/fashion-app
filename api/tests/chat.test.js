const assert = require('node:assert/strict');

const chatRouter = require('../routes/chat');

const {
  buildWardrobeBrief,
  buildWardrobeContextText,
  sanitizeAssistantMessage,
} = chatRouter.__testables;

module.exports = [
  {
    name: 'buildWardrobeBrief surfaces style identity and strategic growth areas',
    run() {
      const wardrobe = [
        {
          _id: 'blazer',
          name: 'Black Blazer',
          category: 'outerwear',
          subcategory: 'tailored blazer',
          color: 'black',
          style: 'formal',
          fit: 'slim',
          favorite: true,
          wearCount: 10,
          tags: ['wool', 'tailored', 'polished'],
        },
        {
          _id: 'shirt-a',
          name: 'Ivory Silk Shirt',
          category: 'top',
          subcategory: 'silk blouse',
          color: 'ivory',
          style: 'formal',
          fit: 'fitted',
          wearCount: 3,
          tags: ['silk', 'polished', 'elegant'],
        },
        {
          _id: 'shirt-b',
          name: 'Navy Shirt',
          category: 'top',
          subcategory: 'button-down shirt',
          color: 'navy',
          style: 'classic',
          fit: 'slim',
          wearCount: 1,
          tags: ['cotton', 'tailored', 'classic'],
        },
        {
          _id: 'shoe',
          name: 'Black Loafer',
          category: 'shoes',
          subcategory: 'loafer',
          color: 'black',
          style: 'formal',
          fit: 'fitted',
          wearCount: 4,
          tags: ['leather', 'classic', 'polished'],
        },
      ];

      const brief = buildWardrobeBrief({
        wardrobeItems: wardrobe,
        styleDNA: {
          styleArchetype: 'The Polished Minimalist',
          styleInsight: 'Your closet already has a refined, high-control energy.',
        },
        preferences: {
          preferredColors: ['black', 'ivory'],
          preferredStyles: ['classic'],
        },
        recentLearning: [],
      });

      assert.equal(brief.itemCount, 4);
      assert.equal(brief.styleArchetype, 'The Polished Minimalist');
      assert.ok(brief.palette.includes('Black'));
      assert.ok(brief.heroPieces.length > 0);
      assert.ok(brief.growthAreas.some((entry) => entry.toLowerCase().includes('bottom')));
      assert.ok(brief.stylistFocus.length > 20);
    },
  },
  {
    name: 'buildWardrobeContextText includes the stylist focus and wardrobe signals',
    run() {
      const text = buildWardrobeContextText({
        itemCount: 6,
        categories: [
          { key: 'top', label: 'Tops', count: 3 },
          { key: 'bottom', label: 'Bottoms', count: 2 },
        ],
        palette: ['Black', 'Cream'],
        styleSignatures: ['Classic', 'Minimalist'],
        dominantDressCodes: ['Polished'],
        heroPieces: ['Black Tailored Blazer'],
        underusedPieces: ['Cream Trouser'],
        wardrobeWins: ['Your wardrobe already has strong palette anchors.'],
        growthAreas: ['A polished layer would instantly elevate the wardrobe.'],
        styleArchetype: 'The Polished Minimalist',
        styleMantra: 'Build from clean lines.',
        styleInsight: 'Your wardrobe reads polished and controlled.',
        lovedColors: ['Black'],
        lovedStyles: ['Classic'],
        lovedCategories: ['Outerwear'],
        occasionSignals: ['Work'],
        stylistFocus: 'Refine your polished minimalist direction.',
      });

      assert.ok(text.includes('WARDROBE INTELLIGENCE'));
      assert.ok(text.includes('The Polished Minimalist'));
      assert.ok(text.includes('Refine your polished minimalist direction.'));
      assert.ok(text.includes('Positive preference signals'));
    },
  },
  {
    name: 'sanitizeAssistantMessage strips markdown while preserving readable text',
    run() {
      const cleaned = sanitizeAssistantMessage(
        '**Hello**\n\n- First point\n1. Second point\n`inline`\n\nPlain text',
      );

      assert.equal(cleaned, 'Hello\nFirst point\nSecond point\ninline\n\nPlain text');
    },
  },
];
