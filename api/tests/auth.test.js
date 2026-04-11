const jwt = require('jsonwebtoken');

// ─── Test Setup ─────────────────────────────────────────────────────────────

// Set JWT_SECRET before requiring auth module
const TEST_SECRET = 'test-secret-for-jest-12345';
process.env.JWT_SECRET = TEST_SECRET;

const { generateToken, authenticate, optionalAuth } = require('../middleware/auth');

// Mock Express req/res/next
function mockReq(overrides = {}) {
  return {
    headers: {},
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

// ─── generateToken ──────────────────────────────────────────────────────────

describe('generateToken', () => {
  test('produces a valid JWT string', () => {
    const token = generateToken('user123');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  test('token contains the correct userId', () => {
    const token = generateToken('user456');
    const decoded = jwt.verify(token, TEST_SECRET);
    expect(decoded.userId).toBe('user456');
  });

  test('token has an expiration', () => {
    const token = generateToken('user789');
    const decoded = jwt.verify(token, TEST_SECRET);
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('token expires in approximately 30 days', () => {
    const token = generateToken('user789');
    const decoded = jwt.verify(token, TEST_SECRET);
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(thirtyDaysInSeconds);
  });
});

// ─── authenticate middleware ────────────────────────────────────────────────

describe('authenticate', () => {
  test('rejects request with no Authorization header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with invalid Authorization format', () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with expired token', () => {
    // Create token that expired 1 second ago
    const token = jwt.sign({ userId: 'user123' }, TEST_SECRET, { expiresIn: '-1s' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with token signed by wrong secret', () => {
    const token = jwt.sign({ userId: 'user123' }, 'wrong-secret');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts valid token and sets req.userId', () => {
    const token = generateToken('user_abc');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user_abc');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects malformed token string', () => {
    const req = mockReq({ headers: { authorization: 'Bearer not.a.real.jwt' } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── optionalAuth middleware ────────────────────────────────────────────────

describe('optionalAuth', () => {
  test('continues without userId when no header present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });

  test('continues without userId when token is invalid', () => {
    const req = mockReq({ headers: { authorization: 'Bearer invalid.token.here' } });
    const res = mockRes();
    const next = mockNext();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });

  test('sets userId when valid token is provided', () => {
    const token = generateToken('user_optional');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = mockNext();

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user_optional');
  });

  test('does not send error response on invalid token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer expired.or.bad' } });
    const res = mockRes();
    const next = mockNext();

    optionalAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
