import { NextRequest } from 'next/server';
import { handleAuthorizationV2 } from './handleAuthorization';

// Mock @unkey/api - v2 uses Unkey class with keys.verifyKey method
// Create mock inside factory to avoid hoisting issues
jest.mock('@unkey/api', () => {
  const mockVerifyKey = jest.fn();
  // Store reference so we can access it in tests
  (global as any).__mockVerifyKey = mockVerifyKey;

  return {
    Unkey: jest.fn().mockImplementation(() => {
      // Always return a fresh instance that references the current mock
      return {
        keys: {
          verifyKey: (global as any).__mockVerifyKey,
        },
      };
    }),
  };
});

// Get reference to Unkey mock
const getMockVerifyKey = () => (global as any).__mockVerifyKey as jest.Mock;

// Mock Clerk - create mocks inside factory to avoid hoisting issues
jest.mock('@clerk/nextjs/server', () => {
  const mockAuthFn = jest.fn();
  const mockClerkClientFn = jest.fn();

  // Store references so we can access them in tests
  (global as any).__mockAuth = mockAuthFn;
  (global as any).__mockClerkClient = mockClerkClientFn;

  return {
    clerkClient: mockClerkClientFn,
    auth: mockAuthFn,
  };
});

// Mock database and other dependencies - create mocks inside factory to avoid hoisting issues
jest.mock('../drizzle/schema', () => {
  const mockCheckTokenUsage = jest
    .fn()
    .mockResolvedValue({ remaining: 1000, usageError: null });
  const mockDbSelect = jest.fn().mockReturnThis();
  const mockDbFrom = jest.fn().mockReturnThis();
  const mockDbWhere = jest.fn().mockReturnThis();
  const mockDbLimit = jest.fn();

  (global as any).__mockCheckTokenUsage = mockCheckTokenUsage;
  // Store references so we can access them in tests
  (global as any).__mockDbSelect = mockDbSelect;
  (global as any).__mockDbFrom = mockDbFrom;
  (global as any).__mockDbWhere = mockDbWhere;
  (global as any).__mockDbLimit = mockDbLimit;

  return {
    checkTokenUsage: mockCheckTokenUsage,
    createEmptyUserUsage: jest.fn().mockResolvedValue(undefined),
    UserUsageTable: {},
    db: {
      select: mockDbSelect,
      from: mockDbFrom,
      where: mockDbWhere,
      limit: mockDbLimit,
    },
    initializeTierConfig: jest.fn().mockResolvedValue(undefined),
    eq: jest.fn(),
  };
});

// Mock PostHog
jest.mock('./posthog', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    capture: jest.fn(),
  }),
}));

// Get references to mocks after they're created
const getMockAuth = () => (global as any).__mockAuth as jest.Mock;
const getMockClerkClient = () => (global as any).__mockClerkClient as jest.Mock;
const getMockCheckTokenUsage = () =>
  (global as any).__mockCheckTokenUsage as jest.Mock;
const getMockDbSelect = () => (global as any).__mockDbSelect as jest.Mock;
const getMockDbFrom = () => (global as any).__mockDbFrom as jest.Mock;
const getMockDbWhere = () => (global as any).__mockDbWhere as jest.Mock;
const getMockDbLimit = () => (global as any).__mockDbLimit as jest.Mock;

describe('handleAuthorization - Unkey API v2 Migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure Unkey mock has a default implementation that can be overridden
    // Each test will override this with its own response
    getMockVerifyKey().mockReset();
    getMockVerifyKey().mockResolvedValue({
      data: { valid: false },
      error: { code: 'NOT_FOUND', message: 'Default - should be overridden' },
    });

    process.env.ENABLE_USER_MANAGEMENT = 'true';
    process.env.UNKEY_ROOT_KEY = 'test-root-key'; // Required for Unkey instance creation
    // Clear UNKEY_API_ID so tests can control whether apiId is included
    delete process.env.UNKEY_API_ID;

    // Reset Clerk mocks
    const mockAuthFn = getMockAuth();
    const mockClerkClientFn = getMockClerkClient();

    mockAuthFn.mockReset();
    mockAuthFn.mockResolvedValue({ userId: null }); // Default to no Clerk auth
    mockClerkClientFn.mockReset();
    mockClerkClientFn.mockResolvedValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          emailAddresses: [{ emailAddress: 'test@example.com' }],
        }),
      },
    });
    getMockCheckTokenUsage().mockReset().mockResolvedValue({
      remaining: 1000,
      usageError: null,
    });

    // Reset database mocks - ensure chain works correctly
    // The chain is: db.select().from().where().limit()
    // Each method should return an object that has the next method
    getMockDbSelect().mockReset().mockReturnThis();
    getMockDbFrom().mockReset().mockReturnThis();
    getMockDbWhere().mockReset().mockReturnThis();
    getMockDbLimit().mockReset();
    getMockDbLimit().mockResolvedValue([]); // Default to no existing user
  });

  afterEach(() => {
    delete process.env.ENABLE_USER_MANAGEMENT;
    delete process.env.UNKEY_API_ID;
    delete process.env.UNKEY_ROOT_KEY;
  });

  describe('v2 Response Format (data wrapper)', () => {
    it('should handle verifyKey with v2 response format (data wrapper with meta)', async () => {
      const expectedUserId = 'test-user-id';

      // Reset ALL mocks for this test - exactly like test 2 which works
      getMockVerifyKey().mockReset();
      getMockDbLimit().mockReset();

      // Set up Unkey mock response - use mockResolvedValue (not Once) to replace the default
      getMockVerifyKey().mockResolvedValue({
        meta: {
          requestId: 'req_abc123',
        },
        data: {
          valid: true,
          keyId: 'key_123',
          identity: {
            id: 'id_123',
            externalId: expectedUserId,
          },
        },
        error: null,
      });

      // Mock database to return user with matching userId
      // Database is queried in ensureUserExists and potentially in validateTokenUsage
      const userRecord = {
        userId: expectedUserId,
        tokenUsage: 100,
        maxTokenUsage: 10000,
      };
      getMockDbLimit()
        .mockResolvedValueOnce([userRecord]) // For ensureUserExists
        .mockResolvedValueOnce([userRecord]); // For validateTokenUsage if needed

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-key-123', // Must be >= 10 chars to pass length check
        },
      });

      const result = await handleAuthorizationV2(req);

      // Verify Unkey mock was called
      expect(getMockVerifyKey()).toHaveBeenCalled();
      // When UNKEY_API_ID is not set, only key should be passed
      expect(getMockVerifyKey()).toHaveBeenCalledWith({ key: 'valid-key-123' });
      // Verify we didn't fall through to Clerk auth
      expect(getMockAuth()).not.toHaveBeenCalled();

      expect(result).toEqual({ userId: expectedUserId });
    });

    it('should handle verifyKey with v1 response format (backward compatibility)', async () => {
      const expectedUserId = 'test-user-id-v1';

      // Reset all mocks for this test to prevent leakage from previous test
      getMockVerifyKey().mockReset();
      getMockDbLimit().mockReset();

      // Simulate v1 format (direct result, no data wrapper, with ownerId)
      getMockVerifyKey().mockResolvedValue({
        result: {
          valid: true,
          ownerId: expectedUserId,
          keyId: 'key_456',
        },
        error: null,
      } as any);

      // Mock database to return user with matching userId
      // Database is queried in ensureUserExists and potentially in validateTokenUsage
      const userRecord = {
        userId: expectedUserId,
        tokenUsage: 100,
        maxTokenUsage: 10000,
      };
      getMockDbLimit()
        .mockResolvedValueOnce([userRecord]) // For ensureUserExists
        .mockResolvedValueOnce([userRecord]); // For validateTokenUsage if needed

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-key-v1',
        },
      });

      const result = await handleAuthorizationV2(req);

      expect(result).toEqual({ userId: expectedUserId });
      expect(getMockVerifyKey()).toHaveBeenCalledWith({ key: 'valid-key-v1' });
    });

    it('should handle invalid key with v2 error format', async () => {
      // Reset all mocks for this test to ensure clean state
      getMockVerifyKey().mockReset();
      getMockDbLimit().mockReset();
      getMockAuth().mockReset();

      getMockVerifyKey().mockResolvedValueOnce({
        meta: {
          requestId: 'req_invalid123',
        },
        data: {
          valid: false,
          code: 'NOT_FOUND',
        },
        error: {
          code: 'NOT_FOUND',
          message: 'Key not found',
        },
      });

      // Ensure Clerk auth also fails
      getMockAuth().mockResolvedValue({ userId: null });

      // Reset database mock to ensure no user is found (shouldn't matter since Unkey fails first)
      getMockDbLimit().mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid-key',
        },
      });

      await expect(handleAuthorizationV2(req)).rejects.toThrow('Unauthorized');
      // verifyKey may be called with apiId if UNKEY_API_ID is set, so just check it was called
      expect(getMockVerifyKey()).toHaveBeenCalled();
    });

    it('should return API-key scoped token limit messaging', async () => {
      const expectedUserId = 'token-limited-user';

      getMockVerifyKey().mockReset();
      getMockDbLimit().mockReset();
      getMockCheckTokenUsage().mockReset();

      getMockVerifyKey().mockResolvedValue({
        data: {
          valid: true,
          identity: {
            externalId: expectedUserId,
          },
        },
        error: null,
      });

      const userRecord = {
        userId: expectedUserId,
        tokenUsage: 10000,
        maxTokenUsage: 10000,
      };
      getMockDbLimit()
        .mockResolvedValueOnce([userRecord])
        .mockResolvedValueOnce([userRecord]);
      getMockCheckTokenUsage().mockResolvedValue({
        remaining: 0,
        usageError: false,
      });

      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          authorization: 'Bearer token-limit-key',
        },
      });

      await expect(handleAuthorizationV2(req)).rejects.toThrow(
        'Token limit exceeded for this API key.'
      );
    });
  });
});
