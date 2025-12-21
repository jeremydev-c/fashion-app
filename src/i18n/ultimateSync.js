/**
 * ULTIMATE TRANSLATION SYNC SCRIPT
 * Translates ALL strings from en.json to ALL 30 languages
 * Run: node src/i18n/ultimateSync.js
 */

const fs = require('fs');
const path = require('path');

// Load API key
const envPath = path.join(__dirname, '../../api/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) process.env[key.trim()] = val.join('=').trim();
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const localesDir = path.join(__dirname, 'locales');

const LANGUAGES = [
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'bg', name: 'Bulgarian', native: 'Български' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'no', name: 'Norwegian', native: 'Norsk' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'zh', name: 'Chinese Simplified', native: '中文' },
];

async function translateJSON(jsonObj, targetLang) {
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
          content: `You are a professional translator. Translate ALL string values in this JSON to ${targetLang}. 
RULES:
1. Keep JSON structure EXACTLY the same
2. Only translate string VALUES, never keys
3. Keep {{variables}} unchanged (e.g., {{name}}, {{count}})
4. Do NOT translate brand name "Fashion Fit"
5. Keep language names in their native script in the "languages" section
6. Return ONLY valid JSON, no markdown, no explanation`
        },
        { role: 'user', content: JSON.stringify(jsonObj, null, 2) }
      ],
      temperature: 0.2,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  
  // Clean markdown if present
  if (content.startsWith('```')) {
    content = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }
  
  return JSON.parse(content);
}

async function translateLanguage(lang, enContent) {
  const targetPath = path.join(localesDir, `${lang.code}.json`);
  
  console.log(`\n🌍 Translating to ${lang.name} (${lang.native})...`);
  
  try {
    const translated = await translateJSON(enContent, lang.name);
    fs.writeFileSync(targetPath, JSON.stringify(translated, null, 2), 'utf8');
    console.log(`   ✅ ${lang.code}.json - Complete!`);
    return true;
  } catch (error) {
    console.error(`   ❌ ${lang.code} failed: ${error.message}`);
    // Write English as fallback
    fs.writeFileSync(targetPath, JSON.stringify(enContent, null, 2), 'utf8');
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🚀 ULTIMATE TRANSLATION SYNC - Fashion Fit');
  console.log('   Translating to ALL 30 languages');
  console.log('═══════════════════════════════════════════════════════════');

  if (!OPENAI_API_KEY) {
    console.error('\n❌ ERROR: OPENAI_API_KEY not found in api/.env');
    process.exit(1);
  }

  // Load English source
  const enPath = path.join(localesDir, 'en.json');
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  
  console.log(`\n📝 Source: en.json loaded`);
  console.log(`   Keys: ${Object.keys(enContent).length} sections`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < LANGUAGES.length; i++) {
    const lang = LANGUAGES[i];
    console.log(`\n[${i + 1}/${LANGUAGES.length}]`);
    
    const result = await translateLanguage(lang, enContent);
    if (result) success++; else failed++;
    
    // Rate limiting - wait 2 seconds between requests
    if (i < LANGUAGES.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`   ✅ COMPLETE!`);
  console.log(`   Success: ${success}/${LANGUAGES.length}`);
  if (failed > 0) console.log(`   Failed: ${failed} (using English fallback)`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

