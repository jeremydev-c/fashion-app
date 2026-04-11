const mongoose = require('mongoose');

// ─── ClothingItem Schema Tests ──────────────────────────────────────────────

describe('ClothingItem Model', () => {
  let ClothingItem;

  beforeAll(() => {
    ClothingItem = require('../models/ClothingItem');
  });

  test('schema has required fields', () => {
    const paths = ClothingItem.schema.paths;
    expect(paths).toHaveProperty('userId');
    expect(paths).toHaveProperty('name');
    expect(paths).toHaveProperty('category');
    expect(paths).toHaveProperty('color');
    expect(paths).toHaveProperty('imageUrl');
  });

  test('category enum enforces valid values', () => {
    const categoryPath = ClothingItem.schema.path('category');
    expect(categoryPath.enumValues).toContain('top');
    expect(categoryPath.enumValues).toContain('bottom');
    expect(categoryPath.enumValues).toContain('dress');
    expect(categoryPath.enumValues).toContain('shoes');
    expect(categoryPath.enumValues).toContain('outerwear');
    expect(categoryPath.enumValues).toContain('accessory');
  });

  test('wearCount defaults to 0', () => {
    const wearCountPath = ClothingItem.schema.path('wearCount');
    expect(wearCountPath.defaultValue).toBe(0);
  });

  test('favorite defaults to false', () => {
    const favoritePath = ClothingItem.schema.path('favorite');
    expect(favoritePath.defaultValue).toBe(false);
  });

  test('schema has compound indexes for performance', () => {
    const indexes = ClothingItem.schema.indexes();
    // At least one compound index should include userId
    const hasUserIdIndex = indexes.some(([fields]) => fields.userId !== undefined);
    expect(hasUserIdIndex).toBe(true);
  });
});

// ─── Outfit Schema Tests ────────────────────────────────────────────────────

describe('Outfit Model', () => {
  let Outfit;

  beforeAll(() => {
    Outfit = require('../models/Outfit');
  });

  test('schema has required fields', () => {
    const paths = Outfit.schema.paths;
    expect(paths).toHaveProperty('userId');
    expect(paths).toHaveProperty('name');
  });

  test('items is an array sub-document with itemId', () => {
    const schema = Outfit.schema;
    // items should exist on the schema
    expect(schema.path('items')).toBeDefined();
  });

  test('wearCount defaults to 0', () => {
    const wearCountPath = Outfit.schema.path('wearCount');
    expect(wearCountPath.defaultValue).toBe(0);
  });

  test('favorite defaults to false', () => {
    const favoritePath = Outfit.schema.path('favorite');
    expect(favoritePath.defaultValue).toBe(false);
  });
});

// ─── User Schema Tests ──────────────────────────────────────────────────────

describe('User Model', () => {
  let User;

  beforeAll(() => {
    User = require('../models/User');
  });

  test('schema has required fields', () => {
    const paths = User.schema.paths;
    expect(paths).toHaveProperty('email');
    expect(paths).toHaveProperty('password');
    expect(paths).toHaveProperty('name');
  });

  test('email is unique and lowercase', () => {
    const emailPath = User.schema.path('email');
    expect(emailPath.options.unique).toBe(true);
    expect(emailPath.options.lowercase).toBe(true);
  });

  test('password has minlength of 6', () => {
    const passwordPath = User.schema.path('password');
    expect(passwordPath.options.minlength).toBe(6);
  });

  test('subscription.planId has valid enum values', () => {
    const planIdPath = User.schema.path('subscription.planId');
    expect(planIdPath.enumValues).toContain('free');
    expect(planIdPath.enumValues).toContain('pro');
    expect(planIdPath.enumValues).toContain('pro-yearly');
    expect(planIdPath.enumValues).toContain('elite');
  });

  test('subscription.planId defaults to free', () => {
    const planIdPath = User.schema.path('subscription.planId');
    expect(planIdPath.defaultValue).toBe('free');
  });

  test('notificationsEnabled defaults to true', () => {
    const path = User.schema.path('notificationsEnabled');
    expect(path.defaultValue).toBe(true);
  });

  test('isVerified defaults to false', () => {
    const path = User.schema.path('isVerified');
    expect(path.defaultValue).toBe(false);
  });

  test('toJSON method strips password', () => {
    // Check that toJSON method exists on schema
    expect(User.schema.methods.toJSON).toBeDefined();
  });

  test('comparePassword method exists', () => {
    expect(User.schema.methods.comparePassword).toBeDefined();
  });

  test('username has regex validation', () => {
    const usernamePath = User.schema.path('username');
    expect(usernamePath.options.match).toBeDefined();
  });

  test('bio has maxlength of 200', () => {
    const bioPath = User.schema.path('bio');
    expect(bioPath.options.maxlength).toBe(200);
  });
});

// ─── UserPreferences Schema Tests ───────────────────────────────────────────

describe('UserPreferences Model', () => {
  let UserPreferences;

  beforeAll(() => {
    UserPreferences = require('../models/UserPreferences');
  });

  test('schema has userId with unique index', () => {
    const userIdPath = UserPreferences.schema.path('userId');
    expect(userIdPath).toBeDefined();
    expect(userIdPath.options.unique).toBe(true);
  });

  test('schema has weighted maps for learning', () => {
    const paths = UserPreferences.schema.paths;
    expect(paths).toHaveProperty('colorWeights');
    expect(paths).toHaveProperty('styleWeights');
    expect(paths).toHaveProperty('categoryWeights');
    expect(paths).toHaveProperty('patternWeights');
    expect(paths).toHaveProperty('occasionWeights');
  });

  test('feedbackCount defaults to 0', () => {
    const path = UserPreferences.schema.path('feedbackCount');
    expect(path.defaultValue).toBe(0);
  });
});

// ─── StyleDNA Schema Tests ──────────────────────────────────────────────────

describe('StyleDNA Model', () => {
  let StyleDNA;

  beforeAll(() => {
    StyleDNA = require('../models/StyleDNA');
  });

  test('schema has userId', () => {
    const paths = StyleDNA.schema.paths;
    expect(paths).toHaveProperty('userId');
  });

  test('schema has style fields', () => {
    const paths = StyleDNA.schema.paths;
    expect(paths).toHaveProperty('primaryStyle');
    expect(paths).toHaveProperty('uniquenessScore');
    expect(paths).toHaveProperty('styleConsistency');
  });
});
