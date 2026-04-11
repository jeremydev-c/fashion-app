const {
  SEMANTIC_AXIS_KEYS,
  sanitizeSemanticProfile,
  getSemanticProfile,
  semanticSimilarity,
  semanticCompatibility,
  semanticOutfitCohesion,
  semanticOutfitSimilarity,
  summarizeSemanticProfile,
} = require('../utils/semanticStyleProfile');

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const makeItem = (overrides = {}) => ({
  name: 'Test Item',
  category: 'top',
  subcategory: '',
  color: 'black',
  style: 'casual',
  pattern: 'solid',
  fit: 'fitted',
  tags: [],
  ...overrides,
});

// ─── Axis Keys ──────────────────────────────────────────────────────────────

describe('SEMANTIC_AXIS_KEYS', () => {
  test('contains 10 axes', () => {
    expect(SEMANTIC_AXIS_KEYS).toHaveLength(10);
  });

  test('includes all expected axes', () => {
    expect(SEMANTIC_AXIS_KEYS).toContain('formality');
    expect(SEMANTIC_AXIS_KEYS).toContain('structure');
    expect(SEMANTIC_AXIS_KEYS).toContain('texture');
    expect(SEMANTIC_AXIS_KEYS).toContain('boldness');
    expect(SEMANTIC_AXIS_KEYS).toContain('polish');
    expect(SEMANTIC_AXIS_KEYS).toContain('versatility');
  });
});

// ─── sanitizeSemanticProfile ────────────────────────────────────────────────

describe('sanitizeSemanticProfile', () => {
  test('produces a valid profile from empty inputs', () => {
    const profile = sanitizeSemanticProfile({}, makeItem());
    expect(profile).toHaveProperty('summary');
    expect(profile).toHaveProperty('materials');
    expect(profile).toHaveProperty('texture');
    expect(profile).toHaveProperty('silhouette');
    expect(profile).toHaveProperty('structure');
    expect(profile).toHaveProperty('dressCode');
    expect(profile).toHaveProperty('aesthetics');
    expect(profile).toHaveProperty('axes');
    expect(profile).toHaveProperty('embedding');
    expect(profile).toHaveProperty('embeddingVersion');
  });

  test('embedding has 10 dimensions (one per axis)', () => {
    const profile = sanitizeSemanticProfile({}, makeItem());
    expect(profile.embedding).toHaveLength(10);
  });

  test('all embedding values are between 0 and 1', () => {
    const profile = sanitizeSemanticProfile({}, makeItem());
    profile.embedding.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });

  test('all axes values are between 0 and 1', () => {
    const profile = sanitizeSemanticProfile({}, makeItem());
    SEMANTIC_AXIS_KEYS.forEach(key => {
      expect(profile.axes[key]).toBeGreaterThanOrEqual(0);
      expect(profile.axes[key]).toBeLessThanOrEqual(1);
    });
  });

  test('dressCode is valid for a formal item', () => {
    const profile = sanitizeSemanticProfile({}, makeItem({ style: 'formal', name: 'Silk Blazer' }));
    expect(['formal', 'polished', 'smart-casual']).toContain(profile.dressCode);
  });

  test('dressCode is casual for a casual item', () => {
    const profile = sanitizeSemanticProfile({}, makeItem({ style: 'casual', name: 'Cotton T-Shirt' }));
    expect(profile.dressCode).toBe('casual');
  });

  test('infers denim material from name', () => {
    const profile = sanitizeSemanticProfile({}, makeItem({ name: 'Denim Jacket' }));
    expect(profile.materials).toContain('denim');
  });

  test('infers leather material from name', () => {
    const profile = sanitizeSemanticProfile({}, makeItem({ name: 'Leather Jacket' }));
    expect(profile.materials).toContain('leather');
  });

  test('preserves explicit semanticProfile raw data', () => {
    const profile = sanitizeSemanticProfile({
      summary: 'A sleek black blazer',
      materials: ['wool'],
      texture: 'crisp',
      dressCode: 'polished',
    }, makeItem());
    expect(profile.summary).toBe('A sleek black blazer');
    expect(profile.materials).toContain('wool');
    expect(profile.texture).toBe('crisp');
    expect(profile.dressCode).toBe('polished');
  });
});

// ─── getSemanticProfile ─────────────────────────────────────────────────────

describe('getSemanticProfile', () => {
  test('works with an item that has no semanticProfile field', () => {
    const profile = getSemanticProfile(makeItem());
    expect(profile).toHaveProperty('embedding');
    expect(profile.embedding).toHaveLength(10);
  });

  test('works with an item that has existing semanticProfile', () => {
    const item = makeItem({
      semanticProfile: {
        summary: 'Classic fitted tee',
        materials: ['cotton'],
        texture: 'matte',
        dressCode: 'casual',
        aesthetics: ['minimalist'],
      },
    });
    const profile = getSemanticProfile(item);
    expect(profile.summary).toBe('Classic fitted tee');
    expect(profile.materials).toContain('cotton');
  });

  test('returns consistent results for same item', () => {
    const item = makeItem({ name: 'Blue Linen Shirt', style: 'casual' });
    const p1 = getSemanticProfile(item);
    const p2 = getSemanticProfile(item);
    expect(p1.embedding).toEqual(p2.embedding);
    expect(p1.dressCode).toEqual(p2.dressCode);
    expect(p1.aesthetics).toEqual(p2.aesthetics);
  });
});

// ─── semanticSimilarity ─────────────────────────────────────────────────────

describe('semanticSimilarity', () => {
  test('identical items have high similarity', () => {
    const item = makeItem({ name: 'Black T-Shirt', style: 'casual' });
    const score = semanticSimilarity(item, item);
    expect(score).toBeGreaterThan(0.8);
  });

  test('very different items have lower similarity', () => {
    const casual = makeItem({ name: 'Distressed Denim Shorts', style: 'streetwear', fit: 'loose' });
    const formal = makeItem({ name: 'Silk Blazer', style: 'formal', fit: 'fitted', category: 'outerwear' });
    const score = semanticSimilarity(casual, formal);
    expect(score).toBeLessThan(0.8);
  });

  test('returns a value between 0 and 1', () => {
    const a = makeItem({ name: 'Red Hoodie', style: 'streetwear' });
    const b = makeItem({ name: 'White Oxford Shirt', style: 'formal' });
    const score = semanticSimilarity(a, b);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── semanticCompatibility ──────────────────────────────────────────────────

describe('semanticCompatibility', () => {
  test('matching styles are compatible', () => {
    const top = makeItem({ name: 'White Dress Shirt', style: 'formal', category: 'top' });
    const bottom = makeItem({ name: 'Tailored Trousers', style: 'formal', category: 'bottom' });
    const score = semanticCompatibility(top, bottom, 'work');
    expect(score).toBeGreaterThan(0.5);
  });

  test('occasion affects compatibility scoring', () => {
    const top = makeItem({ name: 'Cotton Tee', style: 'casual' });
    const bottom = makeItem({ name: 'Jeans', style: 'casual', category: 'bottom' });
    const casualScore = semanticCompatibility(top, bottom, 'casual');
    const formalScore = semanticCompatibility(top, bottom, 'formal');
    // Casual items should be more compatible for casual occasion
    expect(casualScore).toBeGreaterThan(formalScore);
  });

  test('returns bounded 0-1 value', () => {
    const a = makeItem();
    const b = makeItem();
    const score = semanticCompatibility(a, b, 'casual');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── semanticOutfitCohesion ─────────────────────────────────────────────────

describe('semanticOutfitCohesion', () => {
  test('returns 0.6 for single item (no pairs to compare)', () => {
    const score = semanticOutfitCohesion([makeItem()], 'casual');
    expect(score).toBe(0.6);
  });

  test('returns 0.6 for empty array', () => {
    const score = semanticOutfitCohesion([], 'casual');
    expect(score).toBe(0.6);
  });

  test('cohesive outfit scores higher than mixed outfit', () => {
    const cohesive = [
      makeItem({ style: 'formal', name: 'Dress Shirt' }),
      makeItem({ style: 'formal', name: 'Trousers', category: 'bottom' }),
      makeItem({ style: 'classic', name: 'Oxford Shoes', category: 'shoes' }),
    ];
    const mixed = [
      makeItem({ style: 'athletic', name: 'Gym Shorts', category: 'bottom', fit: 'loose' }),
      makeItem({ style: 'formal', name: 'Silk Blazer', category: 'outerwear' }),
      makeItem({ style: 'bohemian', name: 'Beaded Sandals', category: 'shoes' }),
    ];
    const cohesiveScore = semanticOutfitCohesion(cohesive, 'work');
    const mixedScore = semanticOutfitCohesion(mixed, 'work');
    expect(cohesiveScore).toBeGreaterThan(mixedScore);
  });
});

// ─── semanticOutfitSimilarity ───────────────────────────────────────────────

describe('semanticOutfitSimilarity', () => {
  test('same outfit is highly similar to itself', () => {
    const outfit = [
      makeItem({ name: 'White Tee', style: 'casual' }),
      makeItem({ name: 'Blue Jeans', style: 'casual', category: 'bottom' }),
    ];
    const score = semanticOutfitSimilarity(outfit, outfit);
    expect(score).toBeGreaterThan(0.8);
  });

  test('very different outfits have lower similarity', () => {
    const casual = [
      makeItem({ name: 'Hoodie', style: 'streetwear' }),
      makeItem({ name: 'Cargo Pants', style: 'streetwear', category: 'bottom' }),
    ];
    const formal = [
      makeItem({ name: 'Silk Blouse', style: 'elegant', category: 'top' }),
      makeItem({ name: 'Pencil Skirt', style: 'formal', category: 'bottom' }),
    ];
    const score = semanticOutfitSimilarity(casual, formal);
    expect(score).toBeLessThan(0.9);
  });
});

// ─── summarizeSemanticProfile ───────────────────────────────────────────────

describe('summarizeSemanticProfile', () => {
  test('returns all expected fields', () => {
    const summary = summarizeSemanticProfile(makeItem());
    expect(summary).toHaveProperty('summary');
    expect(summary).toHaveProperty('aesthetics');
    expect(summary).toHaveProperty('dressCode');
    expect(summary).toHaveProperty('texture');
    expect(summary).toHaveProperty('structure');
    expect(summary).toHaveProperty('silhouette');
    expect(summary).toHaveProperty('materials');
    expect(summary).toHaveProperty('vibeKeywords');
    expect(summary).toHaveProperty('pairingKeywords');
    expect(summary).toHaveProperty('axes');
    expect(summary).toHaveProperty('embedding');
  });

  test('embedding matches axes', () => {
    const summary = summarizeSemanticProfile(makeItem());
    expect(summary.embedding).toHaveLength(SEMANTIC_AXIS_KEYS.length);
  });
});
