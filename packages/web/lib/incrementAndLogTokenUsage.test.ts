import { incrementAndLogTokenUsage } from './incrementAndLogTokenUsage';
import { checkTokenUsage, incrementTokenUsage } from '../drizzle/schema';

// Mock dependencies
jest.mock('../drizzle/schema', () => ({
  checkTokenUsage: jest.fn(),
  incrementTokenUsage: jest.fn(),
}));

// Create a shared mock capture function and client instance
const mockPostHogCapture = jest.fn();
const mockPostHogClient = { capture: mockPostHogCapture };

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  default: jest.fn(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      return mockPostHogClient;
    }
    return null;
  }),
}));

describe('incrementAndLogTokenUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostHogCapture.mockClear();
    process.env.ENABLE_USER_MANAGEMENT = 'true';
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-posthog-key';
  });

  afterEach(() => {
    delete process.env.ENABLE_USER_MANAGEMENT;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  describe('Happy Path', () => {
    it('should increment token usage and log to PostHog', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 850,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 150);

      expect(result).toEqual({
        remaining: 850,
        usageError: false,
        needsUpgrade: false,
      });
      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 150);

      // PostHog capture should be called if client exists
      // The mock might not work if PostHogClient is called before the mock is set up
      // Check if capture was called (it should be if NEXT_PUBLIC_POSTHOG_KEY is set)
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        expect(mockPostHogCapture).toHaveBeenCalledWith({
          distinctId: 'test-user-id',
          event: 'token_usage',
          properties: {
            remaining: 850,
            tokens: 150,
          },
        });
      }
    });

    it('should validate and floor token values', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 900,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 100.7);

      expect(result.remaining).toBe(900);
      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 100);
    });
  });

  describe('ENABLE_USER_MANAGEMENT bypass', () => {
    it('should return early when ENABLE_USER_MANAGEMENT is false', async () => {
      process.env.ENABLE_USER_MANAGEMENT = 'false';

      const result = await incrementAndLogTokenUsage('test-user-id', 150);

      expect(result).toEqual({
        remaining: 0,
        usageError: false,
      });
      expect(checkTokenUsage).not.toHaveBeenCalled();
      expect(incrementTokenUsage).not.toHaveBeenCalled();
    });

    it('should return early when ENABLE_USER_MANAGEMENT is not set', async () => {
      delete process.env.ENABLE_USER_MANAGEMENT;

      const result = await incrementAndLogTokenUsage('test-user-id', 150);

      expect(result).toEqual({
        remaining: 0,
        usageError: false,
      });
      expect(checkTokenUsage).not.toHaveBeenCalled();
    });
  });

  describe('Quota Checks', () => {
    it('should return error when checkTokenUsage fails', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 0,
        usageError: true,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 150);

      expect(result).toEqual({
        remaining: 0,
        usageError: true,
      });
      expect(incrementTokenUsage).not.toHaveBeenCalled();
    });

    it('should return early when no tokens remaining', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 0,
        usageError: false,
      });
      const result = await incrementAndLogTokenUsage('test-user-id', 150);

      expect(result).toEqual({
        remaining: 0,
        usageError: false,
        needsUpgrade: true,
      });
      expect(incrementTokenUsage).not.toHaveBeenCalled();
    });

    it('should return early when remaining is negative', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: -10,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 150);

      expect(result).toEqual({
        remaining: 0,
        usageError: false,
        needsUpgrade: true,
      });
      expect(incrementTokenUsage).not.toHaveBeenCalled();
    });
  });

  describe('Token Validation', () => {
    it('should handle NaN tokens', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', NaN);

      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 0);
      expect(result.remaining).toBe(1000);
    });

    it('should handle negative tokens', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', -50);

      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 0);
      expect(result.remaining).toBe(1000);
    });

    it('should floor decimal tokens', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 900,
        usageError: false,
      });

      await incrementAndLogTokenUsage('test-user-id', 99.9);

      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 99);
    });
  });

  describe('PostHog Logging', () => {
    it('should not log to PostHog when PostHog client is null', async () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 850,
        usageError: false,
      });

      await incrementAndLogTokenUsage('test-user-id', 150);

      expect(mockPostHogCapture).not.toHaveBeenCalled();
    });

    it('should not log to PostHog when usageError is true', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 850,
        usageError: true,
      });

      await incrementAndLogTokenUsage('test-user-id', 150);

      expect(mockPostHogCapture).not.toHaveBeenCalled();
    });

    it('should log with correct properties', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 750,
        usageError: false,
      });

      await incrementAndLogTokenUsage('test-user-id', 250);

      expect(mockPostHogCapture).toHaveBeenCalledWith({
        distinctId: 'test-user-id',
        event: 'token_usage',
        properties: {
          remaining: 750,
          tokens: 250,
        },
      });
    });
  });

  describe('Quota Exhaustion Detection', () => {
    it('should set needsUpgrade to true when remaining is 0', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 0,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 1000);

      expect(result.needsUpgrade).toBe(true);
    });

    it('should set needsUpgrade to false when remaining is positive', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 500,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 500);

      expect(result.needsUpgrade).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero tokens', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 0);

      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 0);
      expect(result.remaining).toBe(1000);
    });

    it('should handle very large token values', async () => {
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 500000,
        usageError: false,
      });

      const result = await incrementAndLogTokenUsage('test-user-id', 500000);

      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 500000);
      expect(result.remaining).toBe(500000);
    });

    it('should handle string tokens (should be converted by caller)', async () => {
      // Note: TypeScript should prevent this, but runtime might allow it
      (checkTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });
      (incrementTokenUsage as jest.Mock).mockResolvedValueOnce({
        remaining: 1000,
        usageError: false,
      });

      // Testing edge case - string tokens
      const result = await incrementAndLogTokenUsage('test-user-id', '150' as any);

      // Math.floor('150') converts to 150, not 0
      expect(incrementTokenUsage).toHaveBeenCalledWith('test-user-id', 150);
    });
  });
});
