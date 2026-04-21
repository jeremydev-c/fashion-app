/**
 * occasionVariants.js — Sub-variant parsing for granular occasion context.
 * Allows 'date-dinner', 'casual-brunch', 'work-corporate' etc. with
 * specific formality targets and vibe descriptions.
 */

const OCCASION_SUB_VARIANTS = {
  'casual-brunch':    { base: 'casual',  formality: 0.35, vibe: 'relaxed, social, curated',    preferLight: true },
  'casual-errands':   { base: 'casual',  formality: 0.20, vibe: 'effortless, practical',       preferLight: false },
  'casual-hangout':   { base: 'casual',  formality: 0.30, vibe: 'relaxed, cool, intentional',  preferLight: false },
  'casual-travel':    { base: 'casual',  formality: 0.28, vibe: 'comfortable, layered, smart',  preferLight: false },
  'date-coffee':      { base: 'date',    formality: 0.42, vibe: 'approachable, put-together',  preferLight: true },
  'date-dinner':      { base: 'date',    formality: 0.65, vibe: 'elevated, romantic, polished', preferLight: false },
  'date-drinks':      { base: 'date',    formality: 0.55, vibe: 'confident, alluring',         preferLight: false },
  'work-creative':    { base: 'work',    formality: 0.52, vibe: 'smart, expressive',           preferLight: false },
  'work-corporate':   { base: 'work',    formality: 0.78, vibe: 'sharp, authoritative',        preferLight: false },
  'work-meeting':     { base: 'work',    formality: 0.72, vibe: 'polished, confident',         preferLight: false },
  'party-cocktail':   { base: 'party',   formality: 0.68, vibe: 'elevated, festive',           preferLight: false },
  'party-club':       { base: 'party',   formality: 0.55, vibe: 'bold, daring, standout',      preferLight: false },
  'party-birthday':   { base: 'party',   formality: 0.50, vibe: 'fun, celebratory',            preferLight: false },
  'formal-wedding':   { base: 'formal',  formality: 0.88, vibe: 'elegant, refined, respectful', preferLight: false },
  'formal-gala':      { base: 'formal',  formality: 0.95, vibe: 'showstopping, luxurious',     preferLight: false },
};

function parseOccasionSubVariant(occasionInput) {
  const normalized = String(occasionInput || '').toLowerCase().trim().replace(/\s+/g, '-');
  if (OCCASION_SUB_VARIANTS[normalized]) {
    return { subVariant: normalized, ...OCCASION_SUB_VARIANTS[normalized] };
  }
  return null;
}

module.exports = { OCCASION_SUB_VARIANTS, parseOccasionSubVariant };
