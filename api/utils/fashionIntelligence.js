/**
 * Advanced Fashion Intelligence Module
 * Deep occasion, time-of-day, weather, and style awareness
 */

// ---------------------------------------------------------------------------
// OCCASION PROFILES — each occasion has a distinct personality
// ---------------------------------------------------------------------------

const OCCASION_PROFILES = {
  casual: {
    vibe: 'relaxed, effortless, comfortable',
    preferredStyles: ['casual', 'minimalist', 'streetwear', 'bohemian', 'sporty'],
    acceptableStyles: ['classic', 'vintage', 'romantic'],
    avoidStyles: [],
    preferDresses: true,
    preferAccessories: true,
    formalityRange: [0, 0.4],
    colorMood: 'any',
    shoeFit: ['sneakers', 'sandals', 'flats', 'boots', 'loafers'],
  },
  work: {
    vibe: 'polished, professional, put-together',
    preferredStyles: ['classic', 'minimalist', 'formal', 'elegant'],
    acceptableStyles: ['casual'],
    avoidStyles: ['athletic', 'sporty', 'bohemian'],
    preferDresses: true,
    preferAccessories: true,
    formalityRange: [0.4, 0.8],
    colorMood: 'neutral-forward',
    shoeFit: ['loafers', 'heels', 'oxfords', 'dress', 'flats', 'boots'],
  },
  date: {
    vibe: 'confident, attractive, put-together but not trying too hard',
    preferredStyles: ['elegant', 'romantic', 'classic', 'minimalist'],
    acceptableStyles: ['casual', 'bohemian', 'vintage'],
    avoidStyles: ['athletic', 'sporty'],
    preferDresses: true,
    preferAccessories: true,
    formalityRange: [0.3, 0.7],
    colorMood: 'warm-inviting',
    shoeFit: ['heels', 'boots', 'loafers', 'dress', 'flats'],
  },
  party: {
    vibe: 'bold, standout, fun, expressive',
    preferredStyles: ['elegant', 'streetwear', 'bold', 'trendy'],
    acceptableStyles: ['casual', 'classic', 'minimalist', 'bohemian', 'vintage', 'romantic'],
    avoidStyles: ['athletic'],
    preferDresses: true,
    preferAccessories: true,
    formalityRange: [0.3, 0.8],
    colorMood: 'bold-statement',
    shoeFit: ['heels', 'boots', 'sneakers', 'dress'],
  },
  gym: {
    vibe: 'functional, comfortable, performance-ready',
    preferredStyles: ['athletic', 'sporty'],
    acceptableStyles: ['casual', 'streetwear'],
    avoidStyles: ['formal', 'elegant', 'classic', 'romantic', 'bohemian', 'vintage'],
    preferDresses: false,
    preferAccessories: false,
    formalityRange: [0, 0.15],
    colorMood: 'energetic',
    shoeFit: ['sneakers', 'athletic'],
  },
  formal: {
    vibe: 'refined, sophisticated, impeccable',
    preferredStyles: ['formal', 'classic', 'elegant'],
    acceptableStyles: ['minimalist'],
    avoidStyles: ['sporty', 'athletic', 'bohemian', 'streetwear'],
    preferDresses: true,
    preferAccessories: true,
    formalityRange: [0.7, 1.0],
    colorMood: 'refined-dark',
    shoeFit: ['dress', 'heels', 'oxfords', 'loafers'],
  },
};

// ---------------------------------------------------------------------------
// TIME-OF-DAY PROFILES — how time shifts styling decisions
// ---------------------------------------------------------------------------

const TIME_PROFILES = {
  morning: {
    vibe: 'fresh, clean, energised',
    preferLightColors: true,
    preferDarkColors: false,
    energyLevel: 'bright',
    layerFriendly: true,
    accessoryWeight: 'light',
    colorBoost: ['white', 'cream', 'beige', 'light blue', 'pastel', 'mint', 'pink', 'yellow', 'coral'],
    colorPenalty: [],
  },
  afternoon: {
    vibe: 'balanced, versatile, confident',
    preferLightColors: false,
    preferDarkColors: false,
    energyLevel: 'medium',
    layerFriendly: true,
    accessoryWeight: 'medium',
    colorBoost: [],
    colorPenalty: [],
  },
  evening: {
    vibe: 'elevated, refined, slightly dressy',
    preferLightColors: false,
    preferDarkColors: true,
    energyLevel: 'warm',
    layerFriendly: true,
    accessoryWeight: 'statement',
    colorBoost: ['black', 'navy', 'burgundy', 'emerald', 'deep red', 'charcoal', 'plum'],
    colorPenalty: ['neon', 'bright yellow', 'lime'],
  },
  night: {
    vibe: 'bold, dramatic, head-turning',
    preferLightColors: false,
    preferDarkColors: true,
    energyLevel: 'high',
    layerFriendly: false,
    accessoryWeight: 'statement',
    colorBoost: ['black', 'navy', 'burgundy', 'gold', 'silver', 'emerald', 'deep red', 'plum', 'charcoal'],
    colorPenalty: ['pastel', 'light blue', 'beige', 'cream'],
  },
};

// ---------------------------------------------------------------------------
// ITEM-LEVEL APPROPRIATENESS — blocks specific items per occasion+time
// ---------------------------------------------------------------------------

// Keywords in item name/subcategory that are inappropriate for each occasion
const OCCASION_ITEM_BLOCKLIST = {
  date: ['short', 'tank top', 'flip flop', 'slides', 'crocs', 'sweatpants', 'jogger', 'gym', 'athletic', 'sport bra', 'sports bra', 'tracksuit', 'track pant', 'basketball', 'running', 'workout', 'hoodie'],
  work: ['short', 'tank top', 'crop top', 'flip flop', 'slides', 'crocs', 'sweatpants', 'jogger', 'gym', 'athletic', 'sport bra', 'sports bra', 'tracksuit', 'track pant', 'basketball', 'running', 'workout', 'ripped', 'distressed', 'graphic tee', 'hoodie'],
  formal: ['short', 'tank top', 'crop top', 'flip flop', 'slides', 'crocs', 'sweatpants', 'jogger', 'gym', 'athletic', 'sport bra', 'sports bra', 'tracksuit', 'track pant', 'basketball', 'running', 'workout', 'ripped', 'distressed', 'graphic tee', 'hoodie', 'sneaker', 'trainer', 'denim', 'jean', 'cargo', 'sandal', 'beanie'],
  party: ['sweatpants', 'jogger', 'gym', 'athletic', 'sport bra', 'sports bra', 'tracksuit', 'track pant', 'running', 'workout', 'flip flop', 'slides', 'crocs'],
  gym: ['heels', 'heel', 'dress shoe', 'oxford', 'loafer', 'blazer', 'suit', 'tie', 'bowtie', 'silk', 'satin', 'chiffon', 'formal'],
  casual: [],
};

// Time-of-day item adjustments (morning date ≠ evening date)
const TIME_ITEM_BLOCKLIST = {
  morning: { date: ['mini skirt', 'mini dress', 'bodycon', 'sequin', 'glitter', 'leather pants', 'clubwear'], party: [] },
  afternoon: { date: [], party: [] },
  evening: { casual: [], work: [] },
  night: { casual: [], work: [] },
};

// Items PREFERRED for specific occasion+time combos (boost these)
const OCCASION_ITEM_BOOSTLIST = {
  date: { morning: ['blouse', 'shirt', 'trouser', 'chino', 'skirt', 'dress', 'loafer', 'flat', 'ankle boot'], evening: ['dress', 'heels', 'blazer', 'silk', 'satin', 'jewelry'], night: ['dress', 'heels', 'blazer', 'silk', 'satin', 'jewelry', 'clutch'] },
  work: { morning: ['shirt', 'blouse', 'trouser', 'blazer', 'loafer', 'oxford'], afternoon: ['shirt', 'blouse', 'trouser', 'blazer'], evening: [] },
  formal: { morning: ['suit', 'blazer', 'dress shirt', 'trouser', 'oxford'], evening: ['suit', 'blazer', 'dress', 'gown', 'heels', 'tie'], night: ['suit', 'blazer', 'dress', 'gown', 'heels'] },
  gym: { morning: ['sneaker', 'trainer', 'legging', 'shorts', 'tank', 'sport'], afternoon: ['sneaker', 'trainer', 'legging', 'shorts'], evening: [] },
  party: { evening: ['dress', 'heels', 'blazer', 'sequin', 'statement', 'bold'], night: ['dress', 'heels', 'blazer', 'sequin', 'statement', 'bold', 'leather'] },
  casual: { morning: ['sneaker', 'jeans', 'tee', 't-shirt', 'casual'], afternoon: [], evening: [] },
};

/**
 * Score how appropriate a single item is for the given occasion + time.
 * Returns { score: 0-1, boost: number }
 *   score 1.0 = perfect fit, 0.5 = acceptable, 0.0 = worst match
 *   Items are NEVER fully blocked — we rank, not reject.
 *   If the user only has shorts, we still use them but score them lower.
 */
function checkItemAppropriateness(item, occasion, timeOfDay) {
  const name = (item.name || '').toLowerCase();
  const sub = (item.subcategory || '').toLowerCase();
  const text = `${name} ${sub}`;

  let score = 0.5; // neutral starting point

  // Penalise items that are a poor match (but don't block)
  const occasionPenalty = OCCASION_ITEM_BLOCKLIST[occasion] || [];
  if (occasionPenalty.some(keyword => text.includes(keyword))) {
    score = 0.1; // heavy penalty but still usable as last resort
  }

  // Additional time-specific penalty
  const timePenalty = TIME_ITEM_BLOCKLIST[timeOfDay]?.[occasion] || [];
  if (timePenalty.some(keyword => text.includes(keyword))) {
    score = Math.min(score, 0.15);
  }

  // Boost items that are ideal for this occasion + time
  let boost = 0;
  const boostList = OCCASION_ITEM_BOOSTLIST[occasion]?.[timeOfDay] || [];
  if (boostList.some(keyword => text.includes(keyword))) {
    score = Math.max(score, 0.85);
    boost = 0.12;
  }

  // If no penalty and no boost, it's neutral-good
  if (score === 0.5) score = 0.6;

  return { score, boost };
}

// ---------------------------------------------------------------------------
// CHECK FUNCTIONS
// ---------------------------------------------------------------------------

function checkThreeColorRule(items) {
  const colors = items
    .map(item => item.color?.toLowerCase())
    .filter(Boolean)
    .filter(c => !['black', 'white', 'gray', 'grey', 'beige', 'tan', 'navy', 'brown', 'cream', 'ivory', 'charcoal', 'khaki'].includes(c));

  const uniqueColors = new Set(colors);
  if (uniqueColors.size <= 3) return { valid: true, score: 1.0, reason: 'Perfect color balance' };
  if (uniqueColors.size === 4) return { valid: true, score: 0.7, reason: 'Slightly busy palette' };
  return { valid: false, score: 0.3, reason: 'Too many colors — simplify the palette' };
}

function checkPatternMixing(items) {
  const patterns = items.map(item => item.pattern?.toLowerCase()).filter(Boolean).filter(p => p !== 'solid');
  if (patterns.length === 0) return { valid: true, score: 0.85, reason: 'Clean solid-on-solid look' };
  if (patterns.length === 1) return { valid: true, score: 1.0, reason: 'One statement pattern — perfect balance' };
  if (patterns.length === 2) {
    const unique = new Set(patterns);
    if (unique.size === 2) return { valid: true, score: 0.7, reason: 'Mixed patterns — bold but intentional' };
    return { valid: false, score: 0.4, reason: 'Repeated pattern clashes' };
  }
  return { valid: false, score: 0.2, reason: 'Too many patterns — visually noisy' };
}

function checkTextureCompatibility(items) {
  const textures = items.map(item => {
    const name = (item.name || '').toLowerCase();
    if (name.includes('denim') || name.includes('jean')) return 'denim';
    if (name.includes('silk') || name.includes('satin')) return 'silk';
    if (name.includes('cotton') || name.includes('linen')) return 'cotton';
    if (name.includes('wool') || name.includes('cashmere')) return 'wool';
    if (name.includes('leather')) return 'leather';
    if (name.includes('knit') || name.includes('sweater')) return 'knit';
    if (name.includes('polyester') || name.includes('nylon') || name.includes('athletic') || name.includes('sport')) return 'performance';
    return 'unknown';
  }).filter(t => t !== 'unknown');

  const unique = new Set(textures);
  if (unique.size <= 1) return { valid: true, score: 0.8, reason: 'Consistent texture' };

  const compatible = {
    denim: ['cotton', 'knit', 'leather'],
    silk: ['cotton', 'wool'],
    cotton: ['denim', 'silk', 'wool', 'knit', 'leather'],
    wool: ['silk', 'cotton', 'leather', 'knit'],
    leather: ['denim', 'cotton', 'wool', 'knit'],
    knit: ['denim', 'cotton', 'wool', 'leather'],
    performance: ['performance', 'cotton'],
  };

  const arr = Array.from(unique);
  let compat = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (compatible[arr[i]]?.includes(arr[j]) || compatible[arr[j]]?.includes(arr[i])) compat++;
    }
  }
  if (compat > 0) return { valid: true, score: 0.9, reason: 'Textures complement each other' };
  return { valid: true, score: 0.6, reason: 'Experimental texture mix' };
}

/**
 * Deep occasion awareness — scores how well an outfit fits the occasion
 * Now includes item-level appropriateness checking
 */
function checkOccasionRules(items, occasion, timeOfDay) {
  const profile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
  const categories = items.map(i => i.category);
  const styles = items.map(i => (i.style || '').toLowerCase()).filter(Boolean);

  const hasCoverage = (categories.includes('top') && categories.includes('bottom')) || categories.includes('dress');
  if (!hasCoverage) return { valid: false, score: 0.2, reason: `Incomplete outfit for ${occasion}` };

  let score = 0.5;
  let reason = `Suitable for ${occasion}`;

  // Item-level appropriateness scoring (prefers better items, penalises poor fits)
  let itemScoreTotal = 0;
  let boostTotal = 0;
  items.forEach(item => {
    const check = checkItemAppropriateness(item, occasion, timeOfDay || 'afternoon');
    itemScoreTotal += check.score;
    boostTotal += check.boost;
  });

  const avgItemFit = itemScoreTotal / Math.max(items.length, 1);
  score += (avgItemFit - 0.5) * 0.35; // Items that fit well boost, poor items penalise
  score += Math.min(boostTotal, 0.15);

  if (avgItemFit < 0.3) {
    reason = `Some items could be better for ${occasion}`;
  }

  // Style-level checks
  const preferredHits = styles.filter(s => profile.preferredStyles.includes(s)).length;
  const acceptableHits = styles.filter(s => profile.acceptableStyles.includes(s)).length;
  const avoidHits = styles.filter(s => profile.avoidStyles.includes(s)).length;

  score += (preferredHits / Math.max(styles.length, 1)) * 0.3;
  score += (acceptableHits / Math.max(styles.length, 1)) * 0.08;
  score -= (avoidHits / Math.max(styles.length, 1)) * 0.35;

  // Shoe appropriateness
  const hasShoes = categories.includes('shoes');
  if (hasShoes) {
    const shoe = items.find(i => i.category === 'shoes');
    const shoeName = (shoe?.name || shoe?.subcategory || '').toLowerCase();
    const shoeMatch = profile.shoeFit.some(sf => shoeName.includes(sf));
    if (shoeMatch) {
      score += 0.08;
      if (avgItemFit >= 0.5) reason = `Perfect footwear for ${occasion}`;
    }
  }

  if (!profile.preferDresses && categories.includes('dress')) score -= 0.2;

  const hasAccessories = categories.includes('accessory');
  if (profile.preferAccessories && hasAccessories) score += 0.05;
  if (!profile.preferAccessories && hasAccessories) score -= 0.05;

  if (avgItemFit >= 0.5 && preferredHits === styles.length && styles.length > 0) {
    reason = `Nails the ${occasion} vibe`;
  }

  return { valid: true, score: Math.max(0.1, Math.min(1.0, score)), reason };
}

/**
 * Time-of-day awareness — scores how well colors and energy match the time
 */
function checkTimeOfDayFit(items, timeOfDay) {
  const profile = TIME_PROFILES[timeOfDay] || TIME_PROFILES.afternoon;
  const colors = items.map(i => (i.color || '').toLowerCase()).filter(Boolean);

  let score = 0.6;
  let reason = `Good for ${timeOfDay}`;

  let boostHits = 0;
  let penaltyHits = 0;
  colors.forEach(c => {
    if (profile.colorBoost.some(boost => c.includes(boost))) boostHits++;
    if (profile.colorPenalty.some(pen => c.includes(pen))) penaltyHits++;
  });

  score += (boostHits / Math.max(colors.length, 1)) * 0.25;
  score -= (penaltyHits / Math.max(colors.length, 1)) * 0.2;

  if (profile.preferDarkColors) {
    const darkColors = ['black', 'navy', 'charcoal', 'burgundy', 'dark', 'deep', 'plum', 'emerald'];
    const darkHits = colors.filter(c => darkColors.some(d => c.includes(d))).length;
    score += (darkHits / Math.max(colors.length, 1)) * 0.15;
  }
  if (profile.preferLightColors) {
    const lightColors = ['white', 'cream', 'beige', 'light', 'pastel', 'ivory', 'mint', 'sky'];
    const lightHits = colors.filter(c => lightColors.some(l => c.includes(l))).length;
    score += (lightHits / Math.max(colors.length, 1)) * 0.15;
  }

  if (boostHits >= 2) reason = `Colors are perfect for ${timeOfDay}`;
  else if (penaltyHits > 0) reason = `Colors may feel off for ${timeOfDay}`;

  return { valid: true, score: Math.max(0.3, Math.min(1.0, score)), reason };
}

function checkProportions(items) {
  const categories = items.map(i => i.category);
  const hasTop = categories.includes('top') || categories.includes('dress');
  const hasBottom = categories.includes('bottom') || categories.includes('dress');
  const hasShoes = categories.includes('shoes');
  const hasOuterwear = categories.includes('outerwear');

  let score = 0.5;
  if (hasTop && hasBottom) score += 0.3;
  if (hasShoes) score += 0.15;
  if (hasOuterwear) score += 0.05;

  const counts = {};
  categories.forEach(cat => { counts[cat] = (counts[cat] || 0) + 1; });
  if (Math.max(...Object.values(counts)) > 2) score -= 0.2;

  return { valid: true, score: Math.max(0.3, Math.min(1.0, score)), reason: 'Well-proportioned silhouette' };
}

function checkSeasonalColors(items, weather) {
  const palettes = {
    hot: { preferred: ['white', 'beige', 'light blue', 'pastel', 'yellow', 'coral', 'mint', 'cream'], avoid: ['black', 'burgundy', 'dark'] },
    warm: { preferred: ['coral', 'peach', 'yellow', 'light blue', 'mint', 'pink', 'white'], avoid: ['burgundy'] },
    cool: { preferred: ['navy', 'burgundy', 'olive', 'mustard', 'deep red', 'charcoal', 'brown'], avoid: [] },
    cold: { preferred: ['black', 'navy', 'burgundy', 'gray', 'charcoal', 'deep', 'dark', 'brown', 'olive'], avoid: ['pastel', 'light'] },
  };

  const palette = palettes[weather] || palettes.warm;
  const colors = items.map(i => (i.color || '').toLowerCase()).filter(Boolean);

  let score = 0.55;
  colors.forEach(c => {
    if (palette.preferred.some(p => c.includes(p))) score += 0.12;
    if (palette.avoid.some(a => c.includes(a))) score -= 0.1;
  });

  return { valid: true, score: Math.max(0.3, Math.min(1.0, score)), reason: `Weather-appropriate colors` };
}

function checkAccessoryCoordination(items) {
  const accessories = items.filter(i => i.category === 'accessory');
  const main = items.filter(i => i.category !== 'accessory');

  if (accessories.length === 0) return { valid: true, score: 0.8, reason: 'Clean, no-accessory look' };
  if (accessories.length > 3) return { valid: false, score: 0.4, reason: 'Over-accessorised' };

  const mainColors = main.map(i => (i.color || '').toLowerCase()).filter(Boolean);
  const accColors = accessories.map(i => (i.color || '').toLowerCase()).filter(Boolean);

  const neutrals = new Set(['black', 'white', 'gray', 'grey', 'beige', 'brown', 'tan', 'gold', 'silver', 'cream', 'navy']);
  const matchCount = accColors.filter(ac =>
    mainColors.some(mc => mc === ac || mc.includes(ac) || ac.includes(mc)) || neutrals.has(ac)
  ).length;

  if (matchCount > 0) return { valid: true, score: 0.92, reason: 'Accessories tie the look together' };
  return { valid: true, score: 0.65, reason: 'Accessories add contrast' };
}

// ---------------------------------------------------------------------------
// WEATHER COMPLETENESS CHECK — does the outfit handle current conditions?
// ---------------------------------------------------------------------------

function checkWeatherCompleteness(items, weather, weatherDetail) {
  const wd = weatherDetail || {};
  let score = 0.6;
  let reason = 'Weather-appropriate';
  const itemDescs = items.map(i => `${i.name} ${i.subcategory} ${(i.tags || []).join(' ')} ${i.style || ''}`.toLowerCase());

  const lightFabrics = ['linen', 'cotton', 'silk', 'chiffon', 'rayon', 'mesh', 'seersucker'];
  const heavyFabrics = ['wool', 'cashmere', 'fleece', 'leather', 'suede', 'tweed', 'corduroy', 'velvet', 'knit', 'sweater'];
  const hasOuterwear = items.some(i => i.category === 'outerwear');
  const hasLight = itemDescs.some(d => lightFabrics.some(f => d.includes(f)));
  const hasHeavy = itemDescs.some(d => heavyFabrics.some(f => d.includes(f)));
  const hasOpenShoes = itemDescs.some(d => ['sandal', 'flip flop', 'slides', 'open toe', 'espadrille'].some(f => d.includes(f)));
  const hasClosedShoes = items.some(i => i.category === 'shoes') && !hasOpenShoes;
  const hasRainGear = itemDescs.some(d => ['rain', 'waterproof', 'trench', 'windbreaker', 'parka', 'anorak'].some(f => d.includes(f)));
  const hasShorts = items.some(i => i.category === 'bottom' && `${i.name} ${i.subcategory}`.toLowerCase().includes('short'));
  const hasSleeveless = itemDescs.some(d => ['sleeveless', 'tank', 'cami', 'strapless'].some(f => d.includes(f)));

  if (weather === 'cold') {
    if (hasOuterwear) { score += 0.15; reason = 'Properly layered for the cold'; }
    else score -= 0.15;
    if (hasHeavy) score += 0.08;
    if (hasLight && !hasOuterwear) score -= 0.10;
    if (hasOpenShoes) score -= 0.12;
    if (hasShorts) score -= 0.12;
    if (hasSleeveless && !hasOuterwear) score -= 0.10;
    if (hasClosedShoes) score += 0.05;
  } else if (weather === 'cool') {
    if (hasOuterwear) { score += 0.10; reason = 'Smart layering for cool weather'; }
    if (hasOpenShoes) score -= 0.06;
    if (hasShorts) score -= 0.06;
  } else if (weather === 'hot') {
    if (hasLight) { score += 0.12; reason = 'Light and breathable for the heat'; }
    if (hasHeavy) score -= 0.12;
    if (hasOuterwear) score -= 0.08;
  } else if (weather === 'warm') {
    if (hasLight) score += 0.06;
    if (hasHeavy) score -= 0.06;
  }

  if (wd.isRainy) {
    if (hasRainGear) { score += 0.12; reason = 'Rain-ready outfit'; }
    else score -= 0.10;
    if (hasOpenShoes) score -= 0.08;
  }
  if (wd.isSnowy) {
    if (hasOuterwear && hasClosedShoes) { score += 0.15; reason = 'Snow-ready warmth'; }
    else score -= 0.12;
    if (hasOpenShoes) score -= 0.12;
    if (hasShorts) score -= 0.12;
  }
  if (wd.isWindy) {
    if (hasOuterwear) score += 0.06;
    const hasFlowy = itemDescs.some(d => ['chiffon', 'sheer', 'flowy'].some(f => d.includes(f)));
    if (hasFlowy) score -= 0.06;
  }
  if (wd.isHumid && weather !== 'cold') {
    if (hasLight) { score += 0.08; reason = 'Breathable for humid conditions'; }
    if (hasHeavy) score -= 0.08;
  }

  return { valid: true, score: Math.max(0.1, Math.min(1.0, score)), reason };
}

// ---------------------------------------------------------------------------
// STYLE COHERENCE — do all items belong to the same style family?
// ---------------------------------------------------------------------------

const STYLE_FAMILIES = {
  classic: ['classic', 'minimalist', 'elegant', 'formal', 'preppy'],
  casual: ['casual', 'streetwear', 'bohemian', 'vintage'],
  athletic: ['athletic', 'sporty', 'activewear'],
  edgy: ['edgy', 'bold', 'punk', 'grunge', 'leather'],
  romantic: ['romantic', 'feminine', 'soft', 'bohemian'],
};

function checkStyleCoherence(items) {
  const styles = items.map(i => (i.style || '').toLowerCase()).filter(Boolean);
  if (styles.length === 0) return { valid: true, score: 0.7, reason: 'Neutral style mix' };

  let bestFamilyMatch = 0;
  let bestFamilyName = '';
  Object.entries(STYLE_FAMILIES).forEach(([family, members]) => {
    const hits = styles.filter(s => members.includes(s)).length;
    const ratio = hits / styles.length;
    if (ratio > bestFamilyMatch) { bestFamilyMatch = ratio; bestFamilyName = family; }
  });

  if (bestFamilyMatch >= 0.8) return { valid: true, score: 1.0, reason: `Cohesive ${bestFamilyName} aesthetic` };
  if (bestFamilyMatch >= 0.5) return { valid: true, score: 0.8, reason: 'Mostly coherent style' };
  if (bestFamilyMatch >= 0.3) return { valid: true, score: 0.6, reason: 'Eclectic style blend' };
  return { valid: true, score: 0.4, reason: 'Clashing style directions' };
}

// ---------------------------------------------------------------------------
// OUTFIT COMPLETENESS — does the outfit have all expected garment slots?
// ---------------------------------------------------------------------------

function checkOutfitCompleteness(items, occasion) {
  const cats = new Set(items.map(i => i.category));
  const hasTop = cats.has('top') || cats.has('outerwear');
  const hasBottom = cats.has('bottom');
  const hasDress = cats.has('dress');
  const hasShoes = cats.has('shoes');
  const hasAccessory = cats.has('accessory');

  const bodyIsCovered = (hasTop && hasBottom) || hasDress;
  if (!bodyIsCovered) return { valid: false, score: 0.15, reason: 'Incomplete — missing core pieces' };

  let score = 0.6;
  let filled = 2; // top+bottom or dress
  if (hasShoes) { score += 0.15; filled++; }

  const profile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
  if (profile.preferAccessories && hasAccessory) { score += 0.1; filled++; }
  if (hasTop && hasBottom && hasDress) score -= 0.05; // redundant

  if (filled >= 4) return { valid: true, score: Math.min(1.0, score + 0.1), reason: 'Fully styled head to toe' };
  if (filled >= 3) return { valid: true, score, reason: 'Well-assembled outfit' };
  return { valid: true, score: Math.max(0.35, score - 0.1), reason: 'Basic outfit — shoes or accessories would elevate it' };
}

// ---------------------------------------------------------------------------
// TREND ALIGNMENT — rewards items tagged with current trend keywords
// ---------------------------------------------------------------------------

const TREND_KEYWORDS = [
  'oversized', 'wide leg', 'baggy', 'cropped', 'layered',
  'neutral', 'earth tone', 'monochrome', 'minimalist', 'quiet luxury',
  'cargo', 'utility', 'sheer', 'mesh', 'knit', 'crochet',
  'statement', 'chunky', 'platform', 'retro', 'vintage',
  'sustainable', 'linen', 'organic', 'denim-on-denim',
];

function checkTrendAlignment(items) {
  let hits = 0;
  const matchedTrends = [];
  items.forEach(item => {
    const text = `${item.name || ''} ${item.subcategory || ''} ${(item.tags || []).join(' ')} ${item.style || ''} ${item.pattern || ''}`.toLowerCase();
    TREND_KEYWORDS.forEach(kw => {
      if (text.includes(kw) && !matchedTrends.includes(kw)) {
        hits++;
        matchedTrends.push(kw);
      }
    });
  });

  if (hits >= 3) return { valid: true, score: 1.0, reason: `On-trend (${matchedTrends.slice(0, 2).join(', ')})` };
  if (hits === 2) return { valid: true, score: 0.85, reason: 'Touches on current trends' };
  if (hits === 1) return { valid: true, score: 0.7, reason: 'Subtle trend nod' };
  return { valid: true, score: 0.5, reason: 'Timeless over trendy' };
}

// ---------------------------------------------------------------------------
// VERSATILITY SCORING — can pieces be re-worn in other contexts?
// ---------------------------------------------------------------------------

function checkVersatility(items) {
  const versatileKeywords = [
    'jeans', 'denim', 'chino', 'trouser', 'shirt', 'blouse', 't-shirt', 'tee',
    'sneaker', 'loafer', 'boot', 'flat', 'blazer', 'cardigan', 'sweater',
    'skirt', 'polo', 'knit', 'hoodie',
  ];
  const nicheKeywords = [
    'sequin', 'glitter', 'gown', 'tuxedo', 'costume', 'neon',
    'uniform', 'jersey', 'wetsuit', 'ski',
  ];

  let versatileCount = 0;
  let nicheCount = 0;
  items.forEach(item => {
    const text = `${item.name || ''} ${item.subcategory || ''}`.toLowerCase();
    if (versatileKeywords.some(v => text.includes(v))) versatileCount++;
    if (nicheKeywords.some(n => text.includes(n))) nicheCount++;
  });

  const ratio = versatileCount / Math.max(items.length, 1);
  if (nicheCount >= 2) return { valid: true, score: 0.35, reason: 'Occasion-specific pieces — low reuse potential' };
  if (ratio >= 0.7) return { valid: true, score: 1.0, reason: 'Highly versatile — every piece works elsewhere' };
  if (ratio >= 0.5) return { valid: true, score: 0.8, reason: 'Good mix of versatile pieces' };
  if (ratio >= 0.3) return { valid: true, score: 0.6, reason: 'Some versatile items' };
  return { valid: true, score: 0.45, reason: 'Specialised outfit' };
}

// ---------------------------------------------------------------------------
// WOW FACTOR — does the outfit have a standout element?
// ---------------------------------------------------------------------------

function checkWowFactor(items, occasion) {
  const wowKeywords = [
    'statement', 'bold', 'designer', 'luxury', 'silk', 'satin', 'velvet',
    'leather', 'sequin', 'metallic', 'gold', 'silver', 'embroidered',
    'handmade', 'vintage', 'unique', 'custom', 'limited', 'collab',
    'chunky', 'platform', 'oversized', 'dramatic',
  ];

  let wowHits = 0;
  let wowReasons = [];
  items.forEach(item => {
    const text = `${item.name || ''} ${item.subcategory || ''} ${(item.tags || []).join(' ')} ${item.brand || ''}`.toLowerCase();
    wowKeywords.forEach(kw => {
      if (text.includes(kw)) { wowHits++; if (!wowReasons.includes(kw)) wowReasons.push(kw); }
    });
  });

  // Branded items add wow
  const hasBrand = items.some(i => i.brand && i.brand.length > 1);
  if (hasBrand) wowHits++;

  // Color pop: one bright item against neutrals
  const colors = items.map(i => (i.color || '').toLowerCase()).filter(Boolean);
  const neutrals = ['black', 'white', 'gray', 'grey', 'beige', 'navy', 'brown', 'cream', 'khaki', 'tan'];
  const neutralCount = colors.filter(c => neutrals.some(n => c.includes(n))).length;
  const popCount = colors.length - neutralCount;
  if (popCount === 1 && neutralCount >= 2) { wowHits += 2; wowReasons.push('color pop'); }

  // Gym/casual have lower wow expectations
  const lowWowOccasions = ['gym', 'casual'];
  const threshold = lowWowOccasions.includes(occasion) ? 1 : 2;

  if (wowHits >= threshold + 2) return { valid: true, score: 1.0, reason: `Head-turner (${wowReasons.slice(0, 2).join(', ')})` };
  if (wowHits >= threshold) return { valid: true, score: 0.8, reason: 'Has a standout element' };
  if (wowHits >= 1) return { valid: true, score: 0.6, reason: 'Subtle distinction' };
  return { valid: true, score: 0.4, reason: 'Safe and understated' };
}

// ---------------------------------------------------------------------------
// MAIN EVALUATOR — all 12 algorithms
// ---------------------------------------------------------------------------

function evaluateFashionIntelligence(items, occasion, weather, timeOfDay, weatherDetail) {
  const checks = {
    colorHarmony: checkThreeColorRule(items),
    styleCoherence: checkStyleCoherence(items),
    occasionFit: checkOccasionRules(items, occasion, timeOfDay),
    silhouetteBalance: checkProportions(items),
    patternMixing: checkPatternMixing(items),
    textureHarmony: checkTextureCompatibility(items),
    seasonalColors: checkSeasonalColors(items, weather),
    weatherAdaptation: checkWeatherCompleteness(items, weather, weatherDetail),
    outfitCompleteness: checkOutfitCompleteness(items, occasion),
    trendAlignment: checkTrendAlignment(items),
    versatility: checkVersatility(items),
    wowFactor: checkWowFactor(items, occasion),
    // Bonus checks (not numbered in the 12 but contribute to final score)
    timeOfDayFit: checkTimeOfDayFit(items, timeOfDay || 'afternoon'),
    accessories: checkAccessoryCoordination(items),
  };

  const weights = {
    colorHarmony: 0.09,
    styleCoherence: 0.08,
    occasionFit: 0.14,
    silhouetteBalance: 0.07,
    patternMixing: 0.06,
    textureHarmony: 0.05,
    seasonalColors: 0.06,
    weatherAdaptation: 0.12,
    outfitCompleteness: 0.09,
    trendAlignment: 0.05,
    versatility: 0.05,
    wowFactor: 0.05,
    timeOfDayFit: 0.06,
    accessories: 0.03,
  };

  let totalScore = 0;
  let totalWeight = 0;
  const reasons = [];

  Object.keys(checks).forEach(key => {
    const check = checks[key];
    const weight = weights[key];
    totalScore += check.score * weight;
    totalWeight += weight;
    if (check.score >= 0.7 && check.reason) reasons.push(check.reason);
  });

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0.5;

  const topReasons = reasons.slice(0, 3);
  if (topReasons.length === 0) topReasons.push('Balanced outfit');

  return { score: finalScore, reasons: topReasons, details: checks };
}

module.exports = {
  OCCASION_PROFILES,
  TIME_PROFILES,
  OCCASION_ITEM_BLOCKLIST,
  TIME_ITEM_BLOCKLIST,
  checkItemAppropriateness,
  checkThreeColorRule,
  checkPatternMixing,
  checkTextureCompatibility,
  checkOccasionRules,
  checkTimeOfDayFit,
  checkProportions,
  checkSeasonalColors,
  checkAccessoryCoordination,
  checkWeatherCompleteness,
  checkStyleCoherence,
  checkOutfitCompleteness,
  checkTrendAlignment,
  checkVersatility,
  checkWowFactor,
  evaluateFashionIntelligence,
};
