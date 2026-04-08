const assert = require('node:assert/strict');

const {
  getSemanticProfile,
  semanticSimilarity,
  semanticCompatibility,
} = require('../utils/semanticStyleProfile');

module.exports = [
  {
    name: 'semantic profile separates polished silk from distressed denim even when both are blue tops',
    run() {
      const silkShirt = {
        name: 'Navy Silk Shirt',
        category: 'top',
        subcategory: 'button-down shirt',
        color: 'navy blue',
        style: 'formal',
        pattern: 'solid',
        fit: 'slim',
        tags: ['silk', 'tailored', 'polished'],
      };
      const denimShirt = {
        name: 'Sky Blue Distressed Denim Shirt',
        category: 'top',
        subcategory: 'overshirt',
        color: 'sky blue',
        style: 'streetwear',
        pattern: 'solid',
        fit: 'oversized',
        tags: ['denim', 'distressed', 'casual'],
      };

      const silk = getSemanticProfile(silkShirt);
      const denim = getSemanticProfile(denimShirt);

      assert.equal(silk.dressCode, 'formal');
      assert.equal(denim.texture, 'distressed');
      assert.ok(silk.materials.includes('silk'));
      assert.ok(denim.materials.includes('denim'));
      assert.ok(semanticSimilarity(silk, denim) < 0.6);
    },
  },
  {
    name: 'semantic profile keeps near-identical polished pieces close together',
    run() {
      const blackBlazer = getSemanticProfile({
        name: 'Black Tailored Blazer',
        category: 'outerwear',
        subcategory: 'single-breasted blazer',
        color: 'black',
        style: 'formal',
        pattern: 'solid',
        fit: 'slim',
        tags: ['wool', 'tailored', 'polished'],
      });
      const navyBlazer = getSemanticProfile({
        name: 'Navy Wool Blazer',
        category: 'outerwear',
        subcategory: 'single-breasted blazer',
        color: 'navy',
        style: 'formal',
        pattern: 'solid',
        fit: 'slim',
        tags: ['wool', 'tailored', 'classic'],
      });

      assert.ok(semanticSimilarity(blackBlazer, navyBlazer) > 0.8);
      assert.ok(semanticCompatibility(blackBlazer, navyBlazer, 'formal') > 0.8);
    },
  },
];
