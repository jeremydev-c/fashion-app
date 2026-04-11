// ─── Test Setup ─────────────────────────────────────────────────────────────

// Mock env to enable planLimits (normally BYPASS_LIMITS = true)
process.env.JWT_SECRET = 'test-secret';

// We need to mock Mongoose User model to test planLimits middleware
jest.mock('../models/User', () => {
  return {
    findById: jest.fn(),
  };
});

const User = require('../models/User');

// Import AFTER mocking
const { requireFeature, enforceItemLimit } = require('../middleware/planLimits');

// ─── Mock Express helpers ──────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    headers: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockNext() {
  return jest.fn();
}

// ─── requireFeature ────────────────────────────────────────────────────────

describe('requireFeature', () => {
  // Note: BYPASS_LIMITS is hardcoded to true in the middleware,
  // so all these tests should pass through. This verifies the bypass works.

  test('returns a middleware function', () => {
    const middleware = requireFeature('styleCoach');
    expect(typeof middleware).toBe('function');
  });

  test('middleware calls next (BYPASS_LIMITS enabled)', () => {
    const middleware = requireFeature('styleCoach');
    const req = mockReq({ query: { userId: 'user123' } });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    // With BYPASS_LIMITS = true, should always call next
    expect(next).toHaveBeenCalled();
  });

  test('passes through for any feature when bypassed', () => {
    const features = ['styleCoach', 'analytics', 'planner', 'destinationWeather', 'bulkUpload'];
    
    features.forEach(feature => {
      const middleware = requireFeature(feature);
      const req = mockReq({ query: { userId: 'user123' } });
      const res = mockRes();
      const next = mockNext();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});

// ─── enforceItemLimit ──────────────────────────────────────────────────────

describe('enforceItemLimit', () => {
  test('returns a middleware function', () => {
    const middleware = enforceItemLimit();
    expect(typeof middleware).toBe('function');
  });

  test('middleware calls next (BYPASS_LIMITS enabled)', () => {
    const middleware = enforceItemLimit();
    const req = mockReq({ query: { userId: 'user123' } });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
