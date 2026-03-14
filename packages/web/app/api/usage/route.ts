import { NextRequest, NextResponse } from 'next/server';
import { db, UserUsageTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  handleAuthorizationV2,
  AuthorizationError,
} from '@/lib/handleAuthorization';

export async function GET(request: NextRequest) {
  try {
    // This will throw an error if not authorized
    const { userId } = await handleAuthorizationV2(request);

    // Calculate next reset date (1st of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextReset = nextMonth.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });

    // Get usage information
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    if (!userUsage.length) {
      return NextResponse.json({
        tokenUsage: 0,
        maxTokenUsage: 100000, // Default token budget
        nextReset,
        isActive: true,
      });
    }

    return NextResponse.json({
      tokenUsage: userUsage[0].tokenUsage || 0,
      maxTokenUsage: userUsage[0].maxTokenUsage || 100000,
      nextReset,
      isActive: true,
    });
  } catch (error: unknown) {
    // Handle AuthorizationError with proper status code
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || 'Authorization failed' },
        { status: error.status || 403 }
      );
    }

    // Check for AuthorizationError by name (for cases where instanceof doesn't work)
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AuthorizationError' &&
      'status' in error &&
      'message' in error
    ) {
      return NextResponse.json(
        { error: (error.message as string) || 'Authorization failed' },
        { status: (error.status as number) || 403 }
      );
    }

    // Handle token limit errors specially
    if (
      error instanceof Error &&
      error.message.includes('Token limit exceeded')
    ) {
      return NextResponse.json(
        {
          error: 'Token limit exceeded for this API key.',
        },
        { status: 429 }
      );
    }

    console.error('Error fetching usage data:', error);
    const errorStatus =
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number'
        ? error.status
        : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch usage data',
      },
      { status: errorStatus }
    );
  }
}
