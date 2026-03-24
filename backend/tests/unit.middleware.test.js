/**
 * Unit Tests for Middleware: auth, validate, error
 */
import { jest } from '@jest/globals';

// ── Mock logger to suppress log output in tests ───────────────────
jest.unstable_mockModule('../src/lib/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// ── Mock prisma for auth middleware ──────────────────────────────
const userFindUniqueMock = jest.fn();
jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: { user: { findUnique: userFindUniqueMock } }
}));

const { requireAuth, requireRole } = await import('../src/middleware/auth.js');
const { validate } = await import('../src/middleware/validate.js');
const { default: errorHandler } = await import('../src/middleware/error.js');
const { signAccessToken } = await import('../src/utils/jwt.js');
const { z } = await import('zod');

// ── helpers ────────────────────────────────────────────────────────
const mockNext = jest.fn();
const fakeUser = { id: 'u1', email: 'x@x.com', role: 'USER' };

function makeReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    path: '/test',
    method: 'GET',
    user: null,
    ...overrides
  };
}

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

// ── requireAuth ────────────────────────────────────────────────────
describe('requireAuth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next(ApiError 401) when Authorization header is missing', async () => {
    const req = makeReq();
    await requireAuth()(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(ApiError 401) for non-Bearer scheme', async () => {
    const req = makeReq({ headers: { authorization: 'Basic abc123' } });
    await requireAuth()(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(ApiError 401) for malformed token', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer not.valid.token' } });
    await requireAuth()(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(ApiError 401) when user not found in DB', async () => {
    const token = signAccessToken(fakeUser);
    userFindUniqueMock.mockResolvedValue(null);
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    await requireAuth()(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('attaches user to req and calls next() on valid token', async () => {
    const token = signAccessToken(fakeUser);
    userFindUniqueMock.mockResolvedValue(fakeUser);
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    await requireAuth()(req, makeRes(), mockNext);
    expect(req.user).toMatchObject({ id: 'u1' });
    expect(mockNext).toHaveBeenCalledWith(); // no error arg
  });
});

// ── requireRole ────────────────────────────────────────────────────
describe('requireRole middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls next() for matching role', () => {
    const req = makeReq({ user: fakeUser });
    requireRole('USER')(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('calls next(ApiError 403) for mismatched role', () => {
    const req = makeReq({ user: fakeUser });
    requireRole('ADMIN')(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('calls next(ApiError 403) when req.user is undefined', () => {
    const req = makeReq({ user: undefined });
    requireRole('USER')(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

// ── validate middleware ────────────────────────────────────────────
describe('validate middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  const schema = z.object({
    body: z.object({ name: z.string().min(2) })
  });

  it('attaches parsed data to req.validated and calls next() on valid input', () => {
    const req = makeReq({ body: { name: 'Alice' } });
    validate(schema)(req, makeRes(), mockNext);
    expect(req.validated).toMatchObject({ body: { name: 'Alice' } });
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('calls next(zodError) on invalid input', () => {
    const req = makeReq({ body: { name: 'A' } }); // too short
    validate(schema)(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ errors: expect.any(Array) }));
  });

  it('calls next(error) when body is missing', () => {
    const req = makeReq({ body: {} });
    validate(schema)(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.anything());
  });

  it('handles query and params in schema', () => {
    const fullSchema = z.object({
      params: z.object({ id: z.string().uuid() }),
      body: z.object({})
    });
    const req = makeReq({ params: { id: 'not-a-uuid' } });
    validate(fullSchema)(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.anything());
  });
});

// ── errorHandler ──────────────────────────────────────────────────
describe('errorHandler middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns status code from ApiError', () => {
    const res = makeRes();
    const err = { statusCode: 404, message: 'Not Found' };
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Not Found' }));
  });

  it('defaults to 500 for errors without statusCode', () => {
    const res = makeRes();
    errorHandler(new Error('boom'), makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('includes stack trace when NODE_ENV is not production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const res = makeRes();
    const err = Object.assign(new Error('test error'), { statusCode: 500 });
    errorHandler(err, makeReq(), res, jest.fn());
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg).toHaveProperty('stack');
    process.env.NODE_ENV = origEnv;
  });
});
