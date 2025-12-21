const express = require('express');
const ClothingItem = require('../models/ClothingItem');
const StyleDNA = require('../models/StyleDNA');
const UserPreferences = require('../models/UserPreferences');
const Outfit = require('../models/Outfit');
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

    // Generate recommendations
    const recommendations = await generateRecommendations({
      wardrobe,
      styleDNA,
      preferences,
      savedOutfits: savedOutfits || [],
      occasion: occasion || 'casual',
      timeOfDay: timeOfDay || 'afternoon',
      weather: weather || 'warm',
      limit: recommendationLimit,
      forecastContext, // Pass forecast to AI
    });

    res.json({ recommendations });
  } catch (err) {
    console.error('GET /recommendations error', err);
    res.status(500).json({ error: 'Failed to generate recommendations' });
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

      // Score the outfit with advanced fashion intelligence
      const baseScore = scoreOutfit(outfit.items, styleDNA, preferences, savedOutfits, occasion, timeOfDay, weather);
      const fashionIntel = evaluateFashionIntelligence(outfit.items, occasion, weather);
      outfit.score = (baseScore * 0.7) + (fashionIntel.score * 0.3);
      
      // Build reasons including forecast intelligence
      const forecastReasons = [];
      if (needsLayers && outfit.items.some(i => i.category === 'outerwear')) {
        forecastReasons.push('Includes layers for temperature changes');
      }
      if (hasRainRisk) {
        forecastReasons.push('Consider rain-friendly options');
      }
      
      outfit.reasons = [
        ...getOutfitReasons(outfit.items, styleDNA, preferences, occasion),
        ...fashionIntel.reasons,
        ...forecastReasons,
      ].slice(0, 4);

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

      // Score the outfit with advanced fashion intelligence
      const baseScore = scoreOutfit(outfit.items, styleDNA, preferences, savedOutfits, occasion, timeOfDay, weather);
      const fashionIntel = evaluateFashionIntelligence(outfit.items, occasion, weather);
      outfit.score = (baseScore * 0.7) + (fashionIntel.score * 0.3);
      
      // Build reasons including forecast intelligence
      const forecastReasons = [];
      if (needsLayers && outfit.items.some(i => i.category === 'outerwear')) {
        forecastReasons.push('Includes layers for temperature changes');
      }
      if (hasRainRisk) {
        forecastReasons.push('Consider rain-friendly options');
      }
      
      outfit.reasons = [
        ...getOutfitReasons(outfit.items, styleDNA, preferences, occasion),
        ...fashionIntel.reasons,
        ...forecastReasons,
      ].slice(0, 4);

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
  
  // First pass: prioritize diverse tops
  for (const rec of recommendations) {
    const top = rec.items.find(item => item.category === 'top');
    const dress = rec.items.find(item => item.category === 'dress');
    
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

module.exports = router;

