/**
 * visualReanalysis.js — Re-analyze existing wardrobe items using the upgraded
 * GPT-4o vision prompt.  Items that were uploaded before the visual analysis
 * upgrade only have heuristic-based semantic axes (embeddingVersion: 'semantic-v1').
 * This service fetches each item's image, sends it through vision, and patches
 * the item with vision-sourced axes + new visual metadata.
 *
 * Designed to run as a background job with rate-limiting and cost tracking.
 */

const ClothingItem = require('../models/ClothingItem');
const ApiUsage = require('../models/ApiUsage');
const { sanitizeSemanticProfile } = require('../utils/semanticStyleProfile');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const BATCH_SIZE = 5;               // items per batch
const DELAY_BETWEEN_ITEMS_MS = 1200; // rate-limit: ~50 items/min
const MAX_ITEMS_PER_RUN = 100;       // safety cap per trigger

// In-memory job state (single-server; swap to Redis for multi-instance)
let activeJob = null;

// ═══════════════════════════════════════════════════════════════════════════
// FIND STALE ITEMS — items that need re-analysis
// ═══════════════════════════════════════════════════════════════════════════

async function findStaleItems({ userId, limit = MAX_ITEMS_PER_RUN } = {}) {
  const query = {
    // Must have an image to analyze
    $or: [
      { imageUrl: { $exists: true, $nin: [null, ''] } },
      { mediumUrl: { $exists: true, $nin: [null, ''] } },
      { thumbnailUrl: { $exists: true, $nin: [null, ''] } },
    ],
    // Not yet vision-analyzed
    $and: [
      {
        $or: [
          { 'semanticProfile.embeddingVersion': { $ne: 'vision-v2' } },
          { 'semanticProfile.embeddingVersion': { $exists: false } },
          { semanticProfile: { $exists: false } },
        ],
      },
    ],
  };

  if (userId) query.userId = userId;

  return ClothingItem.find(query)
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit, MAX_ITEMS_PER_RUN))
    .lean();
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCH IMAGE AS BASE64
// ═══════════════════════════════════════════════════════════════════════════

async function fetchImageBase64(item) {
  // Prefer medium size (600px) for best quality/cost balance
  const url = item.mediumUrl || item.imageUrl || item.thumbnailUrl;
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch (err) {
    console.error(`Failed to fetch image for item ${item._id}:`, err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VISION ANALYSIS — sends image to GPT-4o and parses response
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeItemVision(imageBase64) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

  const prompt = `You are a fashion AI analyzing a clothing item photo. Return ONLY minified JSON with:

BASIC:
- category: one of ["top","bottom","dress","shoes","outerwear","accessory","other"]
- subcategory: specific type (e.g., "v-neck t-shirt", "skinny jeans")
- color: dominant color name
- colorPalette: array of 3-5 color names
- hexColors: array of 3-5 actual hex codes from what you see
- colorTemperature: "warm", "cool", or "neutral"
- style: one of ["casual","formal","sporty","streetwear","bohemian","minimalist","vintage","modern"]
- pattern: one of ["solid","striped","printed","floral","geometric","abstract","plaid","polka-dot"]
- fit: one of ["loose","fitted","oversized","relaxed","slim"]
- tags: array of 3-7 style tags
- confidence: 0-1

VISUAL:
- printScale: if patterned, one of ["micro","small","medium","large","oversized"]. null if solid
- fabricSurface: one of ["matte","satin","glossy","metallic","sheer","nubby","brushed","waxed"]
- visualWeight: 0-1 float (0=airy/sheer, 1=heavy/dense)
- layeringRole: one of ["base","mid","outer","standalone"]

SEMANTIC PROFILE:
- semanticProfile: object with:
  - summary: 6-14 word visual summary
  - materials: array of 1-3 from ["cotton","linen","silk","satin","denim","leather","suede","wool","cashmere","knit","jersey","fleece","tweed","corduroy","chiffon","mesh","polyester","nylon","velvet"]
  - texture: one of ["smooth","matte","textured","distressed","crisp","knit"]
  - silhouette: one of ["tailored","straight","boxy","oversized","flowy","body-skimming"]
  - structure: one of ["soft","relaxed","balanced","tailored","structured"]
  - dressCode: one of ["very-casual","casual","smart-casual","polished","formal"]
  - aesthetics: 1-3 from ["classic","minimalist","romantic","streetwear","edgy","sporty","bohemian","vintage","modern","utilitarian","relaxed","elegant"]
  - vibeKeywords: 3-6 keywords
  - pairingKeywords: 2-6 keywords
  - axes: object with 10 floats (0.0-1.0) scored from LOOKING at the garment:
    - formality, structure, texture, boldness, softness, warmth, polish, ruggedness, minimalism, versatility
    Score from what you SEE — actual drape, sheen, construction — not category stereotypes.

If this is NOT a clothing/accessory item, return: {"isClothing":false}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert fashion AI. Output only minified JSON, no markdown.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const rawContent = json.choices?.[0]?.message?.content || '{}';

  // Track cost
  try {
    const usage = json.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const cost = (promptTokens / 1_000_000) * 2.50 + (completionTokens / 1_000_000) * 10;

    await ApiUsage.create({
      service: 'openai',
      operation: 'reanalyze-item',
      tokens: { prompt: promptTokens, completion: completionTokens },
      cost,
      model: 'gpt-4o',
    });
  } catch (_) {}

  // Parse
  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(cleaned);
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLY VISION RESULT — patch item in DB
// ═══════════════════════════════════════════════════════════════════════════

function buildUpdateFromVision(parsed, existingItem) {
  if (parsed.isClothing === false) return null;

  const validCategories = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'other'];
  const validStyles = ['casual', 'formal', 'sporty', 'streetwear', 'bohemian', 'minimalist', 'vintage', 'modern'];
  const validPatterns = ['solid', 'striped', 'printed', 'floral', 'geometric', 'abstract', 'plaid', 'polka-dot'];
  const validFits = ['loose', 'fitted', 'oversized', 'relaxed', 'slim'];
  const validSurfaces = ['matte', 'satin', 'glossy', 'metallic', 'sheer', 'nubby', 'brushed', 'waxed'];
  const validPrintScales = ['micro', 'small', 'medium', 'large', 'oversized'];
  const validColorTemps = ['warm', 'cool', 'neutral'];
  const validLayering = ['base', 'mid', 'outer', 'standalone'];
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  const update = {};

  // Only override fields that vision is better at; keep user-provided name, brand, size
  if (validCategories.includes(parsed.category) && !existingItem.category) {
    update.category = parsed.category;
  }
  if (parsed.subcategory && !existingItem.subcategory) {
    update.subcategory = parsed.subcategory;
  }

  // Color: vision is more accurate than user-typed color
  if (parsed.color) update.color = parsed.color;
  if (Array.isArray(parsed.colorPalette) && parsed.colorPalette.length > 0) {
    update.colorPalette = parsed.colorPalette.slice(0, 5);
  }
  if (Array.isArray(parsed.hexColors)) {
    update.hexColors = parsed.hexColors.filter(h => HEX_RE.test(h)).slice(0, 5);
  }
  if (validColorTemps.includes(parsed.colorTemperature)) {
    update.colorTemperature = parsed.colorTemperature;
  }

  // Style metadata: fill if missing, else keep user's choice
  if (validStyles.includes(parsed.style) && !existingItem.style) update.style = parsed.style;
  if (validPatterns.includes(parsed.pattern) && !existingItem.pattern) update.pattern = parsed.pattern;
  if (validFits.includes(parsed.fit) && !existingItem.fit) update.fit = parsed.fit;
  if (Array.isArray(parsed.occasion) && (!existingItem.occasion || existingItem.occasion.length === 0)) {
    update.occasion = parsed.occasion;
  }
  if (Array.isArray(parsed.tags) && (!existingItem.tags || existingItem.tags.length === 0)) {
    update.tags = parsed.tags;
  }

  // New visual fields — always apply (these didn't exist before)
  if (validSurfaces.includes(parsed.fabricSurface)) update.fabricSurface = parsed.fabricSurface;
  if (validPrintScales.includes(parsed.printScale)) update.printScale = parsed.printScale;
  if (typeof parsed.visualWeight === 'number') {
    update.visualWeight = Math.max(0, Math.min(1, parsed.visualWeight));
  }
  if (validLayering.includes(parsed.layeringRole)) update.layeringRole = parsed.layeringRole;

  // Confidence
  if (typeof parsed.confidence === 'number') {
    update.aiConfidence = Math.max(0, Math.min(1, parsed.confidence));
  }

  // Semantic profile with vision axes — the main upgrade
  const itemContext = {
    name: existingItem.name || parsed.subcategory || parsed.category,
    category: existingItem.category || parsed.category,
    subcategory: existingItem.subcategory || parsed.subcategory || '',
    color: update.color || existingItem.color || '',
    style: existingItem.style || parsed.style || 'casual',
    pattern: existingItem.pattern || parsed.pattern || 'solid',
    fit: existingItem.fit || parsed.fit || 'fitted',
    tags: existingItem.tags?.length ? existingItem.tags : (parsed.tags || []),
  };

  update.semanticProfile = sanitizeSemanticProfile(parsed.semanticProfile || {}, itemContext);
  update.aiProcessed = true;

  return update;
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-ANALYZE SINGLE ITEM
// ═══════════════════════════════════════════════════════════════════════════

async function reanalyzeItem(item) {
  const imageBase64 = await fetchImageBase64(item);
  if (!imageBase64) {
    return { itemId: item._id, status: 'skipped', reason: 'no-image' };
  }

  try {
    const parsed = await analyzeItemVision(imageBase64);
    if (parsed.isClothing === false) {
      return { itemId: item._id, status: 'skipped', reason: 'not-clothing' };
    }

    const update = buildUpdateFromVision(parsed, item);
    if (!update) {
      return { itemId: item._id, status: 'skipped', reason: 'no-update' };
    }

    await ClothingItem.findByIdAndUpdate(item._id, update);
    return {
      itemId: item._id,
      status: 'upgraded',
      version: update.semanticProfile?.embeddingVersion || 'vision-v2',
    };
  } catch (err) {
    console.error(`Reanalysis failed for item ${item._id}:`, err.message);
    return { itemId: item._id, status: 'error', reason: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH RE-ANALYSIS JOB
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runReanalysisJob({ userId, limit = MAX_ITEMS_PER_RUN } = {}) {
  if (activeJob?.running) {
    return { error: 'A re-analysis job is already running', job: getJobStatus() };
  }

  const items = await findStaleItems({ userId, limit });
  if (items.length === 0) {
    return { message: 'No items need re-analysis', total: 0 };
  }

  activeJob = {
    running: true,
    startedAt: new Date(),
    userId: userId || 'all',
    total: items.length,
    processed: 0,
    upgraded: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  // Run in background — don't await
  (async () => {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      if (!activeJob.running) break; // cancelled

      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = [];

      for (const item of batch) {
        if (!activeJob.running) break;

        const result = await reanalyzeItem(item);
        batchResults.push(result);

        activeJob.processed++;
        if (result.status === 'upgraded') activeJob.upgraded++;
        else if (result.status === 'error') activeJob.errors++;
        else activeJob.skipped++;

        // Rate-limit between items
        if (i + batchResults.length < items.length) {
          await sleep(DELAY_BETWEEN_ITEMS_MS);
        }
      }

      activeJob.results.push(...batchResults);
    }

    activeJob.running = false;
    activeJob.finishedAt = new Date();
    activeJob.durationMs = activeJob.finishedAt - activeJob.startedAt;
    console.log(
      `✅ Reanalysis complete: ${activeJob.upgraded} upgraded, ${activeJob.skipped} skipped, ${activeJob.errors} errors out of ${activeJob.total} items (${activeJob.durationMs}ms)`,
    );
  })();

  return {
    message: `Re-analysis started for ${items.length} items`,
    total: items.length,
    estimatedMinutes: Math.ceil((items.length * DELAY_BETWEEN_ITEMS_MS) / 60000) + 1,
  };
}

function getJobStatus() {
  if (!activeJob) return { status: 'idle', message: 'No re-analysis job has been run' };
  return {
    status: activeJob.running ? 'running' : 'complete',
    userId: activeJob.userId,
    total: activeJob.total,
    processed: activeJob.processed,
    upgraded: activeJob.upgraded,
    skipped: activeJob.skipped,
    errors: activeJob.errors,
    startedAt: activeJob.startedAt,
    finishedAt: activeJob.finishedAt || null,
    durationMs: activeJob.durationMs || (activeJob.running ? Date.now() - activeJob.startedAt : null),
    progress: activeJob.total > 0 ? Math.round((activeJob.processed / activeJob.total) * 100) : 0,
    results: activeJob.results?.slice(-20) || [], // last 20 results
  };
}

function cancelJob() {
  if (!activeJob?.running) return { status: 'idle', message: 'No running job to cancel' };
  activeJob.running = false;
  return { status: 'cancelled', processed: activeJob.processed, total: activeJob.total };
}

async function getReanalysisStats(userId) {
  const query = userId ? { userId } : {};
  const total = await ClothingItem.countDocuments(query);
  const withImage = await ClothingItem.countDocuments({
    ...query,
    $or: [
      { imageUrl: { $exists: true, $nin: [null, ''] } },
      { mediumUrl: { $exists: true, $nin: [null, ''] } },
    ],
  });
  const visionAnalyzed = await ClothingItem.countDocuments({
    ...query,
    'semanticProfile.embeddingVersion': 'vision-v2',
  });
  const heuristicOnly = withImage - visionAnalyzed;

  return {
    total,
    withImage,
    visionAnalyzed,
    heuristicOnly,
    needsReanalysis: Math.max(0, heuristicOnly),
    percentComplete: withImage > 0 ? Math.round((visionAnalyzed / withImage) * 100) : 100,
  };
}

module.exports = {
  findStaleItems,
  reanalyzeItem,
  runReanalysisJob,
  getJobStatus,
  cancelJob,
  getReanalysisStats,
};
