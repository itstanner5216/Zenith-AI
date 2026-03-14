import { NextRequest, NextResponse } from 'next/server';
import { db, UserUsageTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getToken } from '@/lib/handleAuthorization';
import { Unkey } from '@unkey/api';

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    // Verify the key without checking for subscription status
    // Unkey v2: Use Unkey instance for verification
    const unkey = new Unkey({
      rootKey: process.env.UNKEY_ROOT_KEY || '',
    });

    // Try verifyKey method (v2 API) - takes object with 'key' property
    // Include apiId if available (keys are scoped to an API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any = null;
    const apiId = process.env.UNKEY_API_ID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyParams: any = { key: token };
    if (apiId) {
      verifyParams.apiId = apiId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((unkey as any).keys?.verifyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).keys.verifyKey(verifyParams);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((unkey as any).verifyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).verifyKey(verifyParams);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((unkey as any).keys?.verify) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).keys.verify(verifyParams);
    }

    // Handle v2 response format (wrapped in data)
    // Note: Keeping backward compatibility check for response.result in case of edge cases
    const result =
      response && ('data' in response ? response.data : response.result);

    if (!result || !result.valid) {
      return NextResponse.json(
        {
          error: 'Invalid key',
          message: 'Please provide a valid API key',
        },
        { status: 401 }
      );
    }

    // Extract userId from v2 format (identity.externalId or identity.id)
    // Note: ownerId fallback kept for backward compatibility with older keys
    const userId =
      result?.identity?.externalId || result?.identity?.id || result?.ownerId;
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Invalid key',
          message: 'No user ID found in verification result',
        },
        { status: 401 }
      );
    }

    // Get basic usage information without checking subscription status
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    if (!userUsage.length) {
      // Return default values for new users
      return NextResponse.json({
        tokenUsage: 0,
        maxTokenUsage: 100000, // Default token budget
        isActive: true,
      });
    }

    return NextResponse.json({
      tokenUsage: userUsage[0].tokenUsage || 0,
      maxTokenUsage: userUsage[0].maxTokenUsage || 100000,
      isActive: true,
    });
  } catch (error) {
    console.error('Error fetching public usage data:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch usage data',
      },
      { status: 500 }
    );
  }
}
