const express = require('express');
const OpenAI = require('openai');
const { requireFeature } = require('../middleware/planLimits');
const ChatHistory = require('../models/ChatHistory');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');
const UserPreferences = require('../models/UserPreferences');
const LearningHistory = require('../models/LearningHistory');
const { getSemanticProfile } = require('../utils/semanticStyleProfile');

const router = express.Router();

let openaiClient = null;

const DEFAULT_COACH_NAME = 'NOVA';
const CATEGORY_ORDER = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'other'];
const CATEGORY_LABELS = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses',
  shoes: 'Shoes',
  outerwear: 'Outerwear',
  accessory: 'Accessories',
  other: 'Other',
};
const NEUTRAL_COLORS = new Set([
  'black',
  'white',
  'cream',
  'ivory',
  'beige',
  'tan',
  'camel',
  'brown',
  'taupe',
  'grey',
  'gray',
  'charcoal',
  'navy',
  'olive',
  'stone',
]);

function cleanText(value, maxLength = 160) {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) return '';
  return normalized.slice(0, maxLength);
}

function humanizeToken(value) {
  const cleaned = cleanText(value, 60).replace(/[_-]+/g, ' ');
  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueStrings(values = [], limit = 6, formatter = (value) => value) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(formatter(cleaned));
    if (result.length >= limit) break;
  }

  return result;
}

function countValue(counts, value, weight = 1) {
  const cleaned = cleanText(value, 80).toLowerCase();
  if (!cleaned) return;
  counts[cleaned] = (counts[cleaned] || 0) + weight;
}

function sortedCountEntries(counts = {}, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function topCountLabels(counts = {}, limit = 5) {
  return sortedCountEntries(counts, limit).map(([key]) => humanizeToken(key));
}

function topWeightedKeys(mapLike, limit = 4) {
  if (!mapLike) return [];

  const entries =
    mapLike instanceof Map ? Array.from(mapLike.entries()) : Object.entries(mapLike || {});

  return entries
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, limit)
    .map(([key]) => humanizeToken(key));
}

function daysSince(dateValue) {
  if (!dateValue) return null;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function describeItem(item = {}, profile = getSemanticProfile(item)) {
  const parts = [];
  const color = humanizeToken(item.color);
  const material = humanizeToken(profile.materials?.[0]);
  const base = humanizeToken(item.subcategory || item.name || item.category);

  if (color) parts.push(color);
  if (material && (!base || !base.toLowerCase().includes(material.toLowerCase()))) {
    parts.push(material);
  }
  if (base) parts.push(base);

  return uniqueStrings(parts, 4).join(' ');
}

function buildCategoryBreakdown(items = []) {
  const counts = CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  items.forEach((item) => {
    const key = CATEGORY_ORDER.includes(item.category) ? item.category : 'other';
    counts[key] += 1;
  });

  return CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    count: counts[key] || 0,
  })).filter((entry) => entry.count > 0);
}

function isPositiveLearningEvent(entry = {}) {
  if (entry.rating && entry.rating >= 4) return true;
  return ['save', 'saved', 'swipe_right', 'rate', 'rated', 'refine'].includes(entry.interactionType);
}

function buildLearningSignals(recentLearning = [], preferences = null) {
  const positiveColors = {};
  const positiveStyles = {};
  const positiveCategories = {};

  recentLearning.forEach((entry) => {
    if (!isPositiveLearningEvent(entry)) return;
    const weight = entry.rating ? Math.max(1, Number(entry.rating) - 2) : 1;

    (entry.metadata?.colors || []).forEach((value) => countValue(positiveColors, value, weight));
    (entry.metadata?.styles || []).forEach((value) => countValue(positiveStyles, value, weight));
    (entry.metadata?.categories || []).forEach((value) => countValue(positiveCategories, value, weight));
  });

  return {
    lovedColors: uniqueStrings(
      [
        ...(preferences?.preferredColors || []),
        ...topWeightedKeys(preferences?.colorWeights, 4),
        ...topCountLabels(positiveColors, 4),
      ],
      5,
      humanizeToken,
    ),
    lovedStyles: uniqueStrings(
      [
        ...(preferences?.preferredStyles || []),
        ...topWeightedKeys(preferences?.styleWeights, 4),
        ...topCountLabels(positiveStyles, 4),
      ],
      5,
      humanizeToken,
    ),
    lovedCategories: uniqueStrings(
      [
        ...(preferences?.preferredCategories || []),
        ...topWeightedKeys(preferences?.categoryWeights, 4),
        ...topCountLabels(positiveCategories, 4),
      ],
      4,
      humanizeToken,
    ),
    occasionSignals: uniqueStrings(
      [
        ...(preferences?.preferredOccasions || []),
        ...topWeightedKeys(preferences?.occasionWeights, 3),
      ],
      3,
      humanizeToken,
    ),
  };
}

function buildWardrobeWins({
  itemCount,
  palette,
  styleSignatures,
  categoryBreakdown,
  dominantDressCodes,
  styleDNA,
}) {
  const wins = [];
  const categories = Object.fromEntries(categoryBreakdown.map((entry) => [entry.key, entry.count]));

  if (palette.length > 0) {
    wins.push(`Your wardrobe already has strong palette anchors in ${palette.slice(0, 3).join(', ')}.`);
  }

  if (styleSignatures.length > 0) {
    wins.push(`Your closet has a clear point of view with ${styleSignatures.slice(0, 3).join(', ')} energy.`);
  }

  if ((categories.top || 0) > 0 && (categories.bottom || 0) > 0 && (categories.shoes || 0) > 0) {
    wins.push('You have enough core building blocks to create polished complete looks from what you own.');
  }

  if (dominantDressCodes.length > 0) {
    wins.push(`Your strongest wardrobe lane is ${dominantDressCodes[0].toLowerCase()}, which gives your style a recognizable signature.`);
  }

  if (cleanText(styleDNA?.styleArchetype)) {
    wins.push(`${cleanText(styleDNA.styleArchetype)} is already visible in the closet, which means your style identity is taking shape.`);
  }

  if (itemCount < 8) {
    wins.push('A smaller wardrobe can still be powerful when every piece has a clear job and works hard.');
  }

  return uniqueStrings(wins, 4);
}

function buildGrowthAreas({ itemCount, categoryBreakdown, palette, dominantDressCodes }) {
  if (itemCount === 0) {
    return [
      'Start with a confident foundation of tops, bottoms, and one reliable shoe so every new piece multiplies your options.',
    ];
  }

  const areas = [];
  const categories = Object.fromEntries(categoryBreakdown.map((entry) => [entry.key, entry.count]));
  const topCount = categories.top || 0;
  const bottomCount = categories.bottom || 0;
  const shoeCount = categories.shoes || 0;
  const outerwearCount = categories.outerwear || 0;

  if (topCount >= bottomCount * 2 + 1) {
    areas.push('Adding two or three more bottoms would unlock far more combinations from the tops you already own.');
  }

  if (shoeCount === 0) {
    areas.push('One reliable everyday shoe would finish far more looks cleanly and make styling faster.');
  }

  if (itemCount >= 6 && outerwearCount === 0) {
    areas.push('A polished layer like a blazer, jacket, or coat would instantly elevate the wardrobe.');
  }

  const neutralCount = palette.filter((color) => NEUTRAL_COLORS.has(color.toLowerCase())).length;
  if (palette.length >= 3 && neutralCount >= Math.max(2, Math.ceil(palette.length * 0.6))) {
    areas.push('One intentional accent color piece could add range without disrupting your core palette.');
  }

  if (dominantDressCodes.length === 1 && dominantDressCodes[0].toLowerCase() === 'casual') {
    areas.push('A smart-casual bridge piece would give you more range for dinners, work moments, and elevated everyday styling.');
  }

  if (areas.length === 0) {
    areas.push('The next level is not more pieces, but sharper pairing: stronger proportions, better layers, and more intentional finishing touches.');
  }

  return uniqueStrings(areas, 4);
}

function buildStyleInsight({
  palette,
  styleSignatures,
  dominantDressCodes,
  styleDNA,
  itemCount,
}) {
  if (cleanText(styleDNA?.styleInsight)) {
    return cleanText(styleDNA.styleInsight, 220);
  }

  if (itemCount === 0) {
    return 'Your style story has not been documented in the wardrobe yet, so the smartest next move is building a clean, versatile foundation around how you actually live.';
  }

  const signatureText =
    styleSignatures.length > 0
      ? styleSignatures.slice(0, 2).join(' and ').toLowerCase()
      : 'personal and still evolving';
  const paletteText =
    palette.length > 0 ? `${palette.slice(0, 2).join(' and ')} tones` : 'versatile colors';
  const dressCodeText =
    dominantDressCodes.length > 0 ? dominantDressCodes[0].toLowerCase() : 'everyday';

  return `Your wardrobe reads ${signatureText}, grounded by ${paletteText} and a ${dressCodeText} point of view. The next level is making every look feel deliberate through stronger balance, texture, and finishing pieces.`;
}

function buildStylistFocus({ growthAreas, wardrobeWins, styleArchetype, styleSignatures }) {
  const archetype = cleanText(styleArchetype);
  if (growthAreas.length > 0 && archetype) {
    return `Refine your ${archetype} direction by focusing on ${growthAreas[0].replace(/\.$/, '').toLowerCase()}.`;
  }
  if (growthAreas.length > 0 && styleSignatures.length > 0) {
    return `Strengthen your ${styleSignatures[0].toLowerCase()} wardrobe by focusing on ${growthAreas[0].replace(/\.$/, '').toLowerCase()}.`;
  }
  if (wardrobeWins.length > 0) {
    return wardrobeWins[0];
  }
  return 'Build a wardrobe that feels intentional, easy to wear, and unmistakably yours.';
}

function buildWardrobeBrief({ wardrobeItems = [], styleDNA = null, preferences = null, recentLearning = [] }) {
  const categoryBreakdown = buildCategoryBreakdown(wardrobeItems);
  const colorCounts = {};
  const itemStyleCounts = {};
  const aestheticCounts = {};
  const dressCodeCounts = {};
  const semanticProfiles = wardrobeItems.map((item) => ({
    item,
    profile: getSemanticProfile(item),
  }));

  semanticProfiles.forEach(({ item, profile }) => {
    countValue(itemStyleCounts, item.style);
    countValue(colorCounts, item.color);
    (item.colorPalette || []).forEach((value) => countValue(colorCounts, value));
    (profile.aesthetics || []).forEach((value) => countValue(aestheticCounts, value));
    countValue(dressCodeCounts, profile.dressCode);
  });

  const palette = topCountLabels(colorCounts, 5);
  const dominantDressCodes = topCountLabels(dressCodeCounts, 3);
  const learningSignals = buildLearningSignals(recentLearning, preferences);
  const styleSignatures = uniqueStrings(
    [
      cleanText(styleDNA?.primaryStyle),
      ...(styleDNA?.secondaryStyles || []),
      ...topCountLabels(itemStyleCounts, 3),
      ...topCountLabels(aestheticCounts, 4),
      ...learningSignals.lovedStyles,
    ],
    4,
    humanizeToken,
  );

  const heroPieces = semanticProfiles
    .slice()
    .sort((a, b) => {
      const scoreA =
        (a.item.favorite ? 3.5 : 0) +
        Math.min(a.item.wearCount || 0, 8) * 0.35 +
        ((a.profile.axes?.polish || 0.5) * 1.8) +
        ((a.profile.axes?.versatility || 0.5) * 1.1);
      const scoreB =
        (b.item.favorite ? 3.5 : 0) +
        Math.min(b.item.wearCount || 0, 8) * 0.35 +
        ((b.profile.axes?.polish || 0.5) * 1.8) +
        ((b.profile.axes?.versatility || 0.5) * 1.1);
      return scoreB - scoreA;
    })
    .map(({ item, profile }) => describeItem(item, profile))
    .filter(Boolean)
    .slice(0, 4);

  const underusedPieces = semanticProfiles
    .filter(({ item }) => !item.favorite)
    .slice()
    .sort((a, b) => {
      const dormantA = daysSince(a.item.lastWorn);
      const dormantB = daysSince(b.item.lastWorn);
      const scoreA =
        ((a.item.wearCount || 0) === 0 ? 2.6 : 0) +
        (dormantA == null ? 2.1 : Math.min(dormantA / 45, 3)) +
        (a.profile.axes?.versatility || 0.5);
      const scoreB =
        ((b.item.wearCount || 0) === 0 ? 2.6 : 0) +
        (dormantB == null ? 2.1 : Math.min(dormantB / 45, 3)) +
        (b.profile.axes?.versatility || 0.5);
      return scoreB - scoreA;
    })
    .map(({ item, profile }) => describeItem(item, profile))
    .filter(Boolean)
    .slice(0, 4);

  const wardrobeWins = buildWardrobeWins({
    itemCount: wardrobeItems.length,
    palette,
    styleSignatures,
    categoryBreakdown,
    dominantDressCodes,
    styleDNA,
  });
  const growthAreas = buildGrowthAreas({
    itemCount: wardrobeItems.length,
    categoryBreakdown,
    palette,
    dominantDressCodes,
  });

  const styleArchetype =
    cleanText(styleDNA?.styleArchetype) ||
    (styleSignatures.length > 0 ? `${styleSignatures.slice(0, 2).join(' ')} Direction` : '');
  const styleMantra =
    cleanText(styleDNA?.styleMantra) ||
    (palette.length > 0
      ? `Use ${palette.slice(0, 2).join(' and ')} as your anchor, then add contrast through shape and texture.`
      : '');

  const brief = {
    itemCount: wardrobeItems.length,
    categories: categoryBreakdown,
    palette,
    styleSignatures,
    dominantDressCodes,
    wardrobeWins,
    growthAreas,
    heroPieces,
    underusedPieces,
    styleArchetype,
    styleMantra,
    styleInsight: buildStyleInsight({
      palette,
      styleSignatures,
      dominantDressCodes,
      styleDNA,
      itemCount: wardrobeItems.length,
    }),
    lovedColors: learningSignals.lovedColors,
    lovedStyles: learningSignals.lovedStyles,
    lovedCategories: learningSignals.lovedCategories,
    occasionSignals: learningSignals.occasionSignals,
  };

  return {
    ...brief,
    stylistFocus: buildStylistFocus({
      growthAreas,
      wardrobeWins,
      styleArchetype,
      styleSignatures,
    }),
  };
}

function buildWardrobeContextText(brief = {}) {
  if (!brief.itemCount) {
    return [
      'WARDROBE INTELLIGENCE',
      '- The user has not added wardrobe items yet.',
      '- Coach them with warmth and teach them how to build a strong foundation around lifestyle, versatility, and confidence.',
    ].join('\n');
  }

  const categoryLine =
    brief.categories?.map((entry) => `${entry.label}: ${entry.count}`).join(', ') || 'Not enough data';
  const paletteLine = brief.palette?.join(', ') || 'Mixed palette';
  const styleLine = brief.styleSignatures?.join(', ') || 'Still emerging';
  const dressCodeLine = brief.dominantDressCodes?.join(', ') || 'Mixed dress codes';
  const heroLine = brief.heroPieces?.join('; ') || 'No obvious hero pieces yet';
  const underusedLine = brief.underusedPieces?.join('; ') || 'No underused opportunities identified';
  const winsLine = brief.wardrobeWins?.join(' | ') || 'No wardrobe wins identified yet';
  const growthLine = brief.growthAreas?.join(' | ') || 'No immediate growth priorities';
  const preferencesLine = uniqueStrings(
    [
      ...(brief.lovedColors || []),
      ...(brief.lovedStyles || []),
      ...(brief.lovedCategories || []),
    ],
    8,
  ).join(', ');

  return [
    'WARDROBE INTELLIGENCE',
    `- Total items: ${brief.itemCount}`,
    `- Category balance: ${categoryLine}`,
    `- Palette anchors: ${paletteLine}`,
    `- Style signatures: ${styleLine}`,
    `- Dress code energy: ${dressCodeLine}`,
    `- Hero pieces: ${heroLine}`,
    `- Underused opportunities: ${underusedLine}`,
    `- Wardrobe strengths: ${winsLine}`,
    `- Strategic additions or focus: ${growthLine}`,
    `- Style archetype: ${brief.styleArchetype || 'Still taking shape'}`,
    `- Style mantra: ${brief.styleMantra || 'Build from what feels intentional and wearable.'}`,
    `- Style insight: ${brief.styleInsight || 'Teach from the wardrobe, not from assumptions.'}`,
    `- Positive preference signals: ${preferencesLine || 'No strong preference history yet'}`,
    `- Occasion lean: ${(brief.occasionSignals || []).join(', ') || 'General lifestyle not defined yet'}`,
    `- Coaching focus: ${brief.stylistFocus || 'Help the user understand and trust their style.'}`,
  ].join('\n');
}

function buildSystemPrompt({ language = 'en', wardrobeContextText }) {
  return `You are NOVA, a world-class celebrity stylist, wardrobe strategist, and fashion educator. You dress top actors, musicians, athletes, and public figures, and you now work as the user's private stylist.

${wardrobeContextText}

Your job is bigger than giving outfit suggestions. You teach the user how their wardrobe works, explain fashion clearly, build confidence, and help them see opportunities inside their closet.

Operating principles:
- Sound warm, sharp, high taste, and deeply supportive.
- Be a cheerleader, never a critic. Do not shame the user's body, size, budget, wardrobe size, or past choices.
- Educate before prescribing. Explain why colors, proportions, textures, silhouettes, and dress codes work.
- Use the wardrobe intelligence above. Reference their actual palette, categories, hero pieces, style identity, and growth areas whenever possible.
- Do not guess. If information is missing, say so honestly and give the best next step.
- If the user asks for outfit help, build from their real wardrobe first. If a missing piece would help, frame it as a strategic addition, not a failure.
- If the user gives a greeting or broad request, proactively give one wardrobe insight, one fashion lesson, and one practical next move.
- Treat a small wardrobe like a styling challenge with high upside. Treat a large wardrobe like an editing and refinement opportunity.
- Keep the tone sharp, warm, and direct — like a superstar stylist texting a favorite client.
- Use plain text only. No markdown, no bullets, no numbered lists, no asterisks, no hashtags.
- Be concise. Maximum 3 short sentences per response. Cut anything that doesn't add value.
- Use emojis naturally and frequently — they add energy and keep responses feel alive.
- End with one punchy follow-up question or next move. One line only.

Conversation goals:
- Teach color harmony, silhouette, proportion, texture, fit, wardrobe building, shopping strategy, occasion dressing, and styling logic.
- Help the user understand what their wardrobe says about them.
- Show them how to restyle, refine, and strengthen what they already own.
- Make them feel capable, stylish, and excited to get dressed.

Respond in ${language}.`;
}

function sanitizeAssistantMessage(message) {
  return String(message || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);
}

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

async function loadStylistContext(userId) {
  const [wardrobeItems, styleDNA, preferences, recentLearning] = await Promise.all([
    ClothingItem.find({ userId }).lean(),
    StyleDNA.findOne({ userId }).lean(),
    UserPreferences.findOne({ userId }).lean(),
    LearningHistory.find({ userId }).sort({ timestamp: -1 }).limit(40).lean(),
  ]);

  const wardrobeBrief = buildWardrobeBrief({
    wardrobeItems,
    styleDNA,
    preferences,
    recentLearning,
  });

  return {
    wardrobeItems,
    styleDNA,
    preferences,
    recentLearning,
    wardrobeBrief,
    wardrobeContextText: buildWardrobeContextText(wardrobeBrief),
  };
}

function extractCoachName(message, currentName) {
  const namePatterns = [
    /call you (\w+)/i,
    /name you (\w+)/i,
    /your name is (\w+)/i,
    /i'?ll call you (\w+)/i,
    /naming you (\w+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = String(message || '').match(pattern);
    if (match) {
      return cleanText(match[1], 40);
    }
  }

  return currentName;
}

// Get all conversations for a user
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const conversations = await ChatHistory.find({ userId })
      .select('conversationId title updatedAt coachName')
      .sort({ updatedAt: -1 });

    return res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get chat history for a specific conversation
router.get('/history', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    let history;
    if (conversationId) {
      history = await ChatHistory.findOne({ userId, conversationId });
    } else {
      history = await ChatHistory.findOne({ userId }).sort({ updatedAt: -1 });
    }

    if (!history) {
      return res.json({
        messages: [],
        conversationId: null,
        title: 'New Chat',
        coachName: DEFAULT_COACH_NAME,
      });
    }

    return res.json({
      messages: history.messages,
      conversationId: history.conversationId,
      title: history.title,
      coachName: history.coachName || DEFAULT_COACH_NAME,
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get coach name
router.get('/coach-name', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    let history;
    if (conversationId) {
      history = await ChatHistory.findOne({ userId, conversationId });
    } else {
      history = await ChatHistory.findOne({ userId }).sort({ updatedAt: -1 });
    }

    return res.json({ coachName: history?.coachName || DEFAULT_COACH_NAME });
  } catch (error) {
    console.error('Error fetching coach name:', error);
    return res.status(500).json({ error: 'Failed to fetch coach name' });
  }
});

// Get a wardrobe brief for the stylist UI
router.get('/brief', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const { wardrobeBrief } = await loadStylistContext(userId);

    return res.json({
      coachName: DEFAULT_COACH_NAME,
      brief: wardrobeBrief,
    });
  } catch (error) {
    console.error('Error fetching wardrobe brief:', error);
    return res.status(500).json({ error: 'Failed to fetch wardrobe brief' });
  }
});

// Create new conversation
router.post('/new', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const history = new ChatHistory({
      userId,
      conversationId,
      title: 'New Chat',
      messages: [],
      coachName: DEFAULT_COACH_NAME,
    });

    await history.save();

    return res.json({
      conversationId,
      title: history.title,
      coachName: history.coachName,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Send message
router.post('/message', requireFeature('styleCoach'), async (req, res) => {
  try {
    const { userId, message, conversationId, language = 'en' } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message required' });
    }

    let history;
    let currentConversationId = conversationId;

    if (conversationId) {
      history = await ChatHistory.findOne({ userId, conversationId });
    }

    if (!history) {
      currentConversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      history = new ChatHistory({
        userId,
        conversationId: currentConversationId,
        title: 'New Chat',
        messages: [],
        coachName: DEFAULT_COACH_NAME,
      });
    }

    const { wardrobeBrief, wardrobeContextText } = await loadStylistContext(userId);
    const systemPrompt = buildSystemPrompt({ language, wardrobeContextText });

    const conversationHistory = history.messages.slice(-20).map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: message },
        {
          role: 'system',
          content:
            'Reminder: plain text only, no markdown, no bullets, no numbered lists. Educate, encourage, and anchor advice in the wardrobe intelligence above.',
        },
      ],
      max_tokens: 200,
      temperature: 0.6,
    });

    let assistantMessage =
      completion.choices?.[0]?.message?.content ||
      'I could not generate a response right now. Please try again.';

    try {
      const ApiUsage = require('../models/ApiUsage');
      const usage = completion.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const cost = (promptTokens / 1000000) * 0.15 + (completionTokens / 1000000) * 0.6;

      await ApiUsage.create({
        service: 'openai',
        operation: 'chat',
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
        },
        cost,
        model: 'gpt-4o-mini',
      });
    } catch (trackError) {
      console.error('Failed to track API usage:', trackError);
    }

    assistantMessage = sanitizeAssistantMessage(assistantMessage);

    const newCoachName = extractCoachName(message, history.coachName || DEFAULT_COACH_NAME);

    history.messages.push(
      { role: 'user', content: cleanText(message, 4000), timestamp: new Date() },
      { role: 'assistant', content: assistantMessage, timestamp: new Date() },
    );

    if (newCoachName !== history.coachName) {
      history.coachName = newCoachName;
    }

    if (history.title === 'New Chat' && history.messages.length <= 2) {
      history.title = cleanText(message, 40) + (cleanText(message).length > 40 ? '...' : '');
    }

    if (history.messages.length > 100) {
      history.messages = history.messages.slice(-100);
    }

    await history.save();

    return res.json({
      response: assistantMessage,
      coachName: history.coachName || DEFAULT_COACH_NAME,
      conversationId: currentConversationId,
      title: history.title,
      brief: wardrobeBrief,
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
});

// Delete a conversation
router.delete('/conversation', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;

    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'User ID and conversation ID required' });
    }

    await ChatHistory.findOneAndDelete({ userId, conversationId });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Clear chat history (delete all messages in a conversation)
router.delete('/history', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    if (conversationId) {
      await ChatHistory.findOneAndUpdate(
        { userId, conversationId },
        { $set: { messages: [] } },
      );
    } else {
      const recent = await ChatHistory.findOne({ userId }).sort({ updatedAt: -1 });
      if (recent) {
        recent.messages = [];
        await recent.save();
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

router.__testables = {
  buildWardrobeBrief,
  buildWardrobeContextText,
  buildSystemPrompt,
  sanitizeAssistantMessage,
};

module.exports = router;
