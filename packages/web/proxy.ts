import { NextRequest, NextResponse } from 'next/server';

function isStaticFile(pathname: string): boolean {
  const staticPatterns = [
    /^\/apple-touch-icon/i,
    /^\/favicon\.ico$/i,
    /^\/robots\.txt$/i,
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|txt)$/i,
  ];
  return staticPatterns.some((pattern) => pattern.test(pathname));
}

export default function proxy(
  req: NextRequest
): NextResponse {
  // Skip static files
  if (
    isStaticFile(req.nextUrl.pathname) &&
    req.nextUrl.pathname !== '/config.js'
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // CORS is intentionally open ('*') for self-hosted deployments where the
  // Obsidian plugin connects to a server the user controls. Restrict via the
  // ALLOWED_ORIGINS env var in multi-tenant or public-facing deployments.
  const allowedOrigin = process.env.ALLOWED_ORIGINS ?? '*';
  res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  res.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // SOLO_API_KEY auth for API routes
  const soloKey = process.env.SOLO_API_KEY;
  if (soloKey && soloKey.length > 0) {
    const isApiRoute = req.nextUrl.pathname.startsWith('/api');
    if (isApiRoute) {
      const header = req.headers.get('authorization');
      if (!header) {
        return new NextResponse('No Authorization header', { status: 401 });
      }
      const token = header.replace(/^Bearer\s+/i, '').trim();
      if (token !== soloKey) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|apple-touch-icon.*|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|json|txt)$).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
