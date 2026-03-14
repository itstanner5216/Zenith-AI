/**
 * @jest-environment node
 */

jest.mock('@/drizzle/schema', () => {
  const mockDb = {
    update: jest.fn(),
  };

  return {
    db: mockDb,
    UserUsageTable: {
      tokenUsage: 'tokenUsage',
    },
  };
});

import { db } from '@/drizzle/schema';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('Token Reset Cron Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';

    (db.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockResolvedValue({ count: 1 }),
    });
  });

  it('should reset token usage for all users', async () => {
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
      message: 'Token usage reset successful',
      usersReset: 1,
    });

    expect(db.update as jest.Mock).toHaveBeenCalledTimes(1);
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
    (db.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockRejectedValue(new Error('Database error')),
    });

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
