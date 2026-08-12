import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.AUTH_SECRET = 'test-authorization-secret-please-do-not-use-in-prod';

// Each test does a real dynamic import of a Next.js route module plus real
// jose JWT verification — cheap in isolation, but can exceed the 5s default
// under full-workspace parallel test load (many vitest processes competing
// for CPU). Nothing here is time-based logic, so there's no fake-timer fix;
// widening the timeout is the correct response to slow-but-real async work.
vi.setConfig({ testTimeout: 20000 });

/**
 * Every entity-touching route must reject a request with no (or an
 * invalid/foreign-secret) bearer token before it ever reaches the database
 * — this is the whole of "cross-account authorization" in a single-tenant
 * backend: there is no per-request data to leak if the handler never runs a
 * query. `prisma` is replaced with a Proxy that throws on first property
 * access, so any handler that accidentally queries before authenticating
 * fails the test immediately rather than silently returning empty data.
 */
function createThrowingPrisma(): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('prisma must not be accessed before authentication succeeds');
      },
    },
  );
}

vi.mock('@sinal/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sinal/db')>();
  return { ...actual, prisma: createThrowingPrisma() };
});

beforeEach(() => {
  vi.resetModules();
});

function unauthenticatedRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

function foreignTokenRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, authorization: 'Bearer not-a-real-session-token' },
  });
}

describe('GET /api/accounts/[id] rejects unauthorized access', () => {
  it('returns 401 and never queries the database with no Authorization header', async () => {
    const { GET } = await import('./accounts/[id]/route');
    const response = await GET(unauthenticatedRequest('http://localhost/api/accounts/acc-1'), {
      params: Promise.resolve({ id: 'acc-1' }),
    });
    expect(response.status).toBe(401);
  });

  it('returns 401 for a token that does not verify against AUTH_SECRET', async () => {
    const { GET } = await import('./accounts/[id]/route');
    const response = await GET(foreignTokenRequest('http://localhost/api/accounts/acc-1'), {
      params: Promise.resolve({ id: 'acc-1' }),
    });
    expect(response.status).toBe(401);
  });
});

describe('GET /api/accounts rejects unauthorized access', () => {
  it('returns 401 with no Authorization header', async () => {
    const { GET } = await import('./accounts/route');
    const response = await GET(unauthenticatedRequest('http://localhost/api/accounts'));
    expect(response.status).toBe(401);
  });
});

describe('POST /api/accounts/discover rejects unauthorized access', () => {
  it('returns 401 and never triggers discovery with no Authorization header', async () => {
    const { POST } = await import('./accounts/discover/route');
    const response = await POST(unauthenticatedRequest('http://localhost/api/accounts/discover', { method: 'POST' }));
    expect(response.status).toBe(401);
  });
});

describe('POST /api/approvals/[id]/decision rejects unauthorized access', () => {
  it('returns 401 and never decides the approval with no Authorization header', async () => {
    const { POST } = await import('./approvals/[id]/decision/route');
    const response = await POST(
      unauthenticatedRequest('http://localhost/api/approvals/approval-1/decision', {
        method: 'POST',
        body: JSON.stringify({ decision: 'APPROVE' }),
      }),
      { params: Promise.resolve({ id: 'approval-1' }) },
    );
    expect(response.status).toBe(401);
  });

  it('returns 401 for a foreign/invalid token, not a decision outcome', async () => {
    const { POST } = await import('./approvals/[id]/decision/route');
    const response = await POST(
      foreignTokenRequest('http://localhost/api/approvals/approval-1/decision', {
        method: 'POST',
        body: JSON.stringify({ decision: 'APPROVE' }),
      }),
      { params: Promise.resolve({ id: 'approval-1' }) },
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/campaigns rejects unauthorized access', () => {
  it('returns 401 and never creates a campaign with no Authorization header', async () => {
    const { POST } = await import('./campaigns/route');
    const response = await POST(unauthenticatedRequest('http://localhost/api/campaigns', { method: 'POST' }));
    expect(response.status).toBe(401);
  });
});

describe('POST /api/enrollments rejects unauthorized access', () => {
  it('returns 401 and never enrolls a contact with no Authorization header', async () => {
    const { POST } = await import('./enrollments/route');
    const response = await POST(unauthenticatedRequest('http://localhost/api/enrollments', { method: 'POST' }));
    expect(response.status).toBe(401);
  });
});

describe('/api/digests/daily rejects unauthorized access', () => {
  it('POST returns 401 and never generates a digest with no Authorization header', async () => {
    const { POST } = await import('./digests/daily/route');
    const response = await POST(unauthenticatedRequest('http://localhost/api/digests/daily', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('GET returns 401 and never reads a digest with no Authorization header', async () => {
    const { GET } = await import('./digests/daily/route');
    const response = await GET(unauthenticatedRequest('http://localhost/api/digests/daily'));
    expect(response.status).toBe(401);
  });
});
