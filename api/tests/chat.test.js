// Set env before requiring routes
process.env.JWT_SECRET = 'test-secret';
process.env.OPENAI_API_KEY = 'test-key';

const chatRouter = require('../routes/chat');

const {
  buildWardrobeBrief,
  buildWardrobeContextText,
  sanitizeAssistantMessage,
} = chatRouter.__testables;

// ─── buildWardrobeBrief ─────────────────────────────────────────────────────

describe('buildWardrobeBrief', () => {
  test('surfaces style identity and strategic growth areas', () => {
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

    expect(brief.itemCount).toBe(4);
    expect(brief.styleArchetype).toBe('The Polished Minimalist');
    expect(brief.palette).toContain('Black');
    expect(brief.heroPieces.length).toBeGreaterThan(0);
    expect(brief.growthAreas.some((entry) => entry.toLowerCase().includes('bottom'))).toBe(true);
    expect(brief.stylistFocus.length).toBeGreaterThan(20);
  });

  test('handles empty wardrobe gracefully', () => {
    const brief = buildWardrobeBrief({
      wardrobeItems: [],
      styleDNA: null,
      preferences: null,
      recentLearning: [],
    });

    expect(brief.itemCount).toBe(0);
    expect(brief.categories).toHaveLength(0);
    expect(brief.growthAreas.length).toBeGreaterThan(0);
  });
});

// ─── buildWardrobeContextText ───────────────────────────────────────────────

describe('buildWardrobeContextText', () => {
  test('includes the stylist focus and wardrobe signals', () => {
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

    expect(text).toContain('WARDROBE INTELLIGENCE');
    expect(text).toContain('The Polished Minimalist');
    expect(text).toContain('Refine your polished minimalist direction.');
    expect(text).toContain('Positive preference signals');
  });

  test('handles empty wardrobe text', () => {
    const text = buildWardrobeContextText({ itemCount: 0 });
    expect(text).toContain('WARDROBE INTELLIGENCE');
    expect(text).toContain('not added wardrobe items yet');
  });
});

// ─── sanitizeAssistantMessage ───────────────────────────────────────────────

describe('sanitizeAssistantMessage', () => {
  test('strips markdown while preserving readable text', () => {
    const cleaned = sanitizeAssistantMessage(
      '**Hello**\n\n- First point\n1. Second point\n`inline`\n\nPlain text',
    );

    expect(cleaned).toBe('Hello\nFirst point\nSecond point\ninline\n\nPlain text');
  });

  test('handles empty input', () => {
    expect(sanitizeAssistantMessage('')).toBe('');
    expect(sanitizeAssistantMessage(null)).toBe('');
    expect(sanitizeAssistantMessage(undefined)).toBe('');
  });

  test('strips code blocks', () => {
    const input = 'Before\n```javascript\nconst x = 1;\n```\nAfter';
    const result = sanitizeAssistantMessage(input);
    expect(result).not.toContain('```');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  test('truncates very long messages', () => {
    const long = 'A'.repeat(5000);
    const result = sanitizeAssistantMessage(long);
    expect(result.length).toBeLessThanOrEqual(4000);
  });
});
