import { getToken, handleAuthorizationV2, AuthorizationError } from '../handleAuthorization';
import type { NextRequest } from 'next/server';

const makeRequest = (headers: Record<string, string>): NextRequest =>
  ({ headers: new Headers(headers) } as unknown as NextRequest);

describe('getToken', () => {
  it('returns a bearer token when provided', () => {
    const req = makeRequest({ Authorization: 'Bearer abc123' });
    expect(getToken(req)).toBe('abc123');
  });

  it('returns null when the header is missing or empty', () => {
    const emptyHeader = makeRequest({ Authorization: 'Bearer ' });
    const missingHeader = makeRequest({});

    expect(getToken(emptyHeader)).toBeNull();
    expect(getToken(missingHeader)).toBeNull();
  });
});

describe('handleAuthorizationV2', () => {
  const originalSoloKey = process.env.SOLO_API_KEY;

  afterEach(() => {
    process.env.SOLO_API_KEY = originalSoloKey;
  });

  it('allows requests when SOLO_API_KEY is not set', async () => {
    delete process.env.SOLO_API_KEY;
    const req = makeRequest({});
    await expect(handleAuthorizationV2(req)).resolves.toEqual({ userId: 'user' });
  });

  it('throws when the authorization header is missing', async () => {
    process.env.SOLO_API_KEY = 'secret-key';
    const req = makeRequest({});
    await expect(handleAuthorizationV2(req)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('throws when the token does not match', async () => {
    process.env.SOLO_API_KEY = 'secret-key';
    const req = makeRequest({ Authorization: 'Bearer wrong' });
    await expect(handleAuthorizationV2(req)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('returns the user when the token matches', async () => {
    process.env.SOLO_API_KEY = 'secret-key';
    const req = makeRequest({ Authorization: 'Bearer secret-key' });
    await expect(handleAuthorizationV2(req)).resolves.toEqual({ userId: 'user' });
  });
});
