const express = require('express');
const { sanitizeSemanticProfile } = require('../utils/semanticStyleProfile');

const router = express.Router();

// POST /ai/categorize
// Uses OpenAI to suggest category, color and tags based on a brief text description.
router.post('/categorize', async (req, res) => {
  try {
    const { name, notes } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
    }

    const prompt = `
You are a fashion wardrobe categorization engine.

User just added an item to their digital wardrobe.
Name: "${name}"
Extra notes: "${notes || ''}"

Infer:
- category: one of ["top","bottom","dress","shoes","outerwear","accessory","other"]
- color: a simple color name if obvious, else ""
- tags: 2-5 short style tags (lowercase, no spaces except between words)

Respond ONLY as minified JSON like:
{"category":"top","color":"black","tags":["casual","streetwear"]}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You output only minified JSON, no explanation.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenAI error response:', text);
      return res.status(500).json({ error: 'OpenAI request failed' });
    }

    const json = await response.json();
    const rawContent = json.choices?.[0]?.message?.content || '{}';

    // Track API usage for categorize (text-based)
    try {
      const ApiUsage = require('../models/ApiUsage');
      const usage = json.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      
      // Calculate cost: GPT-4o-mini pricing ($0.15/1M input, $0.60/1M output)
      const cost = (promptTokens / 1000000 * 0.15) + (completionTokens / 1000000 * 0.60);
      
      await ApiUsage.create({
        service: 'openai',
        operation: 'categorize',
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

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      console.error('Failed to parse OpenAI JSON:', rawContent);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    const category =
      ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'other'].includes(
        parsed.category,
      )
        ? parsed.category
        : 'other';

    const color = typeof parsed.color === 'string' ? parsed.color : '';
    const tags =
      Array.isArray(parsed.tags) && parsed.tags.every((t) => typeof t === 'string')
        ? parsed.tags
        : [];

    res.json({ category, color, tags });
  } catch (err) {
    console.error('POST /ai/categorize error', err);
    res.status(500).json({ error: 'AI categorization failed' });
  }
});

// POST /ai/categorize-image
// Enhanced AI categorization with subcategory, pattern, style, brand detection
router.post('/categorize-image', async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
    }

    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    const prompt = `You are a fashion wardrobe validation and categorization system. 

CRITICAL: First, determine if this image shows CLOTHING or ACCESSORIES. Only accept:
- Clothing items: tops, bottoms, dresses, shoes, outerwear (jackets, coats, etc.)
- Fashion accessories: bags, jewelry, watches, belts, hats, scarves, sunglasses

REJECT if the image shows:
- People (faces, bodies, full person photos)
- Non-clothing items (furniture, food, electronics, animals, etc.)
- Inappropriate content
- Random objects that are not fashion items

If the image is NOT clothing or accessories, return:
{"isClothing":false,"rejectionReason":"Brief reason why this is not a clothing/accessory item"}

If the image IS clothing or accessories, return ONLY minified JSON with:
- isClothing: true
- category: one of ["top","bottom","dress","shoes","outerwear","accessory","other"]
- subcategory: specific type (e.g., "v-neck t-shirt", "skinny jeans", "ankle boots", "blazer")
- color: dominant color name (e.g., "black", "navy blue", "beige")
- colorPalette: array of 3-5 colors present in the item
- style: one of ["casual","formal","sporty","streetwear","bohemian","minimalist","vintage","modern"]
- pattern: one of ["solid","striped","printed","floral","geometric","abstract","plaid","polka-dot"]
- fit: one of ["loose","fitted","oversized","relaxed","slim"]
- occasion: array of suitable occasions (e.g., ["work","casual","party","date","travel"])
- brand: brand name if detectable, else null
- tags: array of 3-7 style tags (lowercase, descriptive)
- confidence: confidence score 0-1
- semanticProfile: object with:
  - summary: a concise 6-14 word visual summary of the item's vibe
  - materials: array of 1-3 likely materials from ["cotton","linen","silk","satin","denim","leather","suede","wool","cashmere","knit","jersey","fleece","tweed","corduroy","chiffon","mesh"]
  - texture: one of ["smooth","matte","textured","distressed","crisp","knit"]
  - silhouette: one of ["tailored","straight","boxy","oversized","flowy","body-skimming"]
  - structure: one of ["soft","relaxed","balanced","tailored","structured"]
  - dressCode: one of ["very-casual","casual","smart-casual","polished","formal"]
  - aesthetics: array of 1-3 from ["classic","minimalist","romantic","streetwear","edgy","sporty","bohemian","vintage","modern","utilitarian","relaxed","elegant"]
  - vibeKeywords: array of 3-6 short keywords describing the item's fashion energy
  - pairingKeywords: array of 2-6 short keywords describing what it pairs well with

Example valid response:
{"isClothing":true,"category":"top","subcategory":"v-neck t-shirt","color":"black","colorPalette":["black","gray","white"],"style":"casual","pattern":"solid","fit":"fitted","occasion":["casual","work"],"brand":null,"tags":["casual","basic","versatile","comfortable"],"confidence":0.95,"semanticProfile":{"summary":"black fitted tee with clean casual energy","materials":["cotton"],"texture":"matte","silhouette":"body-skimming","structure":"balanced","dressCode":"casual","aesthetics":["minimalist","relaxed"],"vibeKeywords":["clean","easy","everyday"],"pairingKeywords":["layering","denim","sneakers"]}}

Example rejection response:
{"isClothing":false,"rejectionReason":"This image shows a person, not a clothing item"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using gpt-4o for better accuracy
        messages: [
          {
            role: 'system',
            content:
              'You are an expert fashion AI that analyzes clothing images. You only output minified JSON, no explanation or markdown.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenAI vision error response:', text);
      return res.status(500).json({ error: 'OpenAI vision request failed' });
    }

    const json = await response.json();
    const rawContent = json.choices?.[0]?.message?.content || '{}';

    // Track API usage for categorize-image
    try {
      const ApiUsage = require('../models/ApiUsage');
      const usage = json.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      
      // Calculate cost: GPT-4o pricing ($2.50/1M input, $10/1M output)
      const cost = (promptTokens / 1000000 * 2.50) + (completionTokens / 1000000 * 10);
      
      await ApiUsage.create({
        service: 'openai',
        operation: 'categorize-image',
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

    // Clean up the response (remove markdown code blocks if present)
    let cleanedContent = rawContent.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch (err) {
      console.error('Failed to parse OpenAI vision JSON:', cleanedContent);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Check if item was rejected (not clothing)
    if (parsed.isClothing === false) {
      return res.status(400).json({
        error: 'INVALID_ITEM',
        rejectionReason: parsed.rejectionReason || 'This image does not appear to be a clothing item or accessory',
        message: 'Only clothing items and fashion accessories can be added to your wardrobe. Please take a photo of the item itself, not a person wearing it.',
      });
    }

    // Validate and sanitize response
    const validCategories = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'other'];
    const validStyles = ['casual', 'formal', 'sporty', 'streetwear', 'bohemian', 'minimalist', 'vintage', 'modern'];
    const validPatterns = ['solid', 'striped', 'printed', 'floral', 'geometric', 'abstract', 'plaid', 'polka-dot'];
    const validFits = ['loose', 'fitted', 'oversized', 'relaxed', 'slim'];

    // Ensure isClothing is true
    if (parsed.isClothing !== true) {
      return res.status(400).json({
        error: 'INVALID_ITEM',
        rejectionReason: 'Unable to confirm this is a clothing item',
        message: 'Please ensure you are photographing a clothing item or fashion accessory.',
      });
    }

    const result = {
      isClothing: true,
      category: validCategories.includes(parsed.category) ? parsed.category : 'other',
      subcategory: typeof parsed.subcategory === 'string' ? parsed.subcategory : '',
      color: typeof parsed.color === 'string' ? parsed.color : '',
      colorPalette: Array.isArray(parsed.colorPalette) ? parsed.colorPalette : [],
      style: validStyles.includes(parsed.style) ? parsed.style : 'casual',
      pattern: validPatterns.includes(parsed.pattern) ? parsed.pattern : 'solid',
      fit: validFits.includes(parsed.fit) ? parsed.fit : 'fitted',
      occasion: Array.isArray(parsed.occasion) ? parsed.occasion : [],
      brand: typeof parsed.brand === 'string' && parsed.brand ? parsed.brand : null,
      tags: Array.isArray(parsed.tags) && parsed.tags.every((t) => typeof t === 'string') ? parsed.tags : [],
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8,
      semanticProfile: sanitizeSemanticProfile(parsed.semanticProfile || {}, {
        name: parsed.subcategory || parsed.category,
        category: validCategories.includes(parsed.category) ? parsed.category : 'other',
        subcategory: typeof parsed.subcategory === 'string' ? parsed.subcategory : '',
        color: typeof parsed.color === 'string' ? parsed.color : '',
        style: validStyles.includes(parsed.style) ? parsed.style : 'casual',
        pattern: validPatterns.includes(parsed.pattern) ? parsed.pattern : 'solid',
        fit: validFits.includes(parsed.fit) ? parsed.fit : 'fitted',
        tags: Array.isArray(parsed.tags) && parsed.tags.every((t) => typeof t === 'string') ? parsed.tags : [],
      }),
    };

    res.json(result);
  } catch (err) {
    console.error('POST /ai/categorize-image error', err);
    res.status(500).json({ error: 'AI image categorization failed' });
  }
});

module.exports = router;

