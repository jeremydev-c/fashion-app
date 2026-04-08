const SEMANTIC_AXIS_KEYS = [
  'formality',
  'structure',
  'texture',
  'boldness',
  'softness',
  'warmth',
  'polish',
  'ruggedness',
  'minimalism',
  'versatility',
];

const DRESS_CODES = ['very-casual', 'casual', 'smart-casual', 'polished', 'formal'];
const STRUCTURES = ['soft', 'relaxed', 'balanced', 'tailored', 'structured'];
const TEXTURES = ['smooth', 'matte', 'textured', 'distressed', 'crisp', 'knit'];
const SILHOUETTES = ['tailored', 'straight', 'boxy', 'oversized', 'flowy', 'body-skimming'];
const AESTHETICS = [
  'classic',
  'minimalist',
  'romantic',
  'streetwear',
  'edgy',
  'sporty',
  'bohemian',
  'vintage',
  'modern',
  'utilitarian',
  'relaxed',
  'elegant',
];

const DRESS_CODE_VECTORS = {
  'very-casual': [0.10, 0.26, 0.48, 0.36, 0.56, 0.34, 0.16, 0.48, 0.30, 0.74],
  casual: [0.24, 0.38, 0.50, 0.42, 0.52, 0.40, 0.26, 0.42, 0.34, 0.78],
  'smart-casual': [0.54, 0.56, 0.46, 0.42, 0.46, 0.44, 0.56, 0.22, 0.52, 0.80],
  polished: [0.74, 0.68, 0.40, 0.40, 0.40, 0.46, 0.80, 0.12, 0.64, 0.72],
  formal: [0.92, 0.82, 0.34, 0.38, 0.36, 0.48, 0.94, 0.08, 0.76, 0.62],
};

const STRUCTURE_VECTORS = {
  soft: [0.34, 0.16, 0.40, 0.28, 0.82, 0.44, 0.30, 0.18, 0.48, 0.66],
  relaxed: [0.30, 0.28, 0.46, 0.34, 0.72, 0.44, 0.30, 0.24, 0.42, 0.72],
  balanced: [0.50, 0.50, 0.44, 0.36, 0.52, 0.46, 0.48, 0.24, 0.50, 0.76],
  tailored: [0.76, 0.84, 0.36, 0.34, 0.34, 0.44, 0.80, 0.10, 0.68, 0.62],
  structured: [0.72, 0.90, 0.40, 0.40, 0.28, 0.50, 0.78, 0.18, 0.58, 0.58],
};

const TEXTURE_VECTORS = {
  smooth: [0.64, 0.56, 0.16, 0.28, 0.56, 0.40, 0.82, 0.08, 0.64, 0.74],
  matte: [0.46, 0.48, 0.28, 0.30, 0.46, 0.44, 0.46, 0.20, 0.58, 0.80],
  textured: [0.40, 0.52, 0.72, 0.44, 0.38, 0.56, 0.34, 0.46, 0.34, 0.62],
  distressed: [0.16, 0.34, 0.92, 0.62, 0.26, 0.48, 0.14, 0.94, 0.10, 0.38],
  crisp: [0.74, 0.72, 0.24, 0.34, 0.30, 0.42, 0.74, 0.10, 0.70, 0.72],
  knit: [0.30, 0.34, 0.62, 0.26, 0.72, 0.74, 0.30, 0.20, 0.40, 0.66],
};

const SILHOUETTE_VECTORS = {
  tailored: [0.76, 0.86, 0.36, 0.34, 0.28, 0.44, 0.82, 0.10, 0.70, 0.62],
  straight: [0.54, 0.56, 0.38, 0.32, 0.40, 0.46, 0.52, 0.16, 0.62, 0.78],
  boxy: [0.38, 0.62, 0.44, 0.48, 0.24, 0.46, 0.34, 0.38, 0.46, 0.58],
  oversized: [0.24, 0.30, 0.48, 0.50, 0.58, 0.52, 0.22, 0.42, 0.24, 0.52],
  flowy: [0.34, 0.20, 0.46, 0.30, 0.84, 0.44, 0.34, 0.14, 0.44, 0.60],
  'body-skimming': [0.60, 0.58, 0.36, 0.42, 0.48, 0.42, 0.58, 0.16, 0.52, 0.58],
};

const AESTHETIC_VECTORS = {
  classic: [0.78, 0.72, 0.32, 0.26, 0.36, 0.44, 0.84, 0.10, 0.70, 0.76],
  minimalist: [0.68, 0.64, 0.22, 0.18, 0.42, 0.40, 0.72, 0.10, 0.94, 0.86],
  romantic: [0.50, 0.28, 0.40, 0.34, 0.82, 0.42, 0.58, 0.08, 0.54, 0.54],
  streetwear: [0.18, 0.42, 0.56, 0.74, 0.30, 0.48, 0.18, 0.66, 0.14, 0.42],
  edgy: [0.24, 0.48, 0.58, 0.78, 0.18, 0.48, 0.32, 0.76, 0.16, 0.36],
  sporty: [0.16, 0.34, 0.40, 0.44, 0.34, 0.44, 0.20, 0.34, 0.34, 0.78],
  bohemian: [0.26, 0.20, 0.56, 0.44, 0.74, 0.48, 0.24, 0.24, 0.22, 0.44],
  vintage: [0.50, 0.44, 0.52, 0.38, 0.56, 0.46, 0.48, 0.22, 0.42, 0.48],
  modern: [0.56, 0.58, 0.30, 0.42, 0.34, 0.42, 0.60, 0.18, 0.64, 0.72],
  utilitarian: [0.24, 0.52, 0.54, 0.42, 0.26, 0.60, 0.24, 0.58, 0.36, 0.74],
  relaxed: [0.22, 0.24, 0.40, 0.30, 0.70, 0.44, 0.20, 0.22, 0.40, 0.80],
  elegant: [0.84, 0.66, 0.30, 0.34, 0.52, 0.42, 0.92, 0.06, 0.70, 0.58],
};

const MATERIAL_VECTORS = {
  silk: [0.82, 0.50, 0.20, 0.32, 0.62, 0.34, 0.92, 0.04, 0.68, 0.56],
  satin: [0.82, 0.48, 0.18, 0.38, 0.62, 0.34, 0.94, 0.04, 0.60, 0.50],
  cotton: [0.42, 0.42, 0.32, 0.26, 0.52, 0.42, 0.42, 0.18, 0.54, 0.88],
  linen: [0.46, 0.34, 0.42, 0.26, 0.58, 0.28, 0.42, 0.12, 0.66, 0.76],
  denim: [0.20, 0.48, 0.78, 0.50, 0.24, 0.58, 0.18, 0.84, 0.18, 0.66],
  leather: [0.34, 0.62, 0.66, 0.78, 0.12, 0.58, 0.52, 0.88, 0.16, 0.32],
  suede: [0.42, 0.52, 0.62, 0.50, 0.40, 0.60, 0.48, 0.54, 0.22, 0.40],
  wool: [0.54, 0.56, 0.48, 0.28, 0.46, 0.84, 0.54, 0.20, 0.52, 0.74],
  cashmere: [0.70, 0.48, 0.36, 0.24, 0.80, 0.82, 0.82, 0.06, 0.66, 0.58],
  knit: [0.30, 0.34, 0.60, 0.26, 0.72, 0.78, 0.28, 0.20, 0.36, 0.66],
  jersey: [0.18, 0.24, 0.32, 0.22, 0.62, 0.46, 0.16, 0.22, 0.38, 0.82],
  fleece: [0.14, 0.22, 0.48, 0.20, 0.70, 0.90, 0.16, 0.16, 0.30, 0.66],
  tweed: [0.68, 0.70, 0.70, 0.34, 0.26, 0.72, 0.68, 0.34, 0.54, 0.52],
  corduroy: [0.38, 0.48, 0.84, 0.34, 0.30, 0.66, 0.28, 0.46, 0.24, 0.42],
  chiffon: [0.48, 0.18, 0.36, 0.30, 0.88, 0.30, 0.54, 0.04, 0.52, 0.50],
  mesh: [0.26, 0.22, 0.44, 0.54, 0.34, 0.24, 0.22, 0.12, 0.26, 0.34],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value, fallback = 0.5) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return fallback;
  return clamp(numeric, 0, 1);
}

function round3(value) {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function cleanString(value, maxLen = 120) {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.slice(0, maxLen);
}

function normalizeTokenList(values, max = 6) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const cleaned = cleanString(value, 30).toLowerCase();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= max) break;
  }

  return result;
}

function normalizeEnum(value, allowed, fallback) {
  const cleaned = cleanString(value, 40).toLowerCase();
  if (allowed.includes(cleaned)) return cleaned;
  return fallback;
}

function buildItemTokenText(item = {}, raw = {}) {
  return [
    item.name,
    item.subcategory,
    item.category,
    item.style,
    item.pattern,
    item.fit,
    item.color,
    ...(item.tags || []),
    raw.summary,
    raw.texture,
    raw.silhouette,
    raw.structure,
    raw.dressCode,
    ...(raw.materials || []),
    ...(raw.aesthetics || []),
    ...(raw.vibeKeywords || []),
    ...(raw.pairingKeywords || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inferMaterials(item = {}, raw = {}, tokenText = '') {
  const allowed = Object.keys(MATERIAL_VECTORS);
  const explicit = normalizeTokenList(raw.materials, 3).filter(value => allowed.includes(value));
  if (explicit.length > 0) return explicit;

  const inferred = [];
  for (const material of allowed) {
    if (tokenText.includes(material)) inferred.push(material);
  }

  if (tokenText.includes('satin')) inferred.push('satin');
  if (tokenText.includes('cashmere')) inferred.push('cashmere');
  if (tokenText.includes('tee') || tokenText.includes('t-shirt')) inferred.push('cotton');
  if (tokenText.includes('hoodie') || tokenText.includes('sweatshirt')) inferred.push('fleece');
  if (tokenText.includes('sneaker') || tokenText.includes('trainer')) inferred.push('mesh');
  if (tokenText.includes('cardigan') || tokenText.includes('sweater')) inferred.push('knit');

  const unique = [...new Set(inferred)].filter(value => allowed.includes(value));
  return unique.slice(0, 3);
}

function inferDressCode(item = {}, raw = {}, tokenText = '') {
  const explicit = normalizeEnum(raw.dressCode, DRESS_CODES, '');
  if (explicit) return explicit;

  const style = cleanString(item.style, 40).toLowerCase();
  if (['formal', 'elegant'].includes(style)) return 'formal';
  if (['minimalist', 'modern'].includes(style)) return 'polished';
  if (['streetwear', 'sporty'].includes(style)) return 'casual';
  if (style === 'casual') return 'casual';
  if (style === 'vintage' || style === 'bohemian') return 'smart-casual';

  if (/(blazer|suit|trouser|oxford|loafer|heel|pump|gown|silk|satin|tailored)/.test(tokenText)) {
    return 'formal';
  }
  if (/(button down|button-up|pleated|midi|polished|sleek|refined)/.test(tokenText)) {
    return 'polished';
  }
  if (/(distressed|denim|hoodie|tee|t-shirt|sneaker|cargo|jersey|cap)/.test(tokenText)) {
    return 'casual';
  }
  if (/(athletic|gym|running|training|performance)/.test(tokenText)) {
    return 'very-casual';
  }

  return item.category === 'accessory' ? 'smart-casual' : 'casual';
}

function inferTexture(item = {}, raw = {}, tokenText = '') {
  const explicit = normalizeEnum(raw.texture, TEXTURES, '');
  if (explicit) return explicit;

  const pattern = cleanString(item.pattern, 40).toLowerCase();
  if (/(distressed|washed|frayed|ripped)/.test(tokenText)) return 'distressed';
  if (/(silk|satin|smooth|sleek|shiny)/.test(tokenText)) return 'smooth';
  if (/(tweed|corduroy|knit|wool|suede|denim|woven|plaid|textured)/.test(tokenText)) return 'textured';
  if (/(poplin|button down|crisp|pressed)/.test(tokenText)) return 'crisp';
  if (/(sweater|cardigan|knit)/.test(tokenText)) return 'knit';
  if (pattern && pattern !== 'solid') return 'textured';
  return 'matte';
}

function inferStructure(item = {}, raw = {}, tokenText = '') {
  const explicit = normalizeEnum(raw.structure, STRUCTURES, '');
  if (explicit) return explicit;

  const fit = cleanString(item.fit, 40).toLowerCase();
  if (/(blazer|coat|trench|structured|tailored|corset|trouser)/.test(tokenText)) return 'structured';
  if (fit === 'slim' || fit === 'fitted') return 'tailored';
  if (fit === 'oversized' || fit === 'relaxed' || fit === 'loose') return 'relaxed';
  if (/(flowy|draped|soft|boho|ruffle)/.test(tokenText)) return 'soft';
  return 'balanced';
}

function inferSilhouette(item = {}, raw = {}, tokenText = '') {
  const explicit = normalizeEnum(raw.silhouette, SILHOUETTES, '');
  if (explicit) return explicit;

  const fit = cleanString(item.fit, 40).toLowerCase();
  if (/(tailored|blazer|trouser|pencil|sheath)/.test(tokenText) || fit === 'slim') return 'tailored';
  if (fit === 'oversized') return 'oversized';
  if (/(flowy|maxi|swing|draped|boho)/.test(tokenText)) return 'flowy';
  if (/(boxy|cropped jacket|structured tee)/.test(tokenText)) return 'boxy';
  if (fit === 'fitted') return 'body-skimming';
  return 'straight';
}

function inferAesthetics(item = {}, raw = {}, tokenText = '') {
  const explicit = normalizeTokenList(raw.aesthetics, 3).filter(value => AESTHETICS.includes(value));
  if (explicit.length > 0) return explicit;

  const result = [];
  const style = cleanString(item.style, 40).toLowerCase();
  const tags = normalizeTokenList(item.tags, 8);
  const push = (value) => {
    if (value && AESTHETICS.includes(value) && !result.includes(value)) result.push(value);
  };

  if (style === 'formal') push('classic');
  if (style === 'minimalist') push('minimalist');
  if (style === 'bohemian') push('bohemian');
  if (style === 'vintage') push('vintage');
  if (style === 'streetwear') push('streetwear');
  if (style === 'sporty') push('sporty');
  if (style === 'modern') push('modern');
  if (style === 'casual') push('relaxed');

  if (/(tailored|clean|polished|refined|timeless)/.test(tokenText)) push('classic');
  if (/(minimal|sleek|clean line|monochrome)/.test(tokenText)) push('minimalist');
  if (/(romantic|ruffle|lace|floral|soft)/.test(tokenText)) push('romantic');
  if (/(street|graphic|cargo|sneaker|oversized)/.test(tokenText)) push('streetwear');
  if (/(edgy|moto|leather|studded|distressed)/.test(tokenText)) push('edgy');
  if (/(athletic|gym|running|performance)/.test(tokenText)) push('sporty');
  if (/(boho|flowy|artisan|embroidered)/.test(tokenText)) push('bohemian');
  if (/(retro|vintage)/.test(tokenText)) push('vintage');
  if (/(utility|cargo|workwear|field)/.test(tokenText)) push('utilitarian');
  if (/(elegant|silk|satin|luxury)/.test(tokenText)) push('elegant');

  tags.forEach((tag) => {
    if (AESTHETICS.includes(tag)) push(tag);
  });

  if (result.length === 0) {
    push(item.category === 'accessory' ? 'modern' : 'relaxed');
  }

  return result.slice(0, 3);
}

function inferKeywords(item = {}, raw = {}, materials = [], aesthetics = [], dressCode = '', texture = '') {
  const suppliedVibe = normalizeTokenList(raw.vibeKeywords, 6);
  const suppliedPairing = normalizeTokenList(raw.pairingKeywords, 6);
  if (suppliedVibe.length > 0 || suppliedPairing.length > 0) {
    return {
      vibeKeywords: suppliedVibe,
      pairingKeywords: suppliedPairing,
    };
  }

  const vibeKeywords = [];
  const pairingKeywords = [];
  const pushUnique = (list, value) => {
    const cleaned = cleanString(value, 24).toLowerCase();
    if (cleaned && !list.includes(cleaned)) list.push(cleaned);
  };

  aesthetics.forEach((value) => pushUnique(vibeKeywords, value));
  materials.forEach((value) => pushUnique(vibeKeywords, value));
  if (dressCode) pushUnique(vibeKeywords, dressCode);
  if (texture) pushUnique(vibeKeywords, texture);

  if (['formal', 'polished'].includes(dressCode)) {
    pushUnique(pairingKeywords, 'tailored');
    pushUnique(pairingKeywords, 'clean');
    pushUnique(pairingKeywords, 'elevated');
  }
  if (['casual', 'very-casual'].includes(dressCode)) {
    pushUnique(pairingKeywords, 'easy');
    pushUnique(pairingKeywords, 'everyday');
  }
  if (materials.includes('denim') || texture === 'distressed') {
    pushUnique(pairingKeywords, 'grounded');
    pushUnique(pairingKeywords, 'street');
  }
  if (materials.includes('silk') || materials.includes('satin')) {
    pushUnique(pairingKeywords, 'sleek');
    pushUnique(pairingKeywords, 'refined');
  }
  if (item.category === 'outerwear') pushUnique(pairingKeywords, 'layering');
  if (item.category === 'shoes') pushUnique(pairingKeywords, 'foundation');
  if (item.category === 'accessory') pushUnique(pairingKeywords, 'accent');

  return {
    vibeKeywords: vibeKeywords.slice(0, 6),
    pairingKeywords: pairingKeywords.slice(0, 6),
  };
}

function buildSemanticSummary(item = {}, profile = {}) {
  const parts = [];
  if (item.color) parts.push(cleanString(item.color, 30).toLowerCase());
  if (profile.materials?.[0]) parts.push(profile.materials[0]);
  if (profile.dressCode) parts.push(profile.dressCode);
  if (item.subcategory) parts.push(cleanString(item.subcategory, 40).toLowerCase());
  else if (item.category) parts.push(cleanString(item.category, 20).toLowerCase());
  if (profile.aesthetics?.[0]) {
    return cleanString(`${parts.join(' ')} with ${profile.aesthetics[0]} energy`, 140);
  }
  return cleanString(parts.join(' '), 140);
}

function createZeroAxes() {
  return SEMANTIC_AXIS_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function applyVector(acc, vector, weight = 1) {
  SEMANTIC_AXIS_KEYS.forEach((key, index) => {
    acc[key] += (vector[index] || 0) * weight;
  });
}

function buildSemanticAxes(profile = {}, item = {}) {
  const acc = createZeroAxes();
  let totalWeight = 0;

  const add = (vector, weight) => {
    if (!Array.isArray(vector)) return;
    applyVector(acc, vector, weight);
    totalWeight += weight;
  };

  add(DRESS_CODE_VECTORS[profile.dressCode], 1.25);
  add(STRUCTURE_VECTORS[profile.structure], 0.95);
  add(TEXTURE_VECTORS[profile.texture], 0.9);
  add(SILHOUETTE_VECTORS[profile.silhouette], 0.85);

  (profile.aesthetics || []).forEach((aesthetic, index) => {
    add(AESTHETIC_VECTORS[aesthetic], index === 0 ? 0.9 : 0.65);
  });

  (profile.materials || []).forEach((material) => {
    add(MATERIAL_VECTORS[material], 0.7);
  });

  if (item.category === 'outerwear') add([0.54, 0.68, 0.48, 0.34, 0.30, 0.82, 0.46, 0.26, 0.46, 0.64], 0.35);
  if (item.category === 'shoes') add([0.46, 0.46, 0.34, 0.32, 0.28, 0.46, 0.48, 0.22, 0.48, 0.72], 0.25);
  if (item.category === 'accessory') add([0.52, 0.32, 0.26, 0.46, 0.30, 0.28, 0.54, 0.12, 0.50, 0.42], 0.18);

  if (totalWeight <= 0) {
    SEMANTIC_AXIS_KEYS.forEach((key) => {
      acc[key] = 0.5;
    });
    return acc;
  }

  return SEMANTIC_AXIS_KEYS.reduce((axes, key) => {
    axes[key] = round3(acc[key] / totalWeight);
    return axes;
  }, {});
}

function buildEmbeddingFromAxes(axes = {}) {
  return SEMANTIC_AXIS_KEYS.map((key) => round3(axes[key]));
}

function sanitizeSemanticProfile(raw = {}, item = {}) {
  const tokenText = buildItemTokenText(item, raw);
  const materials = inferMaterials(item, raw, tokenText);
  const dressCode = inferDressCode(item, raw, tokenText);
  const texture = inferTexture(item, raw, tokenText);
  const structure = inferStructure(item, raw, tokenText);
  const silhouette = inferSilhouette(item, raw, tokenText);
  const aesthetics = inferAesthetics(item, raw, tokenText);
  const keywords = inferKeywords(item, raw, materials, aesthetics, dressCode, texture);

  const profile = {
    summary: cleanString(raw.summary, 160),
    materials,
    texture,
    silhouette,
    structure,
    dressCode,
    aesthetics,
    vibeKeywords: keywords.vibeKeywords,
    pairingKeywords: keywords.pairingKeywords,
  };

  if (!profile.summary) {
    profile.summary = buildSemanticSummary(item, profile);
  }

  const axes = buildSemanticAxes(profile, item);

  return {
    ...profile,
    axes,
    embedding: buildEmbeddingFromAxes(axes),
    embeddingVersion: 'semantic-v1',
    sourceModel: cleanString(raw.sourceModel || raw.model, 40) || 'vision-derived',
    generatedAt: raw.generatedAt ? new Date(raw.generatedAt) : new Date(),
  };
}

function getSemanticProfile(item = {}) {
  return sanitizeSemanticProfile(item.semanticProfile || {}, item);
}

function averageEmbeddings(embeddings = []) {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    return SEMANTIC_AXIS_KEYS.map(() => 0.5);
  }

  const sums = SEMANTIC_AXIS_KEYS.map(() => 0);
  embeddings.forEach((embedding) => {
    SEMANTIC_AXIS_KEYS.forEach((_, index) => {
      sums[index] += clamp01(embedding[index], 0.5);
    });
  });

  return sums.map((value) => round3(value / embeddings.length));
}

function semanticOutfitEmbedding(items = []) {
  const embeddings = items.map((item) => getSemanticProfile(item).embedding);
  return averageEmbeddings(embeddings);
}

function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0.5;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = clamp01(a[i], 0.5);
    const bv = clamp01(b[i], 0.5);
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (magA <= 0 || magB <= 0) return 0.5;
  return clamp01(dot / (Math.sqrt(magA) * Math.sqrt(magB)));
}

function jaccardSimilarity(a = [], b = []) {
  const setA = new Set(a || []);
  const setB = new Set(b || []);
  if (setA.size === 0 && setB.size === 0) return 0.5;
  const intersection = [...setA].filter((value) => setB.has(value)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0.5 : intersection / union;
}

function semanticSimilarity(itemA = {}, itemB = {}) {
  const profileA = Array.isArray(itemA.embedding) ? itemA : getSemanticProfile(itemA);
  const profileB = Array.isArray(itemB.embedding) ? itemB : getSemanticProfile(itemB);

  const embeddingScore = cosineSimilarity(profileA.embedding, profileB.embedding);
  const axisDistances = SEMANTIC_AXIS_KEYS.map((key) =>
    Math.abs(clamp01(profileA.axes?.[key]) - clamp01(profileB.axes?.[key]))
  );
  const averageDistance = axisDistances.reduce((sum, value) => sum + value, 0) / axisDistances.length;
  const keyDistanceKeys = ['formality', 'structure', 'polish', 'ruggedness', 'minimalism'];
  const keyDistance =
    keyDistanceKeys.reduce(
      (sum, key) => sum + Math.abs(clamp01(profileA.axes?.[key]) - clamp01(profileB.axes?.[key])),
      0,
    ) / keyDistanceKeys.length;
  const aestheticScore = jaccardSimilarity(profileA.aesthetics, profileB.aesthetics);
  const materialScore = jaccardSimilarity(profileA.materials, profileB.materials);
  const vibeScore = jaccardSimilarity(profileA.vibeKeywords, profileB.vibeKeywords);

  return round3(
    embeddingScore * 0.28 +
      (1 - averageDistance) * 0.24 +
      (1 - keyDistance) * 0.28 +
      aestheticScore * 0.12 +
      materialScore * 0.04 +
      vibeScore * 0.04
  );
}

function semanticCompatibility(itemA = {}, itemB = {}, occasion = 'casual') {
  const profileA = Array.isArray(itemA.embedding) ? itemA : getSemanticProfile(itemA);
  const profileB = Array.isArray(itemB.embedding) ? itemB : getSemanticProfile(itemB);
  const similarity = semanticSimilarity(profileA, profileB);
  const aAxes = profileA.axes || {};
  const bAxes = profileB.axes || {};

  const formalityAlignment = 1 - Math.abs(clamp01(aAxes.formality) - clamp01(bAxes.formality));
  const structureAlignment = 1 - Math.abs(clamp01(aAxes.structure) - clamp01(bAxes.structure));
  const polishAlignment = 1 - Math.abs(clamp01(aAxes.polish) - clamp01(bAxes.polish));
  const textureAlignment = 1 - Math.abs(clamp01(aAxes.texture) - clamp01(bAxes.texture)) * 0.75;
  const softBalance = 1 - Math.abs(clamp01(aAxes.softness) - clamp01(bAxes.softness)) * 0.8;

  const targetFormality = {
    casual: 0.40,
    work: 0.70,
    date: 0.58,
    party: 0.66,
    gym: 0.18,
    formal: 0.88,
  }[occasion] || 0.48;
  const combinedFormality = (clamp01(aAxes.formality) + clamp01(bAxes.formality)) / 2;
  const occasionAlignment = 1 - Math.abs(combinedFormality - targetFormality);

  return round3(
    similarity * 0.34 +
      formalityAlignment * 0.22 +
      structureAlignment * 0.16 +
      polishAlignment * 0.12 +
      textureAlignment * 0.08 +
      softBalance * 0.04 +
      occasionAlignment * 0.04
  );
}

function semanticOutfitCohesion(items = [], occasion = 'casual') {
  if (!Array.isArray(items) || items.length < 2) return 0.6;

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += semanticCompatibility(items[i], items[j], occasion);
      pairs++;
    }
  }

  return pairs > 0 ? round3(total / pairs) : 0.6;
}

function semanticOutfitSimilarity(itemsA = [], itemsB = []) {
  const embeddingScore = cosineSimilarity(semanticOutfitEmbedding(itemsA), semanticOutfitEmbedding(itemsB));
  const aestheticsA = itemsA.flatMap((item) => getSemanticProfile(item).aesthetics || []);
  const aestheticsB = itemsB.flatMap((item) => getSemanticProfile(item).aesthetics || []);
  const vibesA = itemsA.flatMap((item) => getSemanticProfile(item).vibeKeywords || []);
  const vibesB = itemsB.flatMap((item) => getSemanticProfile(item).vibeKeywords || []);
  const categoriesA = itemsA.map((item) => item.category).filter(Boolean);
  const categoriesB = itemsB.map((item) => item.category).filter(Boolean);

  return round3(
    embeddingScore * 0.70 +
      jaccardSimilarity(aestheticsA, aestheticsB) * 0.14 +
      jaccardSimilarity(vibesA, vibesB) * 0.10 +
      jaccardSimilarity(categoriesA, categoriesB) * 0.06
  );
}

function summarizeSemanticProfile(item = {}) {
  const profile = Array.isArray(item.embedding) ? item : getSemanticProfile(item);
  return {
    summary: profile.summary,
    aesthetics: profile.aesthetics || [],
    dressCode: profile.dressCode,
    texture: profile.texture,
    structure: profile.structure,
    silhouette: profile.silhouette,
    materials: profile.materials || [],
    vibeKeywords: profile.vibeKeywords || [],
    pairingKeywords: profile.pairingKeywords || [],
    axes: profile.axes || {},
    embedding: profile.embedding || buildEmbeddingFromAxes(profile.axes || {}),
  };
}

module.exports = {
  SEMANTIC_AXIS_KEYS,
  sanitizeSemanticProfile,
  getSemanticProfile,
  semanticSimilarity,
  semanticCompatibility,
  semanticOutfitCohesion,
  semanticOutfitSimilarity,
  semanticOutfitEmbedding,
  summarizeSemanticProfile,
};
