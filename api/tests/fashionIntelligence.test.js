const {
  OCCASION_PROFILES,
  TIME_PROFILES,
  checkItemAppropriateness,
  checkThreeColorRule,
  checkPatternMixing,
  checkTextureCompatibility,
  checkOccasionRules,
  checkTimeOfDayFit,
  checkProportions,
  checkSeasonalColors,
  checkWeatherCompleteness,
  checkStyleCoherence,
  checkOutfitCompleteness,
  checkTrendAlignment,
  checkVersatility,
  checkWowFactor,
  evaluateFashionIntelligence,
} = require('../utils/fashionIntelligence');

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
  occasion: [],
  brand: '',
  ...overrides,
});

const casualOutfit = [
  makeItem({ name: 'Cotton T-Shirt', category: 'top', color: 'white', style: 'casual' }),
  makeItem({ name: 'Slim Jeans', category: 'bottom', color: 'blue', style: 'casual', subcategory: 'skinny jeans' }),
  makeItem({ name: 'White Sneakers', category: 'shoes', color: 'white', style: 'casual', subcategory: 'sneakers' }),
];

const formalOutfit = [
  makeItem({ name: 'Dress Shirt', category: 'top', color: 'white', style: 'formal', subcategory: 'button-up shirt' }),
  makeItem({ name: 'Tailored Trousers', category: 'bottom', color: 'charcoal', style: 'formal', subcategory: 'tailored trouser' }),
  makeItem({ name: 'Oxford Shoes', category: 'shoes', color: 'brown', style: 'classic', subcategory: 'oxford shoes' }),
  makeItem({ name: 'Navy Blazer', category: 'outerwear', color: 'navy', style: 'formal', subcategory: 'blazer' }),
];

const gymOutfit = [
  makeItem({ name: 'Sports Bra', category: 'top', color: 'black', style: 'sporty', subcategory: 'sport bra' }),
  makeItem({ name: 'Athletic Shorts', category: 'bottom', color: 'gray', style: 'athletic', subcategory: 'gym shorts' }),
  makeItem({ name: 'Running Sneakers', category: 'shoes', color: 'blue', style: 'athletic', subcategory: 'running sneakers' }),
];

// ─── Occasion Profiles ──────────────────────────────────────────────────────

describe('Occasion Profiles', () => {
  test('all occasions have required fields', () => {
    const requiredFields = ['vibe', 'preferredStyles', 'avoidStyles', 'formalityRange', 'shoeFit'];
    Object.entries(OCCASION_PROFILES).forEach(([occasion, profile]) => {
      requiredFields.forEach(field => {
        expect(profile).toHaveProperty(field);
      });
    });
  });

  test('formality ranges are valid [min, max] pairs within 0-1', () => {
    Object.entries(OCCASION_PROFILES).forEach(([occasion, profile]) => {
      expect(profile.formalityRange[0]).toBeGreaterThanOrEqual(0);
      expect(profile.formalityRange[1]).toBeLessThanOrEqual(1);
      expect(profile.formalityRange[0]).toBeLessThanOrEqual(profile.formalityRange[1]);
    });
  });

  test('gym avoids formal styles', () => {
    expect(OCCASION_PROFILES.gym.avoidStyles).toContain('formal');
    expect(OCCASION_PROFILES.gym.avoidStyles).toContain('elegant');
  });
});

// ─── Time Profiles ──────────────────────────────────────────────────────────

describe('Time Profiles', () => {
  test('all time periods have required fields', () => {
    const requiredFields = ['vibe', 'preferLightColors', 'preferDarkColors', 'colorBoost'];
    Object.entries(TIME_PROFILES).forEach(([time, profile]) => {
      requiredFields.forEach(field => {
        expect(profile).toHaveProperty(field);
      });
    });
  });

  test('evening and night prefer dark colors', () => {
    expect(TIME_PROFILES.evening.preferDarkColors).toBe(true);
    expect(TIME_PROFILES.night.preferDarkColors).toBe(true);
  });

  test('morning prefers light colors', () => {
    expect(TIME_PROFILES.morning.preferLightColors).toBe(true);
  });
});

// ─── Item Appropriateness ───────────────────────────────────────────────────

describe('checkItemAppropriateness', () => {
  test('sneakers are appropriate for casual', () => {
    const sneaker = makeItem({ name: 'Running Sneakers', subcategory: 'sneaker' });
    const result = checkItemAppropriateness(sneaker, 'casual', 'afternoon');
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  test('flip flops are penalized for formal', () => {
    const flipFlop = makeItem({ name: 'Flip Flops', subcategory: 'flip flop' });
    const result = checkItemAppropriateness(flipFlop, 'formal', 'evening');
    expect(result.score).toBeLessThan(0.5);
  });

  test('blazer is boosted for work morning', () => {
    const blazer = makeItem({ name: 'Classic Blazer', subcategory: 'blazer', category: 'outerwear' });
    const result = checkItemAppropriateness(blazer, 'work', 'morning');
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.boost).toBeGreaterThan(0);
  });

  test('gym shoes are penalized for formal', () => {
    const gymShoe = makeItem({ name: 'Running Sneaker', subcategory: 'running sneaker' });
    const result = checkItemAppropriateness(gymShoe, 'formal', 'evening');
    expect(result.score).toBeLessThan(0.5);
  });
});

// ─── Color Rules ────────────────────────────────────────────────────────────

describe('checkThreeColorRule', () => {
  test('3 or fewer non-neutral colors is valid', () => {
    const items = [
      makeItem({ color: 'red' }),
      makeItem({ color: 'blue' }),
      makeItem({ color: 'black' }), // neutral — doesn't count
    ];
    const result = checkThreeColorRule(items);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  test('too many accent colors is penalized', () => {
    const items = [
      makeItem({ color: 'red' }),
      makeItem({ color: 'blue' }),
      makeItem({ color: 'green' }),
      makeItem({ color: 'purple' }),
      makeItem({ color: 'orange' }),
    ];
    const result = checkThreeColorRule(items);
    expect(result.score).toBeLessThanOrEqual(0.3);
  });

  test('all neutrals is perfect', () => {
    const items = [
      makeItem({ color: 'black' }),
      makeItem({ color: 'white' }),
      makeItem({ color: 'navy' }),
    ];
    const result = checkThreeColorRule(items);
    expect(result.valid).toBe(true);
    expect(result.score).toBe(1.0);
  });
});

// ─── Pattern Mixing ─────────────────────────────────────────────────────────

describe('checkPatternMixing', () => {
  test('all solid items score well', () => {
    const items = [makeItem({ pattern: 'solid' }), makeItem({ pattern: 'solid' })];
    const result = checkPatternMixing(items);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  test('one pattern on solids is perfect', () => {
    const items = [makeItem({ pattern: 'striped' }), makeItem({ pattern: 'solid' })];
    const result = checkPatternMixing(items);
    expect(result.score).toBe(1.0);
  });

  test('3+ patterns is noisy', () => {
    const items = [
      makeItem({ pattern: 'striped' }),
      makeItem({ pattern: 'floral' }),
      makeItem({ pattern: 'plaid' }),
    ];
    const result = checkPatternMixing(items);
    expect(result.score).toBeLessThanOrEqual(0.4);
  });
});

// ─── Texture Compatibility ──────────────────────────────────────────────────

describe('checkTextureCompatibility', () => {
  test('denim and cotton are compatible', () => {
    const items = [
      makeItem({ name: 'Denim Jacket' }),
      makeItem({ name: 'Cotton Tee' }),
    ];
    const result = checkTextureCompatibility(items);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });
});

// ─── Occasion Rules ─────────────────────────────────────────────────────────

describe('checkOccasionRules', () => {
  test('casual outfit scores well for casual occasion', () => {
    const result = checkOccasionRules(casualOutfit, 'casual', 'afternoon');
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0.4);
  });

  test('formal outfit scores well for work', () => {
    const result = checkOccasionRules(formalOutfit, 'work', 'morning');
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0.4);
  });

  test('incomplete outfit (just one item) fails', () => {
    const items = [makeItem({ category: 'top' })];
    const result = checkOccasionRules(items, 'casual', 'afternoon');
    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(0.3);
  });

  test('gym outfit scores well for gym', () => {
    const result = checkOccasionRules(gymOutfit, 'gym', 'morning');
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0.3);
  });
});

// ─── Time of Day Fit ────────────────────────────────────────────────────────

describe('checkTimeOfDayFit', () => {
  test('dark outfit scores well for evening', () => {
    const items = [
      makeItem({ color: 'black' }),
      makeItem({ color: 'navy' }),
      makeItem({ color: 'charcoal' }),
    ];
    const result = checkTimeOfDayFit(items, 'evening');
    expect(result.score).toBeGreaterThan(0.5);
  });

  test('light outfit scores well for morning', () => {
    const items = [
      makeItem({ color: 'white' }),
      makeItem({ color: 'cream' }),
      makeItem({ color: 'pastel blue' }),
    ];
    const result = checkTimeOfDayFit(items, 'morning');
    expect(result.score).toBeGreaterThan(0.5);
  });
});

// ─── Weather Completeness ───────────────────────────────────────────────────

describe('checkWeatherCompleteness', () => {
  test('outerwear boosts cold weather score', () => {
    const items = [
      makeItem({ name: 'Wool Sweater', category: 'top' }),
      makeItem({ name: 'Jeans', category: 'bottom' }),
      makeItem({ name: 'Boots', category: 'shoes', subcategory: 'boots' }),
      makeItem({ name: 'Puffer Jacket', category: 'outerwear' }),
    ];
    const result = checkWeatherCompleteness(items, 'cold', {});
    expect(result.score).toBeGreaterThan(0.5);
  });

  test('sandals penalized in rain', () => {
    const items = [
      makeItem({ name: 'T-shirt', category: 'top' }),
      makeItem({ name: 'Shorts', category: 'bottom' }),
      makeItem({ name: 'Sandals', category: 'shoes', subcategory: 'sandal' }),
    ];
    const result = checkWeatherCompleteness(items, 'warm', { isRainy: true });
    expect(result.score).toBeLessThan(0.6);
  });

  test('rain gear boosts rainy weather score', () => {
    const items = [
      makeItem({ name: 'T-shirt', category: 'top' }),
      makeItem({ name: 'Jeans', category: 'bottom' }),
      makeItem({ name: 'Rain Jacket', category: 'outerwear', subcategory: 'rain jacket' }),
      makeItem({ name: 'Boots', category: 'shoes', subcategory: 'boots' }),
    ];
    const result = checkWeatherCompleteness(items, 'cool', { isRainy: true });
    expect(result.score).toBeGreaterThan(0.6);
  });
});

// ─── Proportions / Silhouette ───────────────────────────────────────────────

describe('checkProportions', () => {
  test('top + bottom + shoes scores high', () => {
    const result = checkProportions(casualOutfit);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  test('multiple items of same category penalized', () => {
    const items = [
      makeItem({ category: 'top' }),
      makeItem({ category: 'top' }),
      makeItem({ category: 'top' }),
      makeItem({ category: 'bottom' }),
    ];
    const result = checkProportions(items);
    expect(result.score).toBeLessThan(0.9);
  });
});

// ─── Style Coherence ────────────────────────────────────────────────────────

describe('checkStyleCoherence', () => {
  test('same style family scores high', () => {
    const items = [
      makeItem({ style: 'classic' }),
      makeItem({ style: 'elegant' }),
      makeItem({ style: 'minimalist' }),
    ];
    const result = checkStyleCoherence(items);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  test('clashing styles score low', () => {
    const items = [
      makeItem({ style: 'athletic' }),
      makeItem({ style: 'formal' }),
      makeItem({ style: 'bohemian' }),
      makeItem({ style: 'edgy' }),
    ];
    const result = checkStyleCoherence(items);
    expect(result.score).toBeLessThan(0.8);
  });
});

// ─── Outfit Completeness ────────────────────────────────────────────────────

describe('checkOutfitCompleteness', () => {
  test('full outfit with shoes and accessories scores high', () => {
    const items = [
      ...casualOutfit,
      makeItem({ name: 'Watch', category: 'accessory' }),
    ];
    const result = checkOutfitCompleteness(items, 'casual');
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  test('no top or bottom is incomplete', () => {
    const items = [makeItem({ category: 'shoes' })];
    const result = checkOutfitCompleteness(items, 'casual');
    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(0.2);
  });

  test('dress alone counts as complete body coverage', () => {
    const items = [makeItem({ category: 'dress', name: 'Summer Dress' })];
    const result = checkOutfitCompleteness(items, 'casual');
    expect(result.valid).toBe(true);
  });
});

// ─── Trend Alignment ────────────────────────────────────────────────────────

describe('checkTrendAlignment', () => {
  test('outfit with trend keywords scores high', () => {
    const items = [
      makeItem({ name: 'Oversized Blazer', tags: ['oversized', 'layered'] }),
      makeItem({ name: 'Wide Leg Cargo Pants', subcategory: 'wide leg', tags: ['cargo'] }),
    ];
    const result = checkTrendAlignment(items);
    expect(result.score).toBeGreaterThanOrEqual(0.85);
  });

  test('basic outfit without trend keywords scores lower', () => {
    const items = [
      makeItem({ name: 'Blue Shirt' }),
      makeItem({ name: 'Black Pants' }),
    ];
    const result = checkTrendAlignment(items);
    expect(result.score).toBeLessThanOrEqual(0.7);
  });
});

// ─── Versatility ────────────────────────────────────────────────────────────

describe('checkVersatility', () => {
  test('jeans, shirt, sneakers = highly versatile', () => {
    const result = checkVersatility(casualOutfit);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  test('niche items like sequin dress score lower', () => {
    const items = [
      makeItem({ name: 'Sequin Gown' }),
      makeItem({ name: 'Platform Heels' }),
    ];
    const result = checkVersatility(items);
    expect(result.score).toBeLessThan(0.6);
  });
});

// ─── Wow Factor ─────────────────────────────────────────────────────────────

describe('checkWowFactor', () => {
  test('designer leather jacket with color pop scores high', () => {
    const items = [
      makeItem({ name: 'Designer Leather Jacket', brand: 'Gucci', category: 'outerwear', color: 'black' }),
      makeItem({ name: 'White T-Shirt', color: 'white' }),
      makeItem({ name: 'Black Jeans', color: 'black', category: 'bottom' }),
      makeItem({ name: 'Red Sneakers', color: 'red', category: 'shoes' }), // color pop
    ];
    const result = checkWowFactor(items, 'party');
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });
});

// ─── Full Evaluator ─────────────────────────────────────────────────────────

describe('evaluateFashionIntelligence', () => {
  test('returns a score between 0 and 1', () => {
    const result = evaluateFashionIntelligence(casualOutfit, 'casual', 'warm', 'afternoon', {});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  test('returns reasons array', () => {
    const result = evaluateFashionIntelligence(casualOutfit, 'casual', 'warm', 'afternoon', {});
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test('returns detail checks object', () => {
    const result = evaluateFashionIntelligence(casualOutfit, 'casual', 'warm', 'afternoon', {});
    expect(result.details).toHaveProperty('colorHarmony');
    expect(result.details).toHaveProperty('occasionFit');
    expect(result.details).toHaveProperty('weatherAdaptation');
    expect(result.details).toHaveProperty('outfitCompleteness');
  });

  test('formal outfit scores higher for work than gym outfit', () => {
    const formalScore = evaluateFashionIntelligence(formalOutfit, 'work', 'warm', 'morning', {});
    const gymScore = evaluateFashionIntelligence(gymOutfit, 'work', 'warm', 'morning', {});
    expect(formalScore.score).toBeGreaterThan(gymScore.score);
  });

  test('gym outfit scores higher for gym than formal outfit', () => {
    const gymScore = evaluateFashionIntelligence(gymOutfit, 'gym', 'warm', 'morning', {});
    const formalScore = evaluateFashionIntelligence(formalOutfit, 'gym', 'warm', 'morning', {});
    expect(gymScore.score).toBeGreaterThan(formalScore.score);
  });

  test('handles empty items gracefully', () => {
    const result = evaluateFashionIntelligence([], 'casual', 'warm', 'afternoon', {});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  test('handles missing weather detail gracefully', () => {
    const result = evaluateFashionIntelligence(casualOutfit, 'casual', 'warm', 'afternoon', null);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
