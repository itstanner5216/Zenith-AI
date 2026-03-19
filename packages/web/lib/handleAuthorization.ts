import { NextRequest } from 'next/server';

export class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

export const getToken = (req: NextRequest): string | null => {
  const header =
    req.headers.get('authorization') || req.headers.get('Authorization');

  if (!header) {
    return null;
  }

  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (!token || token.toLowerCase() === 'bearer') {
    return null;
  }

  return token;
};

export async function handleAuthorizationV2(
  req: NextRequest
): Promise<{ userId: string }> {
  // No auth required if SOLO_API_KEY is not set
  if (!process.env.SOLO_API_KEY || process.env.SOLO_API_KEY.length === 0) {
    return { userId: 'user' };
  }

  const token = getToken(req);

  if (!token) {
    throw new AuthorizationError('No Authorization header', 401);
  }

  if (token !== process.env.SOLO_API_KEY) {
    throw new AuthorizationError('Unauthorized', 401);
  }

  return { userId: 'user' };
}
