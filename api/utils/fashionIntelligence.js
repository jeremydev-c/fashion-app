/**
 * Advanced Fashion Intelligence Module
 * Based on research in fashion recommendation systems, color theory, and styling best practices
 */

/**
 * The 3-Color Rule: Outfits should have max 3 main colors for visual harmony
 */
function checkThreeColorRule(items) {
  const colors = items
    .map(item => item.color?.toLowerCase())
    .filter(Boolean)
    .filter(c => !['black', 'white', 'gray', 'grey', 'beige', 'tan', 'navy', 'brown'].includes(c));
  
  const uniqueColors = new Set(colors);
  
  if (uniqueColors.size <= 3) {
    return { valid: true, score: 1.0, reason: 'Perfect color balance' };
  } else if (uniqueColors.size === 4) {
    return { valid: true, score: 0.7, reason: 'Slightly too many colors' };
  } else {
    return { valid: false, score: 0.3, reason: 'Too many colors - breaks 3-color rule' };
  }
}

/**
 * Pattern Mixing Rules (based on fashion styling best practices)
 */
function checkPatternMixing(items) {
  const patterns = items
    .map(item => item.pattern?.toLowerCase())
    .filter(Boolean)
    .filter(p => p !== 'solid');
  
  if (patterns.length === 0) {
    return { valid: true, score: 0.8, reason: 'All solid - safe and elegant' };
  }
  
  if (patterns.length === 1) {
    return { valid: true, score: 1.0, reason: 'One pattern - perfect balance' };
  }
  
  if (patterns.length === 2) {
    // Two patterns can work if they're different scales
    const patternTypes = new Set(patterns);
    if (patternTypes.size === 2) {
      // Different patterns can work (e.g., stripes + florals)
      return { valid: true, score: 0.7, reason: 'Two different patterns - bold but can work' };
    } else {
      // Same pattern twice - usually too much
      return { valid: false, score: 0.4, reason: 'Repeating same pattern - too busy' };
    }
  }
  
  // More than 2 patterns is usually too much
  return { valid: false, score: 0.2, reason: 'Too many patterns - visually overwhelming' };
}

/**
 * Texture and Fabric Compatibility
 */
function checkTextureCompatibility(items) {
  const textures = items.map(item => {
    const name = (item.name || '').toLowerCase();
    if (name.includes('denim') || name.includes('jean')) return 'denim';
    if (name.includes('silk') || name.includes('satin')) return 'silk';
    if (name.includes('cotton') || name.includes('linen')) return 'cotton';
    if (name.includes('wool') || name.includes('cashmere')) return 'wool';
    if (name.includes('leather')) return 'leather';
    if (name.includes('knit') || name.includes('sweater')) return 'knit';
    return 'unknown';
  }).filter(t => t !== 'unknown');
  
  const uniqueTextures = new Set(textures);
  
  // Mixing textures is good, but some combinations work better
  const compatibleTextures = {
    denim: ['cotton', 'knit', 'leather'],
    silk: ['cotton', 'wool'],
    cotton: ['denim', 'silk', 'wool', 'knit'],
    wool: ['silk', 'cotton', 'leather'],
    leather: ['denim', 'cotton', 'wool'],
    knit: ['denim', 'cotton', 'wool'],
  };
  
  if (uniqueTextures.size <= 1) {
    return { valid: true, score: 0.8, reason: 'Consistent texture' };
  }
  
  // Check if textures are compatible
  let compatibleCount = 0;
  const textureArray = Array.from(uniqueTextures);
  for (let i = 0; i < textureArray.length; i++) {
    for (let j = i + 1; j < textureArray.length; j++) {
      const t1 = textureArray[i];
      const t2 = textureArray[j];
      if (compatibleTextures[t1]?.includes(t2) || compatibleTextures[t2]?.includes(t1)) {
        compatibleCount++;
      }
    }
  }
  
  if (compatibleCount > 0) {
    return { valid: true, score: 0.9, reason: 'Textures complement each other' };
  }
  
  return { valid: true, score: 0.6, reason: 'Mixed textures - experimental' };
}

/**
 * Occasion-Specific Styling Rules
 */
function checkOccasionRules(items, occasion) {
  const rules = {
    formal: {
      required: ['top', 'bottom', 'shoes'],
      preferredStyles: ['formal', 'classic', 'elegant'],
      avoidStyles: ['sporty', 'casual'],
      minItems: 3,
    },
    work: {
      required: ['top', 'bottom'],
      preferredStyles: ['classic', 'minimalist', 'professional'],
      avoidStyles: ['sporty', 'bohemian'],
      minItems: 3,
    },
    casual: {
      required: ['top', 'bottom'],
      preferredStyles: ['casual', 'sporty', 'minimalist'],
      minItems: 2,
    },
    date: {
      required: ['top', 'bottom'],
      preferredStyles: ['elegant', 'romantic', 'classic'],
      minItems: 3,
    },
    party: {
      required: ['top', 'bottom'],
      preferredStyles: ['bold', 'trendy', 'elegant'],
      minItems: 3,
    },
  };
  
  const rule = rules[occasion] || rules.casual;
  const categories = items.map(item => item.category);
  
  // Check required categories
  const hasRequired = rule.required.every(req => 
    categories.includes(req) || categories.includes('dress')
  );
  
  if (!hasRequired) {
    return { valid: false, score: 0.3, reason: `Missing required items for ${occasion}` };
  }
  
  // Check style appropriateness
  const styles = items.map(item => item.style?.toLowerCase()).filter(Boolean);
  const hasPreferredStyle = rule.preferredStyles?.some(style => 
    styles.includes(style.toLowerCase())
  );
  const hasAvoidedStyle = rule.avoidStyles?.some(style => 
    styles.includes(style.toLowerCase())
  );
  
  let score = 0.7;
  if (hasPreferredStyle) score += 0.2;
  if (hasAvoidedStyle) score -= 0.3;
  
  return { 
    valid: true, 
    score: Math.max(0.3, Math.min(1.0, score)), 
    reason: `Appropriate for ${occasion}` 
  };
}

/**
 * Proportions and Silhouette Balance
 */
function checkProportions(items) {
  const categories = items.map(item => item.category);
  const hasTop = categories.includes('top') || categories.includes('dress');
  const hasBottom = categories.includes('bottom') || categories.includes('dress');
  const hasShoes = categories.includes('shoes');
  const hasOuterwear = categories.includes('outerwear');
  
  // Balanced outfit should have top, bottom, and shoes
  let score = 0.5;
  if (hasTop && hasBottom) score += 0.3;
  if (hasShoes) score += 0.15;
  if (hasOuterwear) score += 0.05;
  
  // Check for balance (not too many of one category)
  const categoryCounts = {};
  categories.forEach(cat => {
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  
  const maxCount = Math.max(...Object.values(categoryCounts));
  if (maxCount > 2) {
    score -= 0.2; // Too many of one category
  }
  
  return { 
    valid: true, 
    score: Math.max(0.3, Math.min(1.0, score)), 
    reason: 'Well-proportioned outfit' 
  };
}

/**
 * Seasonal Color Palette Awareness
 */
function checkSeasonalColors(items, weather) {
  const seasonalPalettes = {
    hot: {
      preferred: ['white', 'beige', 'light blue', 'pastel', 'yellow', 'coral', 'mint'],
      avoid: ['black', 'navy', 'burgundy', 'dark'],
    },
    warm: {
      preferred: ['coral', 'peach', 'yellow', 'light blue', 'mint', 'pink'],
      avoid: ['burgundy', 'dark green'],
    },
    cool: {
      preferred: ['navy', 'burgundy', 'olive', 'mustard', 'deep red'],
      avoid: ['pastel', 'light'],
    },
    cold: {
      preferred: ['black', 'navy', 'burgundy', 'gray', 'deep', 'dark'],
      avoid: ['pastel', 'light', 'bright'],
    },
  };
  
  const palette = seasonalPalettes[weather] || seasonalPalettes.warm;
  const colors = items.map(item => item.color?.toLowerCase()).filter(Boolean);
  
  let score = 0.5;
  let preferredCount = 0;
  let avoidedCount = 0;
  
  colors.forEach(color => {
    const colorLower = color.toLowerCase();
    if (palette.preferred.some(pref => colorLower.includes(pref))) {
      preferredCount++;
    }
    if (palette.avoid.some(avoid => colorLower.includes(avoid))) {
      avoidedCount++;
    }
  });
  
  if (preferredCount > 0) score += 0.2 * preferredCount;
  if (avoidedCount > 0) score -= 0.15 * avoidedCount;
  
  return { 
    valid: true, 
    score: Math.max(0.3, Math.min(1.0, score)), 
    reason: `Seasonally appropriate colors for ${weather} weather` 
  };
}

/**
 * Accessory Coordination
 */
function checkAccessoryCoordination(items) {
  const accessories = items.filter(item => item.category === 'accessory');
  const mainItems = items.filter(item => item.category !== 'accessory');
  
  if (accessories.length === 0) {
    return { valid: true, score: 0.8, reason: 'No accessories - clean look' };
  }
  
  if (accessories.length > 3) {
    return { valid: false, score: 0.4, reason: 'Too many accessories - overwhelming' };
  }
  
  // Check if accessories complement main items
  const mainColors = mainItems.map(item => item.color?.toLowerCase()).filter(Boolean);
  const accessoryColors = accessories.map(item => item.color?.toLowerCase()).filter(Boolean);
  
  let matchCount = 0;
  accessoryColors.forEach(accColor => {
    if (mainColors.some(mainColor => 
      mainColor === accColor || 
      mainColor.includes(accColor) || 
      accColor.includes(mainColor)
    )) {
      matchCount++;
    }
  });
  
  if (matchCount > 0) {
    return { valid: true, score: 0.9, reason: 'Accessories complement outfit' };
  }
  
  return { valid: true, score: 0.7, reason: 'Accessories add interest' };
}

/**
 * Comprehensive Fashion Intelligence Check
 */
function evaluateFashionIntelligence(items, occasion, weather) {
  const checks = {
    colorRule: checkThreeColorRule(items),
    patternMixing: checkPatternMixing(items),
    textureCompatibility: checkTextureCompatibility(items),
    occasionRules: checkOccasionRules(items, occasion),
    proportions: checkProportions(items),
    seasonalColors: checkSeasonalColors(items, weather),
    accessories: checkAccessoryCoordination(items),
  };
  
  // Calculate weighted average
  const weights = {
    colorRule: 0.2,
    patternMixing: 0.15,
    textureCompatibility: 0.1,
    occasionRules: 0.25,
    proportions: 0.15,
    seasonalColors: 0.1,
    accessories: 0.05,
  };
  
  let totalScore = 0;
  let totalWeight = 0;
  const reasons = [];
  
  Object.keys(checks).forEach(key => {
    const check = checks[key];
    const weight = weights[key];
    totalScore += check.score * weight;
    totalWeight += weight;
    if (check.reason) {
      reasons.push(check.reason);
    }
  });
  
  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0.5;
  
  return {
    score: finalScore,
    reasons: reasons.slice(0, 3), // Top 3 reasons
    details: checks,
  };
}

module.exports = {
  checkThreeColorRule,
  checkPatternMixing,
  checkTextureCompatibility,
  checkOccasionRules,
  checkProportions,
  checkSeasonalColors,
  checkAccessoryCoordination,
  evaluateFashionIntelligence,
};

