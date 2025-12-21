const fs = require('fs');
const path = require('path');

// Load environment variables from api/.env
const envPath = path.join(__dirname, '../../api/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const LANGUAGES = [
  { code: 'ar', name: 'Arabic' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'es', name: 'Spanish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ms', name: 'Malay' },
  { code: 'nl', name: 'Dutch' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'zh', name: 'Chinese' },
];

const localesDir = path.join(__dirname, 'locales');

async function translateText(text, targetLang) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a translator. Translate the following JSON object to ${targetLang}. Keep the JSON structure exactly the same, only translate the string values. Do not translate brand names like "Fashion Fit". Return ONLY valid JSON, no markdown or explanation.`
        },
        {
          role: 'user',
          content: JSON.stringify(text)
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Clean up response
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.slice(7);
  }
  if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.slice(3);
  }
  if (cleanContent.endsWith('```')) {
    cleanContent = cleanContent.slice(0, -3);
  }
  
  return JSON.parse(cleanContent.trim());
}

async function syncLanguage(langCode, langName) {
  const enPath = path.join(localesDir, 'en.json');
  const targetPath = path.join(localesDir, `${langCode}.json`);
  
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  
  let targetContent = {};
  if (fs.existsSync(targetPath)) {
    try {
      targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch (e) {
      console.log(`  Creating new file for ${langCode}`);
    }
  }
  
  // Find missing keys by comparing structures
  const findMissingKeys = (en, target, prefix = '') => {
    const missing = {};
    for (const key in en) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof en[key] === 'object' && en[key] !== null) {
        if (!target[key] || typeof target[key] !== 'object') {
          missing[key] = en[key];
        } else {
          const nestedMissing = findMissingKeys(en[key], target[key], fullKey);
          if (Object.keys(nestedMissing).length > 0) {
            missing[key] = nestedMissing;
          }
        }
      } else {
        if (!(key in target)) {
          missing[key] = en[key];
        }
      }
    }
    return missing;
  };
  
  const missing = findMissingKeys(enContent, targetContent);
  
  if (Object.keys(missing).length === 0) {
    console.log(`  ${langCode}: Already up to date ✓`);
    return;
  }
  
  console.log(`  ${langCode}: Translating ${Object.keys(missing).length} sections...`);
  
  try {
    const translated = await translateText(missing, langName);
    
    // Deep merge translated content
    const deepMerge = (target, source) => {
      for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    
    deepMerge(targetContent, translated);
    
    fs.writeFileSync(targetPath, JSON.stringify(targetContent, null, 2), 'utf8');
    console.log(`  ${langCode}: Updated ✓`);
  } catch (error) {
    console.error(`  ${langCode}: Error - ${error.message}`);
  }
  
  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 1500));
}

async function main() {
  console.log('🌍 Syncing translations for all languages...\n');
  
  if (!OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not found in api/.env');
    process.exit(1);
  }
  
  for (const lang of LANGUAGES) {
    await syncLanguage(lang.code, lang.name);
  }
  
  console.log('\n✅ Translation sync complete!');
}

main().catch(console.error);

