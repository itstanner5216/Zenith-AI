import { AuthorizationError, getToken } from '../lib/handleAuthorization';

describe('handleAuthorization', () => {
  describe('AuthorizationError', () => {
    it('should create an error with the correct name, message, and status', () => {
      const err = new AuthorizationError('Unauthorized', 401);
      expect(err.name).toBe('AuthorizationError');
      expect(err.message).toBe('Unauthorized');
      expect(err.status).toBe(401);
      expect(err instanceof Error).toBe(true);
    });
  });

  describe('getToken', () => {
    const makeRequest = (authHeader: string | null): import('next/server').NextRequest =>
      ({
        headers: {
          get: (key: string) => (key.toLowerCase() === 'authorization' ? authHeader : null),
        },
      } as unknown as import('next/server').NextRequest);

    it('should return null when no authorization header is present', () => {
      expect(getToken(makeRequest(null))).toBeNull();
    });

    it('should extract the Bearer token', () => {
      expect(getToken(makeRequest('Bearer my-secret-token'))).toBe('my-secret-token');
    });

    it('should handle case-insensitive Bearer prefix', () => {
      expect(getToken(makeRequest('bearer MY-TOKEN'))).toBe('MY-TOKEN');
    });

    it('should return null for a bare "Bearer" header with no token', () => {
      expect(getToken(makeRequest('Bearer'))).toBeNull();
    });

    it('should return null for empty string token', () => {
      expect(getToken(makeRequest('Bearer   '))).toBeNull();
    });

    it('should return non-Bearer tokens as-is', () => {
      expect(getToken(makeRequest('raw-api-key'))).toBe('raw-api-key');
    });
  });
});
