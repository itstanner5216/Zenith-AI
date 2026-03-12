/**
 * @jest-environment node
 */

// Mock modules before any imports that use them
jest.mock('@/drizzle/schema', () => {
  const mockDb = {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  };
  return {
    db: mockDb,
    UserUsageTable: {
      userId: 'userId',
      subscriptionStatus: 'subscriptionStatus',
      tokenUsage: 'tokenUsage',
      maxTokenUsage: 'maxTokenUsage',
      audioTranscriptionMinutes: 'audioTranscriptionMinutes',
      paymentStatus: 'paymentStatus',
      billingCycle: 'billingCycle',
      tier: 'tier',
    },
  };
});

jest.mock('@/srm.config', () => ({
  PRODUCTS: {
    SubscriptionMonthly: {
      metadata: { plan: 'monthly' },
    },
  },
}));

import { db } from '@/drizzle/schema';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('Token Reset Cron Job', () => {
  const monthlyTokenLimit = 5000 * 1000; // 5M tokens

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';

    // Default: db.update chains resolve successfully
    const mockWhere = jest.fn().mockResolvedValue({ count: 1 });
    const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
    (db.update as jest.Mock).mockReturnValue({ set: mockSet });
  });

  it('should reset token usage for active subscribers', async () => {
    const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: 'Token and audio transcription usage reset successful',
      usersReset: 1,
      freeTierUsersReset: 1,
    });

    // Verify db.update was called twice (once for subscribers, once for free tier)
    expect(db.update as jest.Mock).toHaveBeenCalledTimes(2);
  });

  it('should return 401 for unauthorized requests', async () => {
    const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
      method: 'GET',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should handle database errors gracefully', async () => {
    const mockWhere = jest.fn().mockRejectedValue(new Error('Database error'));
    const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
    (db.update as jest.Mock).mockReturnValue({ set: mockSet });

    const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: 'Failed to reset token usage',
    });
  });
});

