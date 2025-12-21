const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');

const router = express.Router();

/**
 * Calculate or recalculate Style DNA for a user
 * GET /style-dna/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch all user's wardrobe items
    const items = await ClothingItem.find({ userId });

    if (items.length === 0) {
      return res.status(404).json({ error: 'No wardrobe items found. Add items to calculate Style DNA.' });
    }

    // Calculate Style DNA
    const styleDNA = await calculateStyleDNA(userId, items);

    res.json({ styleDNA });
  } catch (err) {
    console.error('GET /style-dna/:userId error', err);
    res.status(500).json({ error: 'Failed to calculate Style DNA' });
  }
});

/**
 * POST /style-dna/:userId/recalculate
 * Force recalculation of Style DNA
 */
router.post('/:userId/recalculate', async (req, res) => {
  try {
    const { userId } = req.params;

    const items = await ClothingItem.find({ userId });
    const styleDNA = await calculateStyleDNA(userId, items, true);

    res.json({ styleDNA });
  } catch (err) {
    console.error('POST /style-dna/:userId/recalculate error', err);
    res.status(500).json({ error: 'Failed to recalculate Style DNA' });
  }
});

/**
 * Calculate Style DNA from wardrobe items using AI
 */
async function calculateStyleDNA(userId, items, forceRecalculate = false) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    throw new Error('AI service not available');
  }

  // Prepare wardrobe summary for AI analysis
  const wardrobeSummary = items.map((item) => ({
    category: item.category,
    subcategory: item.subcategory || '',
    color: item.color || '',
    style: item.style || '',
    pattern: item.pattern || '',
    fit: item.fit || '',
    occasion: item.occasion || [],
    tags: item.tags || [],
    brand: item.brand || '',
  }));

  const prompt = `You are an expert fashion stylist and style analyst. Analyze this user's wardrobe and provide deep, intelligent insights about their personal style DNA.

WARDROBE DATA (${items.length} items):
${JSON.stringify(wardrobeSummary, null, 2)}

Analyze this wardrobe and provide a comprehensive Style DNA analysis. Consider:
1. Primary style identity (casual, formal, streetwear, minimalist, bohemian, sporty, vintage, modern, etc.)
2. Secondary style influences
3. Color preferences and dominant color palette
4. Seasonal color preferences (spring, summer, fall, winter)
5. Brand affinity and preferences
6. Category distribution
7. Uniqueness score (0-1): How unique/distinctive is their style?
8. Style consistency (0-1): How consistent is their style across items?
9. Trend alignment (0-1): How aligned are they with current fashion trends?

Respond ONLY as minified JSON with this exact structure:
{
  "primaryStyle": "string (one word style identifier)",
  "secondaryStyles": ["array", "of", "secondary", "styles"],
  "colorPreferences": {
    "dominantColors": [{"color": "string", "percentage": number}, ...],
    "colorPalette": ["array", "of", "colors"],
    "seasonalColors": {
      "spring": ["array", "of", "colors"],
      "summer": ["array", "of", "colors"],
      "fall": ["array", "of", "colors"],
      "winter": ["array", "of", "colors"]
    }
  },
  "brandAffinity": [{"brand": "string", "count": number, "score": 0-1}, ...],
  "categoryDistribution": {"top": number, "bottom": number, "dress": number, "shoes": number, "outerwear": number, "accessory": number},
  "uniquenessScore": 0-1,
  "styleConsistency": 0-1,
  "trendAlignment": 0-1
}

Be intelligent, insightful, and specific. Don't just count items - analyze patterns, preferences, and style identity.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using GPT-4o for intelligent analysis
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion stylist. Analyze wardrobes and provide detailed Style DNA insights. Output only valid JSON, no explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('AI analysis failed');
    }

    const json = await response.json();
    const rawContent = json.choices?.[0]?.message?.content || '{}';

    // Track API usage for Style DNA
    try {
      const ApiUsage = require('../models/ApiUsage');
      const usage = json.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      
      // Calculate cost: GPT-4o pricing ($2.50/1M input, $10/1M output)
      const cost = (promptTokens / 1000000 * 2.50) + (completionTokens / 1000000 * 10);
      
      await ApiUsage.create({
        service: 'openai',
        operation: 'style-dna',
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
        },
        cost,
        model: 'gpt-4o',
      });
    } catch (trackError) {
      console.error('Failed to track API usage:', trackError);
    }

    let parsed;
    try {
      // Clean the response (remove markdown code blocks if present)
      const cleanedContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI Style DNA response:', rawContent);
      throw new Error('Failed to parse AI response');
    }

    // Validate and structure the response
    const styleDNAContent = {
      userId,
      primaryStyle: parsed.primaryStyle || 'casual',
      secondaryStyles: Array.isArray(parsed.secondaryStyles) ? parsed.secondaryStyles : [],
      colorPreferences: {
        dominantColors: Array.isArray(parsed.colorPreferences?.dominantColors)
          ? parsed.colorPreferences.dominantColors.slice(0, 5)
          : [],
        colorPalette: Array.isArray(parsed.colorPreferences?.colorPalette)
          ? parsed.colorPreferences.colorPalette
          : [],
        seasonalColors: parsed.colorPreferences?.seasonalColors || {
          spring: [],
          summer: [],
          fall: [],
          winter: [],
        },
      },
      brandAffinity: Array.isArray(parsed.brandAffinity)
        ? parsed.brandAffinity.slice(0, 10)
        : [],
      categoryDistribution: parsed.categoryDistribution || {
        top: 0,
        bottom: 0,
        dress: 0,
        shoes: 0,
        outerwear: 0,
        accessory: 0,
      },
      uniquenessScore: typeof parsed.uniquenessScore === 'number' ? Math.max(0, Math.min(1, parsed.uniquenessScore)) : 0.5,
      styleConsistency: typeof parsed.styleConsistency === 'number' ? Math.max(0, Math.min(1, parsed.styleConsistency)) : 0.5,
      trendAlignment: typeof parsed.trendAlignment === 'number' ? Math.max(0, Math.min(1, parsed.trendAlignment)) : 0.5,
      lastCalculated: new Date(),
    };

    // Ensure category distribution is accurate (count actual items)
    items.forEach((item) => {
      if (styleDNAContent.categoryDistribution.hasOwnProperty(item.category)) {
        styleDNAContent.categoryDistribution[item.category]++;
      }
    });

    const styleDNA = await StyleDNA.findOneAndUpdate(
      { userId },
      styleDNAContent,
      { upsert: true, new: true }
    );

    return styleDNA;
  } catch (error) {
    console.error('AI Style DNA calculation error:', error);
    // Fallback to basic calculation if AI fails
    console.log('Falling back to basic Style DNA calculation');
    return calculateStyleDNABasic(userId, items);
  }
}

/**
 * Basic Style DNA calculation (fallback if AI fails)
 */
async function calculateStyleDNABasic(userId, items) {
  const categoryDistribution = {
    top: 0,
    bottom: 0,
    dress: 0,
    shoes: 0,
    outerwear: 0,
    accessory: 0,
  };

  const colorCounts = {};
  const brandCounts = {};

  items.forEach((item) => {
    if (categoryDistribution.hasOwnProperty(item.category)) {
      categoryDistribution[item.category]++;
    }
    if (item.color) {
      const color = item.color.toLowerCase();
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }
    if (item.brand) {
      const brand = item.brand.toLowerCase();
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }
  });

  const dominantColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color, count]) => ({
      color,
      percentage: (count / items.length) * 100,
    }));

  const brandAffinity = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([brand, count]) => ({
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      count,
      score: Math.min(count / items.length, 1),
    }));

  const styleDNAContent = {
    userId,
    primaryStyle: 'casual',
    secondaryStyles: [],
    colorPreferences: {
      dominantColors,
      colorPalette: dominantColors.map((c) => c.color),
      seasonalColors: {
        spring: [],
        summer: [],
        fall: [],
        winter: [],
      },
    },
    brandAffinity,
    categoryDistribution,
    uniquenessScore: 0.5,
    styleConsistency: 0.5,
    trendAlignment: 0.5,
    lastCalculated: new Date(),
  };

  const styleDNA = await StyleDNA.findOneAndUpdate(
    { userId },
    styleDNAContent,
    { upsert: true, new: true }
  );

  return styleDNA;
}

module.exports = router;

