import { handleAuthorizationV2, AuthorizationError, getToken } from './handleAuthorization';
import { NextRequest } from 'next/server';

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3010/api/chat', { headers });
}

describe('handleAuthorizationV2', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns default user when SOLO_API_KEY is not set', async () => {
    delete process.env.SOLO_API_KEY;
    const result = await handleAuthorizationV2(createRequest());
    expect(result).toEqual({ userId: 'user' });
  });

  it('returns default user when SOLO_API_KEY is empty', async () => {
    process.env.SOLO_API_KEY = '';
    const result = await handleAuthorizationV2(createRequest());
    expect(result).toEqual({ userId: 'user' });
  });

  it('returns user when valid SOLO_API_KEY matches', async () => {
    process.env.SOLO_API_KEY = 'test-key-123';
    const result = await handleAuthorizationV2(
      createRequest({ Authorization: 'Bearer test-key-123' })
    );
    expect(result).toEqual({ userId: 'user' });
  });

  it('throws 401 when no auth header provided', async () => {
    process.env.SOLO_API_KEY = 'test-key-123';
    await expect(handleAuthorizationV2(createRequest())).rejects.toThrow(AuthorizationError);
    await expect(handleAuthorizationV2(createRequest())).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when wrong key provided', async () => {
    process.env.SOLO_API_KEY = 'test-key-123';
    await expect(
      handleAuthorizationV2(createRequest({ Authorization: 'Bearer wrong-key' }))
    ).rejects.toThrow(AuthorizationError);
  });
});

describe('getToken', () => {
  it('extracts bearer token', () => {
    const req = createRequest({ Authorization: 'Bearer my-token' });
    expect(getToken(req)).toBe('my-token');
  });

  it('returns null for missing header', () => {
    expect(getToken(createRequest())).toBeNull();
  });

  it('returns null for empty bearer', () => {
    const req = createRequest({ Authorization: 'Bearer ' });
    expect(getToken(req)).toBeNull();
  });
});
