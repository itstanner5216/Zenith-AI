import { db, UserUsageTable } from '@/drizzle/schema';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function resetTokenUsage() {
  const result = await db.update(UserUsageTable).set({
    tokenUsage: 0,
  });

  const affectedRows = (result as unknown as { count: number }).count || 0;

  return {
    success: true,
    message: 'Token usage reset successful',
    usersReset: affectedRows,
  };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const result = await resetTokenUsage();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error resetting token usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset token usage' },
      { status: 500 }
    );
  }
}
