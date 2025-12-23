const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');
const UserPreferences = require('../models/UserPreferences');
const Outfit = require('../models/Outfit');
const ApiUsage = require('../models/ApiUsage');
const { evaluateFashionIntelligence } = require('../utils/fashionIntelligence');

const router = express.Router();

// Test endpoint to verify route is loaded
router.get('/test', (_req, res) => {
  res.json({ message: 'Recommendations route is working!' });
});

/**
 * GET /recommendations?userId=123&occasion=casual&timeOfDay=afternoon&weather=warm
 * Get AI-powered outfit recommendations
 */
router.get('/', async (req, res) => {
  try {
    const { userId, occasion, timeOfDay, weather, limit, needsLayers, hasRainRisk, tempSwing } = req.query;
    const recommendationLimit = parseInt(limit, 10) || 3; // Default to 3

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Fetch user's wardrobe
    const wardrobe = await ClothingItem.find({ userId });
    if (wardrobe.length < 3) {
      return res.status(400).json({ 
        error: 'Need at least 3 items in wardrobe to generate recommendations' 
      });
    }

    // Fetch Style DNA, preferences, and saved outfits for learning
    const [styleDNA, preferences, savedOutfits] = await Promise.all([
      StyleDNA.findOne({ userId }),
      UserPreferences.findOne({ userId }),
      Outfit.find({ userId }).limit(20).sort({ createdAt: -1 }),
    ]);

    // Parse forecast context
    const forecastContext = {
      needsLayers: needsLayers === 'true',
      hasRainRisk: hasRainRisk === 'true',
      tempSwing: tempSwing ? parseFloat(tempSwing) : 0,
    };

    // Generate recommendations using HYBRID approach: Algorithm + AI work together throughout
    const recommendations = await generateHybridRecommendations({
      wardrobe,
      styleDNA,
      preferences,
      savedOutfits: savedOutfits || [],
      occasion: occasion || 'casual',
      timeOfDay: timeOfDay || 'afternoon',
      weather: weather || 'warm',
      limit: recommendationLimit,
      forecastContext,
    });

    res.json({ recommendations });
  } catch (err) {
    console.error('GET /recommendations error', err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', {
      message: err.message,
      userId: req.query.userId,
      occasion: req.query.occasion,
    });
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * Generate outfit recommendations using advanced algorithms
 */
async function generateRecommendations({
  wardrobe,
  styleDNA,
  preferences,
  savedOutfits = [],
  occasion,
  timeOfDay,
  weather,
  limit,
  forecastContext = {}, // NEW: forecast intelligence
}) {
  const { needsLayers, hasRainRisk, tempSwing } = forecastContext;
  
  // Pre-filter wardrobe for better performance
  // Remove items that are clearly inappropriate for the occasion
  const occasionFilters = {
    formal: { avoidStyles: ['sporty', 'casual', 'athletic'] },
    work: { avoidStyles: ['sporty', 'athletic', 'bohemian'] },
    casual: { avoidStyles: [] }, // Casual accepts all
    date: { avoidStyles: ['sporty', 'athletic'] },
    party: { avoidStyles: [] },
  };
  
  const filter = occasionFilters[occasion] || occasionFilters.casual;
  let filteredWardrobe = filter.avoidStyles.length > 0
    ? wardrobe.filter(item => !filter.avoidStyles.includes(item.style?.toLowerCase()))
    : wardrobe;
  
  // Also filter out items with colors the user wants to avoid (from onboarding)
  if (preferences && preferences.avoidedColors && preferences.avoidedColors.length > 0) {
    filteredWardrobe = filteredWardrobe.filter(item => 
      !preferences.avoidedColors.includes(item.color?.toLowerCase() || '')
    );
  }
  
  // Categorize wardrobe items (use filtered wardrobe)
  const tops = filteredWardrobe.filter((item) => item.category === 'top');
  const bottoms = filteredWardrobe.filter((item) => item.category === 'bottom');
  const shoes = filteredWardrobe.filter((item) => item.category === 'shoes');
  const outerwear = filteredWardrobe.filter((item) => item.category === 'outerwear');
  const accessories = filteredWardrobe.filter((item) => item.category === 'accessory');
  const dresses = filteredWardrobe.filter((item) => item.category === 'dress');

  const recommendations = [];

  // Generate outfit combinations
  if (dresses.length > 0) {
    // Outfits with dresses
    dresses.forEach((dress) => {
      const outfit = {
        items: [dress],
        score: 0,
        reasons: [],
      };

      // Add shoes
      const compatibleShoes = findCompatibleShoes(dress, shoes, occasion, preferences);
      if (compatibleShoes.length > 0) {
        outfit.items.push(compatibleShoes[0]);
      }

      // Add outerwear if needed (based on weather OR forecast says layers needed)
      if (weather === 'cool' || weather === 'cold' || needsLayers) {
        const compatibleOuterwear = findCompatibleOuterwear(dress, outerwear, occasion, preferences);
        if (compatibleOuterwear.length > 0) {
          outfit.items.push(compatibleOuterwear[0]);
        }
      }

      // Add accessories (max 1, ensure no duplicates)
      const compatibleAccessories = findCompatibleAccessories(dress, accessories, occasion, preferences);
      if (compatibleAccessories.length > 0) {
        // Ensure we don't already have an accessory of the same type
        const existingAccessoryTypes = outfit.items
          .filter(item => item.category === 'accessory')
          .map(item => getAccessoryType(item));
        
        const newAccessory = compatibleAccessories[0];
        const newAccessoryType = getAccessoryType(newAccessory);
        
        // Only add if we don't already have this accessory type
        if (!existingAccessoryTypes.includes(newAccessoryType)) {
          outfit.items.push(newAccessory);
        }
      }

      // HYBRID SCORING: Algorithm + Fashion Intelligence work together
      // Algorithm provides technical score (color harmony, style match, etc.)
      const baseScore = scoreOutfit(outfit.items, styleDNA, preferences, savedOutfits, occasion, timeOfDay, weather);
      const fashionIntel = evaluateFashionIntelligence(outfit.items, occasion, weather);
      
      // They work together - mix their scores
      outfit.algorithmScore = baseScore;
      outfit.fashionIntelScore = fashionIntel.score;
      outfit.score = (baseScore * 0.6) + (fashionIntel.score * 0.4); // Mixed scoring
      
      // Build reasons including forecast intelligence
      const forecastReasons = [];
      if (needsLayers && outfit.items.some(i => i.category === 'outerwear')) {
        forecastReasons.push('Includes layers for temperature changes');
      }
      if (hasRainRisk) {
        forecastReasons.push('Consider rain-friendly options');
      }
      
      // Algorithm reasons + fashion intelligence reasons (working together)
      outfit.algorithmReasons = [
        ...getOutfitReasons(outfit.items, styleDNA, preferences, occasion),
        ...fashionIntel.reasons,
        ...forecastReasons,
      ];
      outfit.reasons = outfit.algorithmReasons.slice(0, 4);

      if (outfit.items.length >= 2) {
        recommendations.push(outfit);
      }
    });
  }

  // Generate top + bottom combinations
  // Limit combinations to avoid too many (max 50 combinations)
  const maxCombinations = 50;
  let combinationCount = 0;
  
  for (const top of tops) {
    if (combinationCount >= maxCombinations) break;
    
    for (const bottom of bottoms) {
      if (combinationCount >= maxCombinations) break;
      
      const outfit = {
        items: [top, bottom],
        score: 0,
        reasons: [],
      };

      // Add shoes
      const compatibleShoes = findCompatibleShoes(top, shoes, occasion, preferences);
      if (compatibleShoes.length > 0) {
        outfit.items.push(compatibleShoes[0]);
      }

      // Add outerwear if needed (based on weather OR forecast says layers needed)
      if (weather === 'cool' || weather === 'cold' || needsLayers) {
        const compatibleOuterwear = findCompatibleOuterwear(top, outerwear, occasion, preferences);
        if (compatibleOuterwear.length > 0) {
          outfit.items.push(compatibleOuterwear[0]);
        }
      }

      // Add accessories (max 1, ensure no duplicates)
      const compatibleAccessories = findCompatibleAccessories(top, accessories, occasion, preferences);
      if (compatibleAccessories.length > 0) {
        // Ensure we don't already have an accessory of the same type
        const existingAccessoryTypes = outfit.items
          .filter(item => item.category === 'accessory')
          .map(item => getAccessoryType(item));
        
        const newAccessory = compatibleAccessories[0];
        const newAccessoryType = getAccessoryType(newAccessory);
        
        // Only add if we don't already have this accessory type
        if (!existingAccessoryTypes.includes(newAccessoryType)) {
          outfit.items.push(newAccessory);
        }
      }

      // HYBRID SCORING: Algorithm + Fashion Intelligence work together
      // Algorithm provides technical score (color harmony, style match, etc.)
      const baseScore = scoreOutfit(outfit.items, styleDNA, preferences, savedOutfits, occasion, timeOfDay, weather);
      const fashionIntel = evaluateFashionIntelligence(outfit.items, occasion, weather);
      
      // They work together - mix their scores
      outfit.algorithmScore = baseScore;
      outfit.fashionIntelScore = fashionIntel.score;
      outfit.score = (baseScore * 0.6) + (fashionIntel.score * 0.4); // Mixed scoring
      
      // Build reasons including forecast intelligence
      const forecastReasons = [];
      if (needsLayers && outfit.items.some(i => i.category === 'outerwear')) {
        forecastReasons.push('Includes layers for temperature changes');
      }
      if (hasRainRisk) {
        forecastReasons.push('Consider rain-friendly options');
      }
      
      // Algorithm reasons + fashion intelligence reasons (working together)
      outfit.algorithmReasons = [
        ...getOutfitReasons(outfit.items, styleDNA, preferences, occasion),
        ...fashionIntel.reasons,
        ...forecastReasons,
      ];
      outfit.reasons = outfit.algorithmReasons.slice(0, 4);

      if (outfit.items.length >= 3) {
        recommendations.push(outfit);
        combinationCount++;
      }
    }
  }

  // Sort by score
  recommendations.sort((a, b) => b.score - a.score);
  
  // Ensure diversity: prioritize different tops, but allow duplicates if needed
  const selectedOutfits = [];
  const usedTopIds = new Set();
  const usedDressIds = new Set();
const usedShoeIds = new Set();
  
  // First pass: prioritize diverse tops
  for (const rec of recommendations) {
    const top = rec.items.find(item => item.category === 'top');
    const dress = rec.items.find(item => item.category === 'dress');
  const shoe = rec.items.find(item => item.category === 'shoes');
    
    let isDuplicate = false;
    
    if (dress) {
      if (usedDressIds.has(dress._id.toString())) {
        isDuplicate = true;
      } else {
        usedDressIds.add(dress._id.toString());
      }
    } else if (top) {
      const topId = top._id.toString();
      if (usedTopIds.has(topId)) {
        isDuplicate = true;
      } else {
        usedTopIds.add(topId);
      }
    }
    // Enforce shoe diversity when possible
    if (!isDuplicate && shoe) {
      const shoeId = shoe._id.toString();
      // Only block duplicates if we have enough shoes to vary
      if (usedShoeIds.has(shoeId) && shoes.length > 1) {
        isDuplicate = true;
      } else {
        usedShoeIds.add(shoeId);
      }
    }
    
    // Add if not duplicate, or if we still need more
    if (!isDuplicate || selectedOutfits.length < limit) {
      if (!isDuplicate) {
        selectedOutfits.push(rec);
      } else if (selectedOutfits.length < limit) {
        // Allow duplicate top if we don't have enough recommendations yet
        selectedOutfits.push(rec);
      }
      
      if (selectedOutfits.length >= limit) {
        break;
      }
    }
  }
  
  // Second pass: fill remaining slots with best remaining recommendations
  if (selectedOutfits.length < limit) {
    const remaining = recommendations.filter(rec => !selectedOutfits.includes(rec));
    remaining.sort((a, b) => b.score - a.score);
    for (const rec of remaining) {
      if (selectedOutfits.length >= limit) break;
      selectedOutfits.push(rec);
    }
  }
  
  // Normalize scores to create better differentiation in final results
  // This ensures the top recommendation has the highest score, others scale down slightly
  if (selectedOutfits.length > 1) {
    const maxScore = selectedOutfits[0].score;
    const minScore = selectedOutfits[selectedOutfits.length - 1].score;
    const scoreRange = maxScore - minScore;
    
    // Only normalize if scores are too similar (within 0.08)
    if (scoreRange < 0.08) {
      selectedOutfits.forEach((rec, index) => {
        // Create more differentiation: top keeps max, others scale down by 2-8%
        const normalizedIndex = index / (selectedOutfits.length - 1);
        rec.score = maxScore - (normalizedIndex * 0.12); // Spread by 12%
      });
    }
  }
  
  return selectedOutfits.map((rec, idx) => {
    // Final validation: Remove any duplicate accessories
    const items = rec.items;
    const accessoryTypes = new Set();
    const finalItems = [];
    
    for (const item of items) {
      if (item.category === 'accessory') {
        const type = getAccessoryType(item);
        if (!accessoryTypes.has(type)) {
          accessoryTypes.add(type);
          finalItems.push(item);
        }
        // Skip duplicate accessory types
      } else {
        finalItems.push(item);
      }
    }
    
    return {
      id: `rec_${Date.now()}_${idx}`,
      items: finalItems.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        style: item.style,
        pattern: item.pattern,
      })),
      score: rec.score,
      confidence: Math.round(rec.score * 100), // Convert to percentage (no cap)
      reasons: rec.reasons,
      occasion,
      timeOfDay,
      weather,
    };
  });
}

/**
 * Find compatible shoes for an item
 */
function findCompatibleShoes(item, shoes, occasion, preferences) {
  if (shoes.length === 0) return [];

  return shoes
    .map((shoe) => ({
      shoe,
      score: calculateCompatibility(item, shoe, preferences),
    }))
    .filter(({ score }) => score > 0.3)
    .sort((a, b) => b.score - a.score)
    .map(({ shoe }) => shoe)
    .slice(0, 1);
}

/**
 * Find compatible outerwear
 */
function findCompatibleOuterwear(item, outerwear, occasion, preferences) {
  if (outerwear.length === 0) return [];

  return outerwear
    .map((ow) => ({
      ow,
      score: calculateCompatibility(item, ow, preferences),
    }))
    .filter(({ score }) => score > 0.3)
    .sort((a, b) => b.score - a.score)
    .map(({ ow }) => ow)
    .slice(0, 1);
}

/**
 * Get accessory type (watch, bag, belt, jewelry, etc.)
 */
function getAccessoryType(accessory) {
  const name = (accessory.name || accessory.subcategory || '').toLowerCase();
  
  if (name.includes('watch') || name.includes('timepiece')) return 'watch';
  if (name.includes('bag') || name.includes('purse') || name.includes('handbag') || name.includes('tote')) return 'bag';
  if (name.includes('belt')) return 'belt';
  if (name.includes('necklace') || name.includes('bracelet') || name.includes('ring') || name.includes('earring') || name.includes('jewelry')) return 'jewelry';
  if (name.includes('hat') || name.includes('cap') || name.includes('beanie')) return 'hat';
  if (name.includes('scarf')) return 'scarf';
  if (name.includes('sunglass') || name.includes('glasses')) return 'sunglasses';
  
  return 'other';
}

/**
 * Find compatible accessories
 */
function findCompatibleAccessories(item, accessories, occasion, preferences) {
  if (accessories.length === 0) return [];

  return accessories
    .map((acc) => ({
      acc,
      score: calculateCompatibility(item, acc, preferences),
    }))
    .filter(({ score }) => score > 0.2)
    .sort((a, b) => b.score - a.score)
    .map(({ acc }) => acc)
    .slice(0, 1); // Only return 1 accessory
}

/**
 * Advanced compatibility calculation between two items
 */
function calculateCompatibility(item1, item2, preferences) {
  let score = 0.4; // Start lower for more realistic scoring

  // Color harmony (0-0.35)
  if (item1.color && item2.color) {
    const colorScore = calculateColorHarmony(item1.color, item2.color);
    score += colorScore * 0.35; // Color is very important
  }

  // Style matching (0-0.25)
  if (item1.style && item2.style) {
    if (item1.style === item2.style) {
      score += 0.25; // Matching styles are cohesive
    } else {
      // Some style combinations work well
      const compatibleStyles = {
        casual: ['sporty', 'bohemian', 'minimalist'],
        formal: ['classic', 'elegant', 'minimalist'],
        sporty: ['casual', 'athletic'],
        bohemian: ['casual', 'vintage'],
        classic: ['formal', 'minimalist', 'elegant'],
        minimalist: ['casual', 'formal', 'classic'],
      };
      if (compatibleStyles[item1.style]?.includes(item2.style) || 
          compatibleStyles[item2.style]?.includes(item1.style)) {
        score += 0.15; // Compatible styles
      } else {
        score -= 0.1; // Incompatible styles
      }
    }
  }

  // Pattern compatibility (0-0.15)
  if (item1.pattern && item2.pattern) {
    if (item1.pattern === 'solid' && item2.pattern !== 'solid') {
      score += 0.15; // Solid pairs excellently with patterns
    } else if (item1.pattern !== 'solid' && item2.pattern === 'solid') {
      score += 0.15;
    } else if (item1.pattern === item2.pattern && item1.pattern !== 'solid') {
      score -= 0.25; // Matching patterns clash
    } else if (item1.pattern !== item2.pattern && item1.pattern !== 'solid' && item2.pattern !== 'solid') {
      score -= 0.15; // Multiple different patterns can clash
    }
  }

  // Category-specific rules
  // Shoes should match formality level
  if ((item1.category === 'shoes' && item2.category !== 'shoes') ||
      (item2.category === 'shoes' && item1.category !== 'shoes')) {
    const shoeItem = item1.category === 'shoes' ? item1 : item2;
    const otherItem = item1.category === 'shoes' ? item2 : item1;
    
    const formalShoes = ['dress', 'heels', 'oxfords', 'loafers'];
    const casualShoes = ['sneakers', 'sandals', 'flats', 'boots'];
    
    const isFormalShoe = formalShoes.some(type => 
      shoeItem.name?.toLowerCase().includes(type) || 
      shoeItem.style === 'formal'
    );
    const isCasualShoe = casualShoes.some(type => 
      shoeItem.name?.toLowerCase().includes(type) || 
      shoeItem.style === 'casual'
    );
    
    if (isFormalShoe && (otherItem.style === 'formal' || otherItem.occasion?.includes('formal'))) {
      score += 0.1; // Formal shoes with formal outfit
    } else if (isCasualShoe && (otherItem.style === 'casual' || otherItem.occasion?.includes('casual'))) {
      score += 0.1; // Casual shoes with casual outfit
    } else if ((isFormalShoe && otherItem.style === 'casual') || 
               (isCasualShoe && otherItem.style === 'formal')) {
      score -= 0.15; // Mismatch in formality
    }
  }

  // User preferences (0-0.2)
  if (preferences) {
    const prefColors = preferences.preferredColors || [];
    if (prefColors.includes(item1.color?.toLowerCase() || '')) {
      score += 0.1;
    }
    if (prefColors.includes(item2.color?.toLowerCase() || '')) {
      score += 0.1;
    }
    
    // Preferred styles
    const prefStyles = preferences.preferredStyles || [];
    if (prefStyles.includes(item1.style?.toLowerCase() || '')) {
      score += 0.05;
    }
    if (prefStyles.includes(item2.style?.toLowerCase() || '')) {
      score += 0.05;
    }
    
    // Avoided combinations
    if (preferences.avoidedCombinations && preferences.avoidedCombinations.length > 0) {
      const combo = [item1.color, item2.color]
        .filter(Boolean)
        .map((c) => c.toLowerCase())
        .sort()
        .join('+');
      if (preferences.avoidedCombinations.includes(combo)) {
        score -= 0.6; // Heavy penalty for avoided combinations
      }
    }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Advanced color harmony calculation using color theory
 */
function calculateColorHarmony(color1, color2) {
  const c1 = color1.toLowerCase().trim();
  const c2 = color2.toLowerCase().trim();

  // Neutral colors go with everything (high compatibility)
  const neutrals = ['black', 'white', 'gray', 'grey', 'beige', 'tan', 'navy', 'brown', 'cream', 'ivory', 'charcoal'];
  if (neutrals.includes(c1) || neutrals.includes(c2)) {
    return 0.85; // Neutrals are versatile
  }

  // Same color (monochromatic - elegant)
  if (c1 === c2) {
    return 0.75; // Monochromatic is sophisticated
  }

  // Complementary colors (high contrast, bold)
  const complements = {
    red: ['green', 'teal', 'emerald', 'mint'],
    blue: ['orange', 'coral', 'peach', 'amber'],
    yellow: ['purple', 'violet', 'lavender', 'plum'],
    green: ['red', 'pink', 'rose', 'magenta'],
    purple: ['yellow', 'gold', 'mustard', 'amber'],
    orange: ['blue', 'navy', 'cyan', 'sky'],
    pink: ['green', 'mint', 'sage', 'olive'],
    teal: ['coral', 'peach', 'salmon', 'terracotta'],
  };

  if (complements[c1]?.includes(c2) || complements[c2]?.includes(c1)) {
    return 0.92; // Complementary colors are striking
  }

  // Analogous colors (harmonious, similar hues)
  const analogous = {
    red: ['pink', 'coral', 'orange', 'burgundy', 'maroon'],
    blue: ['navy', 'teal', 'purple', 'indigo', 'cyan'],
    green: ['teal', 'yellow', 'lime', 'olive', 'sage', 'mint'],
    yellow: ['orange', 'green', 'gold', 'amber', 'lime'],
    purple: ['blue', 'pink', 'violet', 'lavender', 'plum'],
    orange: ['red', 'yellow', 'coral', 'peach', 'amber'],
    pink: ['red', 'purple', 'rose', 'coral', 'magenta'],
  };

  if (analogous[c1]?.includes(c2) || analogous[c2]?.includes(c1)) {
    return 0.82; // Analogous colors are harmonious
  }

  // Triadic color schemes (balanced, vibrant)
  const triadic = {
    red: ['blue', 'yellow'],
    blue: ['red', 'yellow'],
    yellow: ['red', 'blue'],
    green: ['orange', 'purple'],
    orange: ['green', 'purple'],
    purple: ['green', 'orange'],
  };

  if (triadic[c1]?.includes(c2) || triadic[c2]?.includes(c1)) {
    return 0.88; // Triadic is balanced and vibrant
  }

  // Split-complementary (sophisticated contrast)
  const splitComplementary = {
    red: ['yellow-green', 'blue-green'],
    blue: ['yellow-orange', 'red-orange'],
    yellow: ['blue-purple', 'red-purple'],
  };

  if (splitComplementary[c1]?.includes(c2) || splitComplementary[c2]?.includes(c1)) {
    return 0.85;
  }

  // Warm/cool compatibility
  const warmColors = ['red', 'orange', 'yellow', 'pink', 'coral', 'peach', 'amber', 'gold', 'burgundy'];
  const coolColors = ['blue', 'green', 'purple', 'teal', 'cyan', 'navy', 'mint', 'sage'];
  
  const c1Warm = warmColors.includes(c1);
  const c2Warm = warmColors.includes(c2);
  const c1Cool = coolColors.includes(c1);
  const c2Cool = coolColors.includes(c2);
  
  // Warm with warm or cool with cool = good
  if ((c1Warm && c2Warm) || (c1Cool && c2Cool)) {
    return 0.7;
  }
  
  // Warm with cool can work but needs careful pairing
  if ((c1Warm && c2Cool) || (c1Cool && c2Warm)) {
    return 0.55; // Moderate compatibility
  }

  return 0.5; // Default moderate compatibility
}

/**
 * Score an entire outfit with more nuanced scoring
 */
function scoreOutfit(items, styleDNA, preferences, savedOutfits, occasion, timeOfDay, weather) {
  let score = 0.4; // Start lower for more realistic scores

  // Occasion appropriateness (0-0.15)
  const occasionScores = {
    casual: 0.5,
    work: 0.6,
    date: 0.7,
    party: 0.65,
    formal: 0.8,
  };
  const occasionMatch = items.filter(
    (item) => item.occasion?.includes(occasion)
  ).length;
  score += (occasionScores[occasion] || 0.5) * 0.15;
  score += (occasionMatch / items.length) * 0.05; // Bonus for occasion-specific items

  // Style DNA alignment (0-0.25)
  if (styleDNA) {
    const matchingStyles = items.filter(
      (item) => item.style === styleDNA.primaryStyle
    ).length;
    score += (matchingStyles / items.length) * 0.25;
  } else {
    // If no style DNA, give moderate score
    score += 0.1;
  }

  // Color harmony across all items (0-0.25)
  const colorScore = calculateOutfitColorHarmony(items);
  score += colorScore * 0.25;

  // User preferences from onboarding and learning (0-0.25)
  if (preferences) {
    // Boost for preferred colors
    if (preferences.preferredColors && preferences.preferredColors.length > 0) {
      const preferredColorMatches = items.filter((item) =>
        preferences.preferredColors.includes(item.color?.toLowerCase() || '')
      ).length;
      score += (preferredColorMatches / items.length) * 0.15;
    }
    
    // PENALTY for avoided colors (from onboarding)
    if (preferences.avoidedColors && preferences.avoidedColors.length > 0) {
      const avoidedColorMatches = items.filter((item) =>
        preferences.avoidedColors.includes(item.color?.toLowerCase() || '')
      ).length;
      score -= (avoidedColorMatches / items.length) * 0.3; // Strong penalty
    }
    
    // Boost for preferred styles
    if (preferences.preferredStyles && preferences.preferredStyles.length > 0) {
      const preferredStyleMatches = items.filter((item) =>
        preferences.preferredStyles.includes(item.style?.toLowerCase() || '')
      ).length;
      score += (preferredStyleMatches / items.length) * 0.1;
    }
    
    // Boost for preferred occasions
    if (preferences.preferredOccasions && preferences.preferredOccasions.length > 0) {
      if (preferences.preferredOccasions.includes(occasion)) {
        score += 0.05; // Bonus if this is a preferred occasion
      }
    }
  }
  
  // Learn from saved outfits - boost score if similar to previously saved outfits
  if (savedOutfits && savedOutfits.length > 0) {
    const currentItemIds = new Set(items.map(item => item._id?.toString()));
    let similarityScore = 0;
    
    savedOutfits.forEach(savedOutfit => {
      const savedItemIds = new Set(
        savedOutfit.items.map(item => item.itemId?.toString())
      );
      
      // Calculate Jaccard similarity
      const intersection = [...currentItemIds].filter(id => savedItemIds.has(id)).length;
      const union = new Set([...currentItemIds, ...savedItemIds]).size;
      const similarity = union > 0 ? intersection / union : 0;
      
      // If similar to a saved outfit, user likely likes this style
      if (similarity > 0.3) {
        similarityScore += similarity * 0.1; // Boost for similarity to saved outfits
      }
    });
    
    score += Math.min(similarityScore, 0.15); // Cap the boost
  }

  // Weather appropriateness (0-0.1)
  if (weather === 'cold' || weather === 'cool') {
    if (items.some((item) => item.category === 'outerwear')) {
      score += 0.1;
    } else {
      score -= 0.05; // Penalty for missing outerwear in cold weather
    }
  }
  if (weather === 'warm' || weather === 'hot') {
    if (!items.some((item) => item.category === 'outerwear')) {
      score += 0.05; // Bonus for no outerwear in warm weather
    } else {
      score -= 0.03; // Small penalty for unnecessary outerwear
    }
  }

  // Time of day appropriateness (0-0.05)
  if (timeOfDay === 'evening' || timeOfDay === 'night') {
    // Evening/night outfits might be slightly more formal
    const hasFormalItem = items.some((item) => 
      item.style === 'formal' || item.occasion?.includes('formal')
    );
    if (hasFormalItem) score += 0.03;
  }

  // Completeness bonus (0-0.05)
  const hasTop = items.some((item) => item.category === 'top' || item.category === 'dress');
  const hasBottom = items.some((item) => item.category === 'bottom' || item.category === 'dress');
  const hasShoes = items.some((item) => item.category === 'shoes');
  const completeness = (hasTop ? 1 : 0) + (hasBottom ? 1 : 0) + (hasShoes ? 1 : 0);
  score += (completeness / 3) * 0.05;

  // Pattern variety bonus (0-0.03)
  const patterns = items.map(item => item.pattern).filter(Boolean);
  const uniquePatterns = new Set(patterns);
  if (uniquePatterns.size > 1 && patterns.includes('solid')) {
    score += 0.03; // Bonus for mixing solid with patterns
  }

  // Normalize to realistic range (0.55 to 0.92)
  // This ensures scores vary more realistically
  score = Math.max(0.55, Math.min(0.92, score));
  
  return score;
}

/**
 * Calculate overall color harmony for an outfit
 */
function calculateOutfitColorHarmony(items) {
  if (items.length < 2) return 0.5;

  let totalHarmony = 0;
  let comparisons = 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].color && items[j].color) {
        totalHarmony += calculateColorHarmony(items[i].color, items[j].color);
        comparisons++;
      }
    }
  }

  return comparisons > 0 ? totalHarmony / comparisons : 0.5;
}

/**
 * Get reasons why this outfit was recommended
 */
function getOutfitReasons(items, styleDNA, preferences, occasion) {
  const reasons = [];

  // Color harmony
  const colorHarmony = calculateOutfitColorHarmony(items);
  if (colorHarmony > 0.7) {
    reasons.push('Perfect color harmony');
  } else if (colorHarmony > 0.5) {
    reasons.push('Good color combination');
  }

  // Style DNA match
  if (styleDNA) {
    const styleMatches = items.filter(
      (item) => item.style === styleDNA.primaryStyle
    ).length;
    if (styleMatches === items.length) {
      reasons.push(`Matches your ${styleDNA.primaryStyle} style`);
    }
  }

  // Occasion match
  const occasionMatches = items.filter(
    (item) => item.occasion?.includes(occasion)
  ).length;
  if (occasionMatches > 0) {
    reasons.push(`Perfect for ${occasion} occasions`);
  }

  // User preferences
  if (preferences && preferences.preferredColors.length > 0) {
    const hasPreferredColor = items.some((item) =>
      preferences.preferredColors.includes(item.color?.toLowerCase() || '')
    );
    if (hasPreferredColor) {
      reasons.push('Features your favorite colors');
    }
  }

  if (reasons.length === 0) {
    reasons.push('Well-balanced outfit');
  }

  return reasons;
}

/**
 * SMART HYBRID: Algorithm + AI work together efficiently
 * 
 * Strategy:
 * 1. Algorithm does FAST filtering (quick elimination of bad combinations)
 * 2. Algorithm provides top candidates + key insights (not full scoring)
 * 3. AI does DEEP analysis on filtered set using algorithm insights
 * 4. They work together, not sequentially
 */
async function generateHybridRecommendations({
  wardrobe,
  styleDNA,
  preferences,
  savedOutfits = [],
  occasion,
  timeOfDay,
  weather,
  limit,
  forecastContext = {},
}) {
  // Step 1: Algorithm does FAST filtering (quick, not expensive)
  const quickCandidates = await generateQuickCandidates({
    wardrobe,
    styleDNA,
    preferences,
    occasion,
    timeOfDay,
    weather,
    limit: limit * 2, // Only 2x, not 3x (smarter)
    forecastContext,
  });

  if (quickCandidates.length === 0) {
    return [];
  }

  // Step 2: AI + Algorithm work together on filtered set
  if (process.env.OPENAI_API_KEY) {
    try {
      return await enhanceCandidatesWithAI({
        algorithmCandidates: quickCandidates,
        wardrobe,
        styleDNA,
        preferences,
        occasion,
        timeOfDay,
        weather,
        limit,
        forecastContext,
      });
    } catch (aiError) {
      console.error('AI enhancement failed, using algorithm results:', aiError);
      // Fallback: Do full algorithm scoring on quick candidates
      return await scoreAndSelectCandidates(quickCandidates, limit);
    }
  }

  // No AI: Do full algorithm scoring on quick candidates
  return await scoreAndSelectCandidates(quickCandidates, limit);
}

/**
 * FAST filtering: Algorithm quickly eliminates bad combinations
 * Doesn't do expensive scoring - just smart filtering
 */
async function generateQuickCandidates({
  wardrobe,
  styleDNA,
  preferences,
  occasion,
  timeOfDay,
  weather,
  limit,
  forecastContext = {},
}) {
  const { needsLayers, hasRainRisk } = forecastContext;
  
  // Quick pre-filtering (same as before)
  const occasionFilters = {
    formal: { avoidStyles: ['athletic'] },
    work: { avoidStyles: ['athletic'] },
    casual: { avoidStyles: [] }, // allow most items for variety
    date: { avoidStyles: ['athletic'] },
    party: { avoidStyles: [] },
  };
  
  const filter = occasionFilters[occasion] || occasionFilters.casual;
  let filteredWardrobe = filter.avoidStyles.length > 0
    ? wardrobe.filter(item => !filter.avoidStyles.includes(item.style?.toLowerCase()))
    : wardrobe;
  
  if (preferences && preferences.avoidedColors && preferences.avoidedColors.length > 0) {
    filteredWardrobe = filteredWardrobe.filter(item => 
      !preferences.avoidedColors.includes(item.color?.toLowerCase() || '')
    );
  }
  
  const tops = filteredWardrobe.filter((item) => item.category === 'top');
  const bottoms = filteredWardrobe.filter((item) => item.category === 'bottom');
  const shoes = filteredWardrobe.filter((item) => item.category === 'shoes');
  const outerwear = filteredWardrobe.filter((item) => item.category === 'outerwear');
  const accessories = filteredWardrobe.filter((item) => item.category === 'accessory');
  const dresses = filteredWardrobe.filter((item) => item.category === 'dress');

  const candidates = [];
  // Broader pool to improve variety
  const maxQuickCombinations = Math.min(limit * 4, 80);

  // Quick dress combinations
  if (dresses.length > 0) {
    for (const dress of dresses.slice(0, 10)) { // allow more dresses
      const outfit = { items: [dress], quickScore: 0, quickInsights: [] };
      
      const compatibleShoes = findCompatibleShoes(dress, shoes, occasion, preferences);
      if (compatibleShoes.length > 0) outfit.items.push(compatibleShoes[0]);
      
      if (weather === 'cool' || weather === 'cold' || needsLayers) {
        const compatibleOuterwear = findCompatibleOuterwear(dress, outerwear, occasion, preferences);
        if (compatibleOuterwear.length > 0) outfit.items.push(compatibleOuterwear[0]);
      }
      
      const compatibleAccessories = findCompatibleAccessories(dress, accessories, occasion, preferences);
      if (compatibleAccessories.length > 0) {
        const existingTypes = outfit.items
          .filter(item => item.category === 'accessory')
          .map(item => getAccessoryType(item));
        const newAccessory = compatibleAccessories[0];
        if (!existingTypes.includes(getAccessoryType(newAccessory))) {
          outfit.items.push(newAccessory);
        }
      }
      
      // Quick scoring (lightweight, not full algorithm)
      outfit.quickScore = quickScoreOutfit(outfit.items, preferences, occasion);
      outfit.quickInsights = quickGetInsights(outfit.items, preferences, occasion);
      
      if (outfit.items.length >= 2) {
        candidates.push(outfit);
      }
    }
  }

  // Quick top + bottom combinations
  let comboCount = 0;
  for (const top of tops.slice(0, 25)) { // widen top pool
    if (comboCount >= maxQuickCombinations) break;
    
    for (const bottom of bottoms.slice(0, 25)) { // widen bottom pool
      if (comboCount >= maxQuickCombinations) break;
      
      const outfit = { items: [top, bottom], quickScore: 0, quickInsights: [] };
      
      const compatibleShoes = findCompatibleShoes(top, shoes, occasion, preferences);
      if (compatibleShoes.length > 0) outfit.items.push(compatibleShoes[0]);
      
      if (weather === 'cool' || weather === 'cold' || needsLayers) {
        const compatibleOuterwear = findCompatibleOuterwear(top, outerwear, occasion, preferences);
        if (compatibleOuterwear.length > 0) outfit.items.push(compatibleOuterwear[0]);
      }
      
      const compatibleAccessories = findCompatibleAccessories(top, accessories, occasion, preferences);
      if (compatibleAccessories.length > 0) {
        const existingTypes = outfit.items
          .filter(item => item.category === 'accessory')
          .map(item => getAccessoryType(item));
        const newAccessory = compatibleAccessories[0];
        if (!existingTypes.includes(getAccessoryType(newAccessory))) {
          outfit.items.push(newAccessory);
        }
      }
      
      // Quick scoring (lightweight)
      outfit.quickScore = quickScoreOutfit(outfit.items, preferences, occasion);
      outfit.quickInsights = quickGetInsights(outfit.items, preferences, occasion);
      
      if (outfit.items.length >= 3) {
        candidates.push(outfit);
        comboCount++;
      }
    }
  }

  // Sort by quick score and return top candidates
  candidates.sort((a, b) => b.quickScore - a.quickScore);
  return candidates.slice(0, limit * 2);
}

/**
 * Quick lightweight scoring (for filtering, not final scoring)
 */
function quickScoreOutfit(items, preferences, occasion) {
  let score = 50; // Base score
  
  // Quick color check
  const colors = items.map(i => i.color?.toLowerCase()).filter(Boolean);
  const uniqueColors = new Set(colors);
  if (uniqueColors.size <= 3) score += 20; // Good color count
  
  // Quick style check
  const styles = items.map(i => i.style?.toLowerCase()).filter(Boolean);
  const hasMatchingStyle = styles.length > 0 && styles.every(s => s === styles[0] || s.includes(styles[0]));
  if (hasMatchingStyle) score += 15;
  
  // Preference match
  if (preferences) {
    if (preferences.preferredColors?.some(c => colors.includes(c.toLowerCase()))) {
      score += 15;
    }
  }
  
  return Math.min(score, 100);
}

/**
 * Quick insights (for AI context, not final reasons)
 */
function quickGetInsights(items, preferences, occasion) {
  const insights = [];
  const colors = items.map(i => i.color?.toLowerCase()).filter(Boolean);
  const uniqueColors = new Set(colors);
  
  if (uniqueColors.size <= 3) insights.push('Good color harmony');
  if (preferences?.preferredColors?.some(c => colors.includes(c.toLowerCase()))) {
    insights.push('Uses preferred colors');
  }
  
  return insights;
}

/**
 * Full algorithm scoring (only used if AI fails)
 */
async function scoreAndSelectCandidates(candidates, limit) {
  // This would do full algorithm scoring - but we prefer AI enhancement
  // For now, just return top quick-scored candidates
  return candidates.slice(0, limit).map(candidate => ({
    id: `algorithm-${Date.now()}-${Math.random()}`,
    items: candidate.items.map(item => ({
      id: item._id.toString(),
      name: item.name,
      category: item.category,
      color: item.color,
      imageUrl: item.imageUrl,
      style: item.style,
      pattern: item.pattern,
    })),
    score: candidate.quickScore,
    confidence: candidate.quickScore,
    reasons: candidate.quickInsights,
  }));
}

/**
 * AI + Algorithm Hybrid: AI enhances algorithm-generated candidates
 * Algorithm does smart filtering & scoring, AI adds intelligence & refinement
 */
async function enhanceCandidatesWithAI({
  algorithmCandidates,
  wardrobe,
  styleDNA,
  preferences,
  occasion,
  timeOfDay,
  weather,
  limit,
  forecastContext = {},
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // Build candidate outfits summary for AI
  const candidatesSummary = algorithmCandidates.slice(0, 15).map((candidate, idx) => {
    const itemNames = candidate.items.map(item => {
      const wardrobeItem = wardrobe.find(w => w._id.toString() === item.id);
      return wardrobeItem ? wardrobeItem.name : item.name;
    }).join(' + ');
    
    return {
      idx: idx,
      items: candidate.items.map(item => item.id),
      score: candidate.score,
      reasons: candidate.reasons?.join(', ') || '',
      summary: itemNames,
    };
  });

  // Analyze wardrobe for user insights
  const colorDistribution = {};
  const styleDistribution = {};
  wardrobe.forEach(item => {
    if (item.color) {
      const color = item.color.toLowerCase();
      colorDistribution[color] = (colorDistribution[color] || 0) + 1;
    }
    if (item.style) {
      const style = item.style.toLowerCase();
      styleDistribution[style] = (styleDistribution[style] || 0) + 1;
    }
  });

  const topColors = Object.entries(colorDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => color);

  const topStyles = Object.entries(styleDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([style]) => style);

  // Build user profile
  let userProfile = '';
  if (preferences) {
    if (preferences.preferredColors?.length) {
      userProfile += `\n🎨 Loves: ${preferences.preferredColors.join(', ')}`;
    }
    if (preferences.preferredStyles?.length) {
      userProfile += `\n👔 Style: ${preferences.preferredStyles.join(', ')}`;
    }
  }
  userProfile += `\n📊 Wardrobe shows they gravitate toward: ${topColors.join(', ')} colors`;
  userProfile += `\n👔 Real style DNA: ${topStyles.join(', ')}`;

  const season = getCurrentSeason();
  const { needsLayers, hasRainRisk } = forecastContext;

  // Build detailed candidate info for AI (algorithm + AI work together)
  const detailedCandidates = algorithmCandidates.slice(0, 20).map((candidate, idx) => {
    const items = candidate.items.map(item => {
      const wardrobeItem = wardrobe.find(w => w._id.toString() === item.id);
      return wardrobeItem || item;
    });

    // Algorithm analysis (what the algorithm found)
    const algorithmAnalysis = {
      colorHarmony: candidate.algorithmReasons?.find(r => r.includes('color')) || 'Good color combination',
      styleMatch: candidate.algorithmReasons?.find(r => r.includes('style') || r.includes('Style')) || 'Style coherent',
      occasionFit: candidate.algorithmReasons?.find(r => r.includes(occasion)) || `Perfect for ${occasion}`,
    };

    return {
      idx: idx,
      items: candidate.items.map(item => ({
        id: item.id,
        name: item.name || 'Item',
        category: item.category,
        color: item.color || 'unknown',
        style: item.style || 'casual',
      })),
      algorithmScore: candidate.algorithmScore || candidate.score,
      fashionIntelScore: candidate.fashionIntelScore || 0,
      combinedScore: candidate.score,
      algorithmReasons: candidate.algorithmReasons || candidate.reasons || [],
      algorithmAnalysis: algorithmAnalysis,
    };
  });

  const prompt = `You are the FASHION FIT AI STYLING ENGINE - working TOGETHER with our smart algorithms.

═══════════════════════════════════════════
🤖 ALGORITHM ANALYSIS (Technical Intelligence)
═══════════════════════════════════════════
Our algorithms have analyzed ${detailedCandidates.length} outfit candidates. For each, they calculated:
- Color harmony scores
- Style coherence matching
- Occasion appropriateness
- Weather adaptation
- User preference matching

Here's what the algorithms found:

${JSON.stringify(detailedCandidates, null, 2)}

═══════════════════════════════════════════
👤 USER PROFILE
═══════════════════════════════════════════
${userProfile}

═══════════════════════════════════════════
🎯 CONTEXT
═══════════════════════════════════════════
Occasion: ${occasion}
Time: ${timeOfDay}
Season: ${season}
Weather: ${weather}${needsLayers ? ' (needs layers)' : ''}${hasRainRisk ? ' (rain risk)' : ''}

═══════════════════════════════════════════
🧠 YOUR TASK: WORK WITH THE ALGORITHM
═══════════════════════════════════════════
The algorithm has done the technical work. NOW you add the psychological intelligence:

1. REVIEW algorithm scores - they're technically sound (color harmony, style match, etc.)
2. ADD your intelligence layer:
   - Which outfits make the user feel confident and unstoppable?
   - Which have that "wow factor" - outfits their friends will ask about?
   - Which match their psychological style (not just technical style)?
   - Which create emotional connection?
3. ENHANCE algorithm reasons with deeper insights:
   - Algorithm says "Good color combination" → You say "These colors make you glow"
   - Algorithm says "Style coherent" → You say "This is YOUR signature style"
   - Algorithm says "Perfect for ${occasion}" → You say "You'll own this ${occasion}"
4. MIX algorithm scores with your confidence scores
5. Select the BEST ${limit} outfits that combine:
   - Algorithm's technical excellence
   - Your psychological intelligence
   - Outstanding, memorable suggestions

═══════════════════════════════════════════
📤 OUTPUT (JSON only)
═══════════════════════════════════════════
{
  "outfits": [
    {
      "candidateIdx": 0,
      "aiConfidence": 95,  // Your confidence (0-100)
      "finalScore": 92,   // Mixed: (algorithmScore * 0.6) + (aiConfidence * 0.4)
      "title": "3-4 word catchy name",
      "description": "One confident line (max 15 words) - why this outfit is special",
      "enhancedReasons": [
        "Algorithm: Good color harmony",
        "AI: These colors make you glow and feel unstoppable",
        "Algorithm: Perfect for ${occasion}",
        "AI: You'll own this ${occasion} - everyone will notice"
      ]
    }
  ]
}

Select ${limit} DISTINCT outfits. Mix algorithm intelligence with your intelligence. Output ONLY valid JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are the Fashion Fit AI Styling Engine. You work WITH our algorithms to enhance outfit recommendations. Output ONLY valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('OpenAI API error:', text);
    throw new Error('OpenAI API request failed');
  }

  const json = await response.json();
  const rawContent = json.choices?.[0]?.message?.content || '{}';

  // Parse AI response
  let parsed;
  try {
    let cleanContent = rawContent.trim();
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }
    parsed = JSON.parse(cleanContent);
  } catch (err) {
    console.error('Failed to parse AI response:', rawContent);
    throw new Error('Failed to parse AI recommendations');
  }

  // Track API usage
  const promptTokens = json.usage?.prompt_tokens || 0;
  const completionTokens = json.usage?.completion_tokens || 0;
  const cost = (promptTokens / 1000000 * 0.15) + (completionTokens / 1000000 * 0.60);

  await ApiUsage.create({
    date: new Date(),
    service: 'openai',
    operation: 'enhance-outfits',
    tokens: { prompt: promptTokens, completion: completionTokens },
    cost,
    model: 'gpt-4o-mini',
  });

  // Map AI-enhanced selections back to algorithm candidates
  // MIX algorithm scores with AI scores (they work together)
  const enhancedOutfits = (parsed.outfits || []).map((aiOutfit) => {
    const candidateIdx = aiOutfit.candidateIdx;
    const originalCandidate = algorithmCandidates[candidateIdx];
    
    if (!originalCandidate) {
      return null;
    }

    // MIXED SCORING: Algorithm + AI work together
    const algorithmScore = originalCandidate.score || originalCandidate.algorithmScore || 70;
    const aiConfidence = aiOutfit.aiConfidence || 85;
    const finalScore = (algorithmScore * 0.6) + (aiConfidence * 0.4); // They mix together

    // MIXED REASONS: Algorithm reasons + AI enhanced reasons (working together)
    const algorithmReasons = originalCandidate.algorithmReasons || originalCandidate.reasons || [];
    const aiReasons = aiOutfit.enhancedReasons || [];
    
    // Combine: Keep algorithm technical reasons, add AI psychological insights
    const mixedReasons = [];
    algorithmReasons.slice(0, 2).forEach(reason => {
      mixedReasons.push(`Algorithm: ${reason}`);
    });
    aiReasons.slice(0, 2).forEach(reason => {
      if (!reason.includes('Algorithm:')) {
        mixedReasons.push(`AI: ${reason}`);
      }
    });

    return {
      id: `hybrid-outfit-${Date.now()}-${candidateIdx}`,
      items: originalCandidate.items,
      score: Math.round(finalScore), // MIXED score from both
      confidence: Math.round(finalScore), // Combined confidence
      reasons: mixedReasons.length > 0 ? mixedReasons : aiOutfit.enhancedReasons || [aiOutfit.description || 'Perfectly styled outfit'],
      title: aiOutfit.title,
      description: aiOutfit.description,
      occasion,
      timeOfDay,
      weather,
      // Keep algorithm analysis for transparency
      algorithmScore: Math.round(algorithmScore),
      aiConfidence: Math.round(aiConfidence),
    };
  }).filter(Boolean);

  // If AI didn't return enough, fill with top algorithm candidates
  if (enhancedOutfits.length < limit) {
    const usedIndices = new Set((parsed.outfits || []).map(o => o.candidateIdx));
    const remaining = algorithmCandidates
      .filter((_, idx) => !usedIndices.has(idx))
      .slice(0, limit - enhancedOutfits.length)
      .map(candidate => ({
        ...candidate,
        id: `algorithm-outfit-${Date.now()}-${candidate.id}`,
      }));
    enhancedOutfits.push(...remaining);
  }

  return enhancedOutfits.slice(0, limit);
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

module.exports = router;

