/**
 * aiEnhancement.js — OpenAI integration layer for outfit curation.
 * Enhances algorithm-scored candidates with AI-generated titles,
 * descriptions, and final selection. Falls back gracefully.
 */

const ApiUsage = require('../models/ApiUsage');
const {
  OCCASION_PROFILES,
  TIME_PROFILES,
} = require('../utils/fashionIntelligence');
const { summarizeSemanticProfile } = require('../utils/semanticStyleProfile');
const {
  id,
  getCurrentSeason,
  getOutfitDirection,
  getSemanticProfileCached,
  outfitRotationScore,
  makeRecommendationId,
  normalizeRecommendationScore,
  embeddingSimilarity,
} = require('./recommendationHelpers');
const {
  buildReasons,
  buildPresentationCopy,
  sanitizeAISelections,
  computeRecommendationConfidence,
  classifyArchetype,
  completeTheLook,
  deduplicateAccessories,
  formatResults,
} = require('./outfitPresentation');

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK MERGE
// ═══════════════════════════════════════════════════════════════════════════

function responseItemId(item) {
  return (item?.id || item?._id || '').toString();
}

function responseSignature(result) {
  const itemSignature = (result?.items || [])
    .map(responseItemId)
    .filter(Boolean)
    .sort()
    .join('|');
  if (itemSignature) return itemSignature;
  return `${result?.id || 'result'}:${result?.title || ''}:${result?.description || ''}`;
}

function appendFallbackResponses(primaryResults, fallbackResults, limit) {
  const merged = [];
  const seen = new Set();

  for (const result of [...(primaryResults || []), ...(fallbackResults || [])]) {
    if (!result) continue;
    const signature = responseSignature(result);
    if (seen.has(signature)) continue;
    seen.add(signature);
    merged.push(result);
    if (merged.length >= limit) break;
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI ENHANCEMENT — adds personality, confidence, and final curation
// ═══════════════════════════════════════════════════════════════════════════

async function enhanceWithAI(candidates, ctx) {
  const { wardrobe, styleDNA, preferences, occasion, timeOfDay, weather, limit, forecast, weatherDetail: wd } = ctx;

  // Build user profile summary
  const colorDist = {}, styleDist = {};
  wardrobe.forEach(item => {
    if (item.color) colorDist[item.color.toLowerCase()] = (colorDist[item.color.toLowerCase()] || 0) + 1;
    if (item.style) styleDist[item.style.toLowerCase()] = (styleDist[item.style.toLowerCase()] || 0) + 1;
  });
  const topColors = Object.entries(colorDist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  const topStyles = Object.entries(styleDist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);

  let userProfile = '';
  if (preferences?.preferredColors?.length) userProfile += `Loves: ${preferences.preferredColors.join(', ')}. `;
  if (preferences?.preferredStyles?.length) userProfile += `Style: ${preferences.preferredStyles.join(', ')}. `;
  if (preferences?.avoidedColors?.length) userProfile += `Avoids colors: ${preferences.avoidedColors.join(', ')}. `;
  if (preferences?.avoidedStyles?.length) userProfile += `Avoids styles: ${preferences.avoidedStyles.join(', ')}. `;
  const bodyType = preferences?.bodyType || styleDNA?.bodyType;
  if (bodyType) userProfile += `Body type: ${bodyType} — factor fit and proportion into your picks. `;
  if (preferences?.ageRange) userProfile += `Age: ${preferences.ageRange}. `;
  userProfile += `Wardrobe trends: ${topColors.join(', ')} colors, ${topStyles.join(', ')} styles.`;
  if (styleDNA?.primaryStyle) userProfile += ` Style DNA: ${styleDNA.primaryStyle}.`;

  // Per-occasion learned preferences
  const occasionPrefsMap = preferences?.occasionPreferences instanceof Map
    ? Object.fromEntries(preferences.occasionPreferences)
    : (preferences?.occasionPreferences || {});
  const occPref = occasionPrefsMap[occasion];
  if (occPref?.preferredColors?.length || occPref?.preferredStyles?.length) {
    userProfile += ` For ${occasion}: prefers ${(occPref.preferredColors || []).join(', ')} colors, ${(occPref.preferredStyles || []).join(', ')} styles.`;
  }

  if (preferences?.feedbackCount > 0) {
    userProfile += ` (${preferences.feedbackCount} past interactions — trust learned patterns).`;
  }

  // Enrich prompt with new intelligence signals
  if (ctx.userColorTemp?.tendency !== 'neutral') {
    userProfile += ` Color temperature: leans ${ctx.userColorTemp.tendency} (${Math.round(ctx.userColorTemp.warmRatio * 100)}% warm, ${Math.round(ctx.userColorTemp.coolRatio * 100)}% cool).`;
  }
  if (ctx.occasionSubVariant) {
    userProfile += ` Specific vibe: ${ctx.occasionSubVariant.vibe} (${ctx.occasionSubVariant.subVariant}).`;
  }
  if (ctx.feedbackPatterns?.totalPositive >= 5) {
    const topCombos = Object.entries(ctx.feedbackPatterns.colorCombos)
      .sort((a, b) => b[1].positive - a[1].positive)
      .slice(0, 3)
      .filter(([, v]) => v.positive >= 2)
      .map(([k]) => k.replace('+', ' + '));
    if (topCombos.length > 0) {
      userProfile += ` Proven color combos: ${topCombos.join(', ')}.`;
    }
  }

  const season = getCurrentSeason();
  const occasionProfile = OCCASION_PROFILES[occasion] || OCCASION_PROFILES.casual;
  const timeProfile = TIME_PROFILES[timeOfDay] || TIME_PROFILES.afternoon;

  // Hard-filter: ensure AI sees outfits where each top, bottom, and dress is unique
  const diverseForAI = [];
  const usedTopIds = new Set();
  const usedBottomIds = new Set();
  const usedDressIds = new Set();
  const usedShoeIds = new Set();
  const usedDirectionKeysAI = new Set();
  const aiCap = wardrobe.length > 40 ? 24 : 18;
  const uniqueShoesInCandidates = new Set(candidates.map(c => { const s = c.items.find(i => i.category === 'shoes'); return s ? id(s) : null; }).filter(Boolean)).size;
  const strictShoesAI = uniqueShoesInCandidates >= aiCap;
  for (const c of candidates) {
    const topItem = c.items.find(i => i.category === 'top');
    const botItem = c.items.find(i => i.category === 'bottom');
    const dressItem = c.items.find(i => i.category === 'dress');
    const shoeItem = c.items.find(i => i.category === 'shoes');
    const topId = topItem ? id(topItem) : null;
    const botId = botItem ? id(botItem) : null;
    const dressId = dressItem ? id(dressItem) : null;
    const shoeId = shoeItem ? id(shoeItem) : null;

    const topReused = topId && usedTopIds.has(topId);
    const botReused = botId && usedBottomIds.has(botId);
    const dressReused = dressId && usedDressIds.has(dressId);
    const shoeReused = strictShoesAI && shoeId && usedShoeIds.has(shoeId);
    const directionKey = getOutfitDirection(c.items).key;
    const directionReused = !ctx.wardrobeProfile?.isTiny && usedDirectionKeysAI.has(directionKey);

    if (topReused || botReused || dressReused || shoeReused || directionReused) continue;

    if (topId) usedTopIds.add(topId);
    if (botId) usedBottomIds.add(botId);
    if (dressId) usedDressIds.add(dressId);
    if (shoeId) usedShoeIds.add(shoeId);
    usedDirectionKeysAI.add(directionKey);
    diverseForAI.push(c);
    if (diverseForAI.length >= aiCap) break;
  }
  // If strict uniqueness produced too few, relax to allow shoe reuse only
  if (diverseForAI.length < limit) {
    const usedT2 = new Set(diverseForAI.map(c => { const t = c.items.find(i => i.category === 'top'); return t ? id(t) : null; }).filter(Boolean));
    const usedB2 = new Set(diverseForAI.map(c => { const b = c.items.find(i => i.category === 'bottom'); return b ? id(b) : null; }).filter(Boolean));
    for (const c of candidates) {
      if (diverseForAI.length >= aiCap) break;
      if (diverseForAI.includes(c)) continue;
      const topItem = c.items.find(i => i.category === 'top');
      const botItem = c.items.find(i => i.category === 'bottom');
      const topId = topItem ? id(topItem) : null;
      const botId = botItem ? id(botItem) : null;
      if ((topId && usedT2.has(topId)) || (botId && usedB2.has(botId))) continue;
      if (topId) usedT2.add(topId);
      if (botId) usedB2.add(botId);
      diverseForAI.push(c);
    }
  }
  // Absolute fallback: just fill from candidates
  if (diverseForAI.length < limit) {
    for (const c of candidates) {
      if (diverseForAI.length >= aiCap) break;
      if (!diverseForAI.includes(c)) diverseForAI.push(c);
    }
  }

  const detailed = diverseForAI.map((c, idx) => {
    const presentation = buildPresentationCopy(c.items, ctx);
    return {
      idx,
      direction: presentation.direction.key,
      palette: presentation.direction.paletteLabel,
      structure: presentation.direction.structure,
      styleGroup: presentation.direction.styleGroup,
      rotation: Math.round(outfitRotationScore(c.items) * 100),
      semanticCohesion: Math.round((c.semanticCohesion || 0.7) * 100),
      semanticEmbedding: c.semanticEmbedding,
      semanticAesthetics: c.semanticAesthetics,
      semanticVibes: c.semanticVibes,
      titleHint: presentation.title,
      items: c.items.map(item => ({
        ...summarizeSemanticProfile(item),
        id: id(item), name: item.name || 'Item',
        category: item.category, color: item.color || 'unknown',
        style: item.style || 'casual',
      })),
      score: Math.round(c.score * 100),
      reasons: (c.reasons || buildReasons(c.items, ctx, c.intel)).slice(0, 2),
    };
  });

  const wdSafe = wd || {};
  let weatherLine = `SEASON: ${season} | WEATHER: ${weather}`;
  if (wdSafe.temperature != null) weatherLine += ` (${wdSafe.temperature}°C)`;
  if (wdSafe.condition) weatherLine += ` — condition: ${wdSafe.condition}`;
  if (wdSafe.humidity != null) weatherLine += `, humidity: ${wdSafe.humidity}%`;
  if (wdSafe.windSpeed != null) weatherLine += `, wind: ${wdSafe.windSpeed} m/s`;

  const weatherAlerts = [];
  if (forecast.hasRainRisk || wdSafe.isRainy) weatherAlerts.push('RAIN expected — prioritize outfits with rain-appropriate outerwear and closed shoes');
  if (wdSafe.isSnowy) weatherAlerts.push('SNOW — must have warm outerwear and closed/waterproof footwear');
  if (wdSafe.isWindy) weatherAlerts.push('WINDY — favor structured layers, avoid flowy/sheer pieces');
  if (wdSafe.isHumid && weather !== 'cold') weatherAlerts.push('HIGH HUMIDITY — favor breathable, lightweight fabrics (linen, cotton)');
  if (forecast.needsLayers) weatherAlerts.push('TEMPERATURE SWING — recommend layerable outfits');
  if (weather === 'cold') weatherAlerts.push('COLD — ensure warm layers, heavy fabrics, closed shoes; avoid exposed skin');
  if (weather === 'hot') weatherAlerts.push('HOT — light fabrics, breathable materials; avoid heavy layers');
  const weatherAlertBlock = weatherAlerts.length > 0 ? `\nWEATHER RULES (must follow):\n${weatherAlerts.map(a => `- ${a}`).join('\n')}\n` : '';

  // Wardrobe composition summary for AI context
  const catCounts = {};
  wardrobe.forEach(item => {
    const c = item.category || 'other';
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  const wardrobeSummary = Object.entries(catCounts).map(([c, n]) => `${n} ${c}${n > 1 ? 's' : ''}`).join(', ');
  const wardrobeSize = wardrobe.length <= 8 ? 'very small' : wardrobe.length <= 15 ? 'small' : wardrobe.length <= 40 ? 'medium' : 'large';

  const prompt = `You are Fashion Fit's AI styling engine. Pick the BEST ${limit} outfits from ${detailed.length} algorithm-scored candidates.

USER: ${userProfile}
WARDROBE: ${wardrobe.length} items (${wardrobeSize}) — ${wardrobeSummary}

OCCASION: ${occasion} — vibe should feel "${occasionProfile.vibe}"
TIME: ${timeOfDay} — energy is "${timeProfile.vibe}"
${weatherLine}
${weatherAlertBlock}
CANDIDATES:
${JSON.stringify(detailed, null, 1)}

IMPORTANT SEMANTIC SIGNAL:
- Every item and outfit includes a semanticEmbedding vector in this exact order:
  [formality, structure, texture, boldness, softness, warmth, polish, ruggedness, minimalism, versatility]
- Use these embeddings as a visual vibe fingerprint, not just text labels.
- Two items can share category and color but still be far apart in embedding space. Example: a polished navy silk shirt and a distressed sky-blue denim shirt should be treated as very different energies.

RULES:
1. Pick ${limit} outfits that each feel DISTINCTLY DIFFERENT — EVERY outfit MUST have a different top AND a different bottom (or dress). NEVER repeat the same top across outfits. NEVER repeat the same bottom across outfits. Different color stories, different moods.${wardrobe.length <= 15 ? ' This is a smaller wardrobe so shoe/accessory reuse is fine — but tops and bottoms MUST be different.' : ''}
2. Every outfit must genuinely suit "${occasion}" at "${timeOfDay}" AND the current weather. If it's cold, prefer warm layers. If it's raining, prefer rain-appropriate outerwear. If it's hot, the outfit should feel light and breathable.
3. Work with what the user OWNS. ${wardrobeSize === 'very small' || wardrobeSize === 'small' ? 'This user has a limited wardrobe — be creative with what they have. Show them how to style a few pieces differently rather than expecting variety they don\'t have. Every outfit you pick should still feel considered and intentional.' : 'With this many pieces available, select outfits that showcase the FULL breadth of their wardrobe — pull from different items, not just the same favorites. Avoid underutilizing any category. Every item deserves to be styled.'}
4. Give each a catchy 3-4 word title and a one-liner (max 15 words) that speaks directly to the user. The description should acknowledge the weather when relevant (e.g. "Keeping you dry and sharp through the rain" or "Light and breezy for this sunny afternoon").${wardrobeSize === 'very small' || wardrobeSize === 'small' ? ' For smaller wardrobes, emphasize how versatile their pieces are.' : ''}
5. Provide 2-3 enhanced reasons — personal, confident, no generic filler. At least one reason should reference weather-appropriateness if conditions are notable (rain, cold, hot, windy, humid).

OUTPUT (JSON only, no markdown):
{
  "outfits": [
    {
      "candidateIdx": 0,
      "aiConfidence": 93,
      "title": "Power Move Casual",
      "description": "This laid-back look says you've got it together without trying",
      "enhancedReasons": ["Earth tones that complement your style DNA", "Effortlessly cool for a ${timeOfDay} ${occasion} moment"]
    }
  ]
}

Output ONLY valid JSON.`;

  // Use gpt-4o for high-stakes occasions where styling quality matters most
  const aiModel = (occasion === 'formal' || occasion === 'date') ? 'gpt-4o' : 'gpt-4o-mini';

  const systemPrompt = `You are a personal AI stylist who knows this specific user deeply — their body type, style DNA, what they've liked and rejected before, and exactly what's in their wardrobe. Your job is not to describe fashion theory but to make real, specific styling decisions for this real person right now. You think about fit, proportion, and how pieces actually look together on a body — not just colour matching. Output ONLY valid JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.82,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('OpenAI API error:', text);
    throw new Error('OpenAI API request failed');
  }

  const json = await response.json();
  const raw = json.choices?.[0]?.message?.content || '{}';

  let parsed;
  try {
    let clean = raw.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    parsed = JSON.parse(clean);
  } catch {
    console.error('Failed to parse AI response:', raw);
    throw new Error('Failed to parse AI response');
  }

  // Track API cost
  const pt = json.usage?.prompt_tokens || 0;
  const ct = json.usage?.completion_tokens || 0;
  const modelCosts = { 'gpt-4o': { prompt: 2.50, completion: 10.00 }, 'gpt-4o-mini': { prompt: 0.15, completion: 0.60 } };
  const mc = modelCosts[aiModel] || modelCosts['gpt-4o-mini'];
  await ApiUsage.create({
    date: new Date(), service: 'openai', operation: 'enhance-outfits',
    tokens: { prompt: pt, completion: ct },
    cost: (pt / 1e6 * mc.prompt) + (ct / 1e6 * mc.completion),
    model: aiModel,
  }).catch(() => {});

  // Map AI picks back to algorithm candidates
  const aiSelections = sanitizeAISelections(parsed, diverseForAI.length, limit);

  const rawEnhanced = aiSelections.map(ai => {
    const orig = diverseForAI[ai.candidateIdx];
    if (!orig) return null;

    const algoScore = (orig.score || 0.7) * 100;
    const aiConf = ai.aiConfidence || 85;
    const final = algoScore * 0.55 + aiConf * 0.45;
    const deduped = deduplicateAccessories(orig.items);
    const presentation = buildPresentationCopy(deduped, ctx);
    const archetype = classifyArchetype(deduped, ctx);
    const completeHint = completeTheLook(deduped, ctx);

    return {
      id: makeRecommendationId('hybrid', ctx.requestSeed, `${ai.candidateIdx}:${deduped.map(id).sort().join('|')}`),
      items: deduped.map(item => ({
        id: id(item), name: item.name, category: item.category,
        color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
        style: item.style, pattern: item.pattern,
      })),
      score: normalizeRecommendationScore(final),
      confidence: computeRecommendationConfidence(orig, ctx),
      reasons: ai.enhancedReasons?.length ? ai.enhancedReasons : [ai.description || presentation.description || 'Styled to perfection'],
      title: ai.title || presentation.title,
      description: ai.description || presentation.description,
      archetype,
      ...(completeHint ? { completeTheLook: completeHint } : {}),
      occasion, timeOfDay, weather,
      algorithmScore: Math.round(algoScore),
      aiConfidence: Math.round(aiConf),
      _origIdx: ai.candidateIdx,
      _directionKey: presentation.direction.key,
      _semanticEmbedding: orig.semanticEmbedding,
    };
  }).filter(Boolean);

  // POST-AI DIVERSITY ENFORCEMENT
  const enhanced = [];
  const finalUsedTops = new Set();
  const finalUsedBottoms = new Set();
  const finalUsedDresses = new Set();
  const finalUsedShoes = new Set();
  const finalUsedDirections = new Set();
  const finalUsedSemanticEmbeddings = [];
  const finalUniqueShoes = new Set(rawEnhanced.map(o => o.items.find(i => i.category === 'shoes')?.id).filter(Boolean)).size;
  const strictShoesFinal = finalUniqueShoes >= limit;

  for (const outfit of rawEnhanced) {
    const topId = outfit.items.find(i => i.category === 'top')?.id;
    const botId = outfit.items.find(i => i.category === 'bottom')?.id;
    const dressId = outfit.items.find(i => i.category === 'dress')?.id;
    const shoeId = outfit.items.find(i => i.category === 'shoes')?.id;
    const directionDup = finalUsedDirections.has(outfit._directionKey);
    const semanticDup = finalUsedSemanticEmbeddings.some(embedding => embeddingSimilarity(embedding, outfit._semanticEmbedding) > 0.96);

    const topDup = topId && finalUsedTops.has(topId);
    const botDup = botId && finalUsedBottoms.has(botId);
    const dressDup = dressId && finalUsedDresses.has(dressId);
    const shoeDup = strictShoesFinal && shoeId && finalUsedShoes.has(shoeId);

    if (topDup || botDup || dressDup || shoeDup || directionDup || semanticDup) continue;

    if (topId) finalUsedTops.add(topId);
    if (botId) finalUsedBottoms.add(botId);
    if (dressId) finalUsedDresses.add(dressId);
    if (shoeId) finalUsedShoes.add(shoeId);
    if (outfit._directionKey) finalUsedDirections.add(outfit._directionKey);
    if (outfit._semanticEmbedding) finalUsedSemanticEmbeddings.push(outfit._semanticEmbedding);
    enhanced.push(outfit);
  }

  // Fill remaining slots from candidates the AI didn't pick
  if (enhanced.length < limit) {
    const usedIdxs = new Set(enhanced.map(o => o._origIdx));
    for (const [idx, cand] of diverseForAI.entries()) {
      if (enhanced.length >= limit) break;
      if (usedIdxs.has(idx)) continue;

      const topItem = cand.items.find(i => i.category === 'top');
      const botItem = cand.items.find(i => i.category === 'bottom');
      const dressItem = cand.items.find(i => i.category === 'dress');
      const shoeItem = cand.items.find(i => i.category === 'shoes');
      const tId = topItem ? id(topItem) : null;
      const bId = botItem ? id(botItem) : null;
      const dId = dressItem ? id(dressItem) : null;
      const sId = shoeItem ? id(shoeItem) : null;
      const presentation = buildPresentationCopy(cand.items, ctx);

      if ((tId && finalUsedTops.has(tId)) || (bId && finalUsedBottoms.has(bId)) ||
          (dId && finalUsedDresses.has(dId)) || (strictShoesFinal && sId && finalUsedShoes.has(sId)) ||
          finalUsedDirections.has(presentation.direction.key) ||
          finalUsedSemanticEmbeddings.some(embedding => embeddingSimilarity(embedding, cand.semanticEmbedding) > 0.97)) continue;

      if (tId) finalUsedTops.add(tId);
      if (bId) finalUsedBottoms.add(bId);
      if (dId) finalUsedDresses.add(dId);
      if (sId) finalUsedShoes.add(sId);
      finalUsedDirections.add(presentation.direction.key);
      if (cand.semanticEmbedding) finalUsedSemanticEmbeddings.push(cand.semanticEmbedding);

      const deduped = deduplicateAccessories(cand.items);
      const fillArchetype = classifyArchetype(deduped, ctx);
      const fillHint = completeTheLook(deduped, ctx);
      enhanced.push({
        id: makeRecommendationId('fill', ctx.requestSeed, `${idx}:${deduped.map(id).sort().join('|')}`),
        items: deduped.map(item => ({
          id: id(item), name: item.name, category: item.category,
          color: item.color, imageUrl: item.thumbnailUrl || item.mediumUrl || item.imageUrl,
          style: item.style, pattern: item.pattern,
        })),
        score: normalizeRecommendationScore(cand.score),
        confidence: computeRecommendationConfidence(cand, ctx, 'fill'),
        reasons: cand.reasons || buildReasons(cand.items, ctx, cand.intel),
        title: presentation.title,
        description: presentation.description,
        archetype: fillArchetype,
        ...(fillHint ? { completeTheLook: fillHint } : {}),
        occasion, timeOfDay, weather,
        _semanticEmbedding: cand.semanticEmbedding,
      });
    }
  }

  // Absolute fallback
  if (enhanced.length === 0) {
    return formatResults(candidates, ctx);
  }

  const mergedWithFallback = enhanced.length < limit
    ? appendFallbackResponses(enhanced, formatResults(candidates, ctx), limit)
    : enhanced;

  mergedWithFallback.forEach(o => {
    delete o._origIdx;
    delete o._directionKey;
    delete o._semanticEmbedding;
  });
  return mergedWithFallback.slice(0, limit);
}

module.exports = { enhanceWithAI, appendFallbackResponses };
