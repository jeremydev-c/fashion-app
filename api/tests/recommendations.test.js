const recommendationsRouter = require('../routes/recommendations');

const {
  getWardrobeProfile,
  pairCompat,
  makeCandidate,
  formatResults,
  appendFallbackResponses,
} = recommendationsRouter.__testables;

function buildContext(wardrobe, overrides = {}) {
  return {
    wardrobe,
    wardrobeProfile: getWardrobeProfile(wardrobe),
    wardrobeById: new Map(wardrobe.map((item) => [item._id, item])),
    semanticProfileMap: new Map(),
    styleDNA: null,
    preferences: null,
    savedOutfits: [],
    recentFeedback: [],
    rejectedItemIds: new Set(),
    likedItemIds: new Set(),
    occasion: 'work',
    timeOfDay: 'afternoon',
    weather: 'warm',
    weatherDetail: {},
    limit: 2,
    requestVariant: 'test',
    requestSeed: 'test-seed',
    forecast: {
      needsLayers: false,
      hasRainRisk: false,
      tempSwing: 0,
    },
    ...overrides,
  };
}

// ─── pairCompat ─────────────────────────────────────────────────────────────

describe('pairCompat', () => {
  test('rewards semantically aligned tailoring over mismatched casual pieces', () => {
    const silkShirt = {
      _id: 'silk-shirt',
      name: 'Navy Silk Shirt',
      category: 'top',
      subcategory: 'button-down shirt',
      color: 'navy blue',
      style: 'formal',
      pattern: 'solid',
      fit: 'slim',
      tags: ['silk', 'tailored', 'polished'],
    };
    const formalTrouser = {
      _id: 'formal-trouser',
      name: 'Black Tailored Trouser',
      category: 'bottom',
      subcategory: 'tailored trouser',
      color: 'black',
      style: 'formal',
      pattern: 'solid',
      fit: 'slim',
      tags: ['wool', 'tailored', 'polished'],
    };
    const distressedJean = {
      _id: 'distressed-jean',
      name: 'Distressed Denim Jean',
      category: 'bottom',
      subcategory: 'ripped jeans',
      color: 'light blue',
      style: 'streetwear',
      pattern: 'solid',
      fit: 'relaxed',
      tags: ['denim', 'distressed', 'casual'],
    };

    const ctx = buildContext([silkShirt, formalTrouser, distressedJean], { occasion: 'formal' });
    const aligned = pairCompat(silkShirt, formalTrouser, null, 'formal', ctx);
    const mismatched = pairCompat(silkShirt, distressedJean, null, 'formal', ctx);

    expect(aligned).toBeGreaterThan(mismatched + 0.12);
  });
});

// ─── makeCandidate ──────────────────────────────────────────────────────────

describe('makeCandidate', () => {
  test('attaches semantic cohesion and embedding data', () => {
    const outfitItems = [
      {
        _id: 'blazer',
        name: 'Black Tailored Blazer',
        category: 'outerwear',
        subcategory: 'single-breasted blazer',
        color: 'black',
        style: 'formal',
        pattern: 'solid',
        fit: 'slim',
        tags: ['wool', 'tailored', 'polished'],
      },
      {
        _id: 'shirt',
        name: 'Ivory Silk Blouse',
        category: 'top',
        subcategory: 'silk blouse',
        color: 'ivory',
        style: 'formal',
        pattern: 'solid',
        fit: 'fitted',
        tags: ['silk', 'elegant', 'polished'],
      },
      {
        _id: 'trouser',
        name: 'Black Tailored Trouser',
        category: 'bottom',
        subcategory: 'tailored trouser',
        color: 'black',
        style: 'formal',
        pattern: 'solid',
        fit: 'slim',
        tags: ['wool', 'tailored', 'classic'],
      },
      {
        _id: 'loafer',
        name: 'Leather Loafer',
        category: 'shoes',
        subcategory: 'loafer',
        color: 'black',
        style: 'formal',
        pattern: 'solid',
        fit: 'fitted',
        tags: ['leather', 'polished', 'classic'],
      },
    ];

    const ctx = buildContext(outfitItems, { occasion: 'work' });
    const candidate = makeCandidate(outfitItems, ctx);

    expect(candidate.semanticEmbedding).toHaveLength(10);
    expect(candidate.semanticCohesion).toBeGreaterThanOrEqual(0);
    expect(candidate.semanticCohesion).toBeLessThanOrEqual(1);
    expect(candidate.score).toBeGreaterThanOrEqual(0.4);
    expect(candidate.score).toBeLessThanOrEqual(0.96);
    expect(Array.isArray(candidate.reasons)).toBe(true);
  });
});

// ─── formatResults ──────────────────────────────────────────────────────────

describe('formatResults', () => {
  test('rejects semantically duplicated outfits even when core items are unique', () => {
    const outfitAItems = [
      { _id: 'a-top', name: 'Navy Silk Shirt', category: 'top', subcategory: 'button-down shirt', color: 'navy blue', style: 'formal', pattern: 'solid', fit: 'slim', tags: ['silk', 'tailored', 'polished'] },
      { _id: 'a-bottom', name: 'Black Tailored Trouser', category: 'bottom', subcategory: 'tailored trouser', color: 'black', style: 'formal', pattern: 'solid', fit: 'slim', tags: ['wool', 'tailored', 'classic'] },
      { _id: 'a-shoe', name: 'Black Loafer', category: 'shoes', subcategory: 'loafer', color: 'black', style: 'formal', pattern: 'solid', fit: 'fitted', tags: ['leather', 'polished'] },
    ];
    const outfitBItems = [
      { _id: 'b-top', name: 'Burgundy Satin Blouse', category: 'top', subcategory: 'satin blouse', color: 'burgundy', style: 'formal', pattern: 'solid', fit: 'fitted', tags: ['satin', 'elegant', 'polished'] },
      { _id: 'b-bottom', name: 'Cream Tailored Trouser', category: 'bottom', subcategory: 'tailored trouser', color: 'cream', style: 'formal', pattern: 'solid', fit: 'slim', tags: ['tailored', 'polished', 'classic'] },
      { _id: 'b-shoe', name: 'Cream Pump', category: 'shoes', subcategory: 'pump', color: 'cream', style: 'formal', pattern: 'solid', fit: 'fitted', tags: ['leather', 'elegant'] },
    ];
    const outfitCItems = [
      { _id: 'c-top', name: 'Distressed Denim Shirt', category: 'top', subcategory: 'overshirt', color: 'light blue', style: 'streetwear', pattern: 'solid', fit: 'oversized', tags: ['denim', 'distressed', 'casual'] },
      { _id: 'c-bottom', name: 'Charcoal Wide Trouser', category: 'bottom', subcategory: 'wide trouser', color: 'charcoal', style: 'modern', pattern: 'solid', fit: 'relaxed', tags: ['textured', 'modern', 'relaxed'] },
      { _id: 'c-shoe', name: 'White Sneaker', category: 'shoes', subcategory: 'sneaker', color: 'white', style: 'streetwear', pattern: 'solid', fit: 'fitted', tags: ['casual', 'clean', 'everyday'] },
    ];

    const wardrobe = [...outfitAItems, ...outfitBItems, ...outfitCItems];
    const ctx = buildContext(wardrobe, { limit: 2, occasion: 'date' });
    const candidateA = makeCandidate(outfitAItems, ctx);
    const candidateB = makeCandidate(outfitBItems, ctx);
    const candidateC = makeCandidate(outfitCItems, ctx);

    candidateA.score = 0.94;
    candidateB.score = 0.93;
    candidateC.score = 0.88;
    candidateB.semanticEmbedding = [...candidateA.semanticEmbedding];

    const results = formatResults([candidateA, candidateB, candidateC], ctx);
    const topIds = results.map((result) => result.items.find((item) => item.category === 'top')?.id);

    expect(results).toHaveLength(2);
    expect(topIds).toEqual(['a-top', 'c-top']);
  });
});

// ─── appendFallbackResponses ────────────────────────────────────────────────

describe('appendFallbackResponses', () => {
  test('fills missing AI results up to the requested limit', () => {
    const aiPicked = [
      {
        id: 'hybrid-1',
        items: [
          { id: 'top-a', category: 'top' },
          { id: 'bottom-a', category: 'bottom' },
          { id: 'shoe-a', category: 'shoes' },
        ],
        title: 'AI Pick',
      },
    ];
    const fallback = [
      {
        id: 'fallback-dup',
        items: [
          { id: 'top-a', category: 'top' },
          { id: 'bottom-a', category: 'bottom' },
          { id: 'shoe-a', category: 'shoes' },
        ],
        title: 'Duplicate of AI pick',
      },
      {
        id: 'fallback-2',
        items: [
          { id: 'top-b', category: 'top' },
          { id: 'bottom-b', category: 'bottom' },
          { id: 'shoe-a', category: 'shoes' },
        ],
        title: 'Fallback Two',
      },
      {
        id: 'fallback-3',
        items: [
          { id: 'top-c', category: 'top' },
          { id: 'bottom-c', category: 'bottom' },
          { id: 'shoe-a', category: 'shoes' },
        ],
        title: 'Fallback Three',
      },
    ];

    const merged = appendFallbackResponses(aiPicked, fallback, 3);

    expect(merged).toHaveLength(3);
    expect(merged.map((result) => result.id)).toEqual(['hybrid-1', 'fallback-2', 'fallback-3']);
  });
});
