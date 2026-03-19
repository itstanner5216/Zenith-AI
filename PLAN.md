# Plan B — Auth, Shell & Infrastructure Cleanup

> **Worktree:** `/home/tanner/Projects/Zenith-AI/.worktrees/backend-infra-cleanup`
> **Branch:** `backend/infra-auth-cleanup`
> **Executor:** Claude Code (TUI/CLI)
> **Base commit:** `2032a142`

**Goal:** Remove entire Clerk/Unkey/PostHog/Vercel/Loops infrastructure, rewrite auth to SOLO_API_KEY only, simplify middleware, clean app shell, clean DB schema, remove 8 package dependencies, and clean all env/config files. Zero remnants.

**CRITICAL RULE:** "Remove" = fully and completely remove. Zero remnants. Every import, call, reference, type, test mock, env var, package dep.

**CRITICAL: FILE OWNERSHIP** — This plan ONLY touches the files listed below. Do NOT modify any file not on this list. The other agent (Plan A) owns all route handler files under `app/api/(newai)/`, `app/api/(sync)/files/`, `app/api/(sync)/file-status/`, `app/api/files/`, `app/api/process-*`, plus `lib/prompts/`, `lib/incrementAndLogTokenUsage*`, and `packages/plugin/`. Modifying those files will cause merge conflicts.

**Build command:** `cd /home/tanner/Projects/Zenith-AI/.worktrees/backend-infra-cleanup/packages/web && pnpm ts:check`
**Test command:** `cd /home/tanner/Projects/Zenith-AI/.worktrees/backend-infra-cleanup/packages/web && pnpm test`

---

## Files Owned By This Plan (EXCLUSIVE — no other agent touches these)

### Rewritten (6 files — replacing entire content):
1. `packages/web/lib/handleAuthorization.ts`
2. `packages/web/lib/handleAuthorization.test.ts`
3. `packages/web/middleware.ts`
4. `packages/web/app/layout.tsx`
5. `packages/web/app/page.tsx`
6. `packages/web/lib/posthog.ts` → STUB (no-op export for build compat, see note below)

### Modified (8 files):
7. `packages/web/next.config.js`
8. `packages/web/app/dashboard/page.tsx`
9. `packages/web/app/dashboard/self-hosted/page.tsx`
10. `packages/web/app/dashboard/sync/actions.ts`
11. `packages/web/app/api/(sync)/upload/route.ts`
12. `packages/web/drizzle/schema.ts`
13. `packages/web/package.json`
14. `packages/web/.env.example`

### Deleted (16 files/dirs):
15. `packages/web/app/providers.tsx`
16. `packages/web/app/posthog-page-view.tsx`
17. `packages/web/__mocks__/@/lib/posthog.ts`
18. `packages/web/app/sign-in/` (entire directory)
19. `packages/web/app/api/sign-in/` (entire directory)
20. `packages/web/app/api/sign-up/` (entire directory)
21. `packages/web/app/actions.ts`
22. `packages/web/app/actions.test.ts`
23. `packages/web/components/auth-layout-wrapper.tsx`
24. `packages/web/app/api/anon.ts`
25. `packages/web/__mocks__/@unkey/` (entire directory)
26. `packages/web/app/api/usage/` (entire directory)
27. `packages/web/app/api/public-usage/` (entire directory)
28. `packages/web/app/api/cron/` (entire directory)
29. `packages/web/app/api/create-upload-url/` (entire directory)
30. `packages/web/app/api/record-upload/` (entire directory)

---

## ⚠️ Build Compatibility Note — posthog.ts Stub

**Problem:** `lib/incrementAndLogTokenUsage.ts` imports from `lib/posthog.ts`. The other agent (Plan A) deletes `incrementAndLogTokenUsage.ts` and removes its imports from routes. But in THIS worktree, `incrementAndLogTokenUsage.ts` still exists and still imports `posthog.ts`. If we delete `posthog.ts`, this worktree won't build.

**Solution:** Replace `posthog.ts` with a no-op stub instead of deleting it. After merge with Plan A (which deletes `incrementAndLogTokenUsage.ts`), the stub has zero consumers and gets cleaned up in verification.

---

## Task 1: Stub posthog.ts + Delete PostHog UI Files

### 1a: Stub lib/posthog.ts

**File:** `packages/web/lib/posthog.ts`

Replace entire file with:
```typescript
// Stub — PostHog removed. Will be deleted after merge cleanup.
export default function PostHogClient(): null {
  return null;
}
```

### 1b: Delete PostHog mock

```bash
rm -f packages/web/__mocks__/@/lib/posthog.ts
```

### 1c: Delete PostHog UI files

```bash
rm packages/web/app/providers.tsx
rm packages/web/app/posthog-page-view.tsx
```

These files import from `posthog-js` (npm package). They are imported by `layout.tsx` which we rewrite in Task 5 (removing those imports).

### 1d: Clean next.config.js

**File:** `packages/web/next.config.js`

Remove the `rewrites()` function (lines 12-23) and `skipTrailingSlashRedirect: true` (line 25).

**New content:**
```javascript
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['postgres'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  }
};

module.exports = nextConfig;
```

---

## Task 2: Rewrite handleAuthorization.ts — SOLO_API_KEY Only

**File:** `packages/web/lib/handleAuthorization.ts`

**Current state:** 566 lines with Clerk, Unkey, PostHog, token validation, tier config, user management.

**Replace entire file with (~45 lines):**

```typescript
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
```

**This removes:**
- Clerk imports (`@clerk/nextjs/server`)
- Unkey imports (`@unkey/api`)
- PostHog import (`./posthog`)
- Drizzle schema imports (token functions)
- `handleLoggingV2()` function
- `handleApiKeyAuth()` function (Unkey verification)
- `handleClerkAuth()` function
- `validateTokenUsage()` function
- `ensureUserExists()` function
- `ensureTierConfigExists()` function
- All logging infrastructure

**Signature preserved:** `handleAuthorizationV2(req: NextRequest): Promise<{ userId: string }>` — the other agent's route files call this and will work after merge.

---

## Task 3: Rewrite handleAuthorization.test.ts

**File:** `packages/web/lib/handleAuthorization.test.ts`

Replace entire file with tests for simplified auth:

```typescript
import { handleAuthorizationV2, AuthorizationError, getToken } from './handleAuthorization';
import { NextRequest } from 'next/server';

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3010/api/chat', { headers });
}

describe('handleAuthorizationV2', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns default user when SOLO_API_KEY is not set', async () => {
    delete process.env.SOLO_API_KEY;
    const result = await handleAuthorizationV2(createRequest());
    expect(result).toEqual({ userId: 'user' });
  });

  it('returns default user when SOLO_API_KEY is empty', async () => {
    process.env.SOLO_API_KEY = '';
    const result = await handleAuthorizationV2(createRequest());
    expect(result).toEqual({ userId: 'user' });
  });

  it('returns user when valid SOLO_API_KEY matches', async () => {
    process.env.SOLO_API_KEY = 'test-key-123';
    const result = await handleAuthorizationV2(
      createRequest({ Authorization: 'Bearer test-key-123' })
    );
    expect(result).toEqual({ userId: 'user' });
  });

  it('throws 401 when no auth header provided', async () => {
    process.env.SOLO_API_KEY = 'test-key-123';
    await expect(handleAuthorizationV2(createRequest())).rejects.toThrow(AuthorizationError);
    await expect(handleAuthorizationV2(createRequest())).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when wrong key provided', async () => {
    process.env.SOLO_API_KEY = 'test-key-123';
    await expect(
      handleAuthorizationV2(createRequest({ Authorization: 'Bearer wrong-key' }))
    ).rejects.toThrow(AuthorizationError);
  });
});

describe('getToken', () => {
  it('extracts bearer token', () => {
    const req = createRequest({ Authorization: 'Bearer my-token' });
    expect(getToken(req)).toBe('my-token');
  });

  it('returns null for missing header', () => {
    expect(getToken(createRequest())).toBeNull();
  });

  it('returns null for empty bearer', () => {
    const req = createRequest({ Authorization: 'Bearer ' });
    expect(getToken(req)).toBeNull();
  });
});
```

**Verify:** `pnpm test -- --testPathPattern="handleAuthorization"` → PASS

---

## Task 4: Rewrite middleware.ts

**File:** `packages/web/middleware.ts`

**Current state:** 210 lines with conditional Clerk middleware, route matchers, complex auth flow.

**Replace entire file with (~55 lines):**

```typescript
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

export default async function middleware(
  req: NextRequest
): Promise<NextResponse> {
  // Skip static files
  if (
    isStaticFile(req.nextUrl.pathname) &&
    req.nextUrl.pathname !== '/config.js'
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // CORS headers
  res.headers.set('Access-Control-Allow-Origin', '*');
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
```

**This removes:**
- `@clerk/nextjs/server` import
- `clerkMiddleware`, `createRouteMatcher`
- Conditional Clerk/non-Clerk middleware export
- Route matchers (isPublicRoute, isClerkProtectedRoute)
- `ENABLE_USER_MANAGEMENT` checks
- `/sign-in(.*)` route handling

---

## Task 5: Delete Clerk/Unkey Files & Routes

Delete ALL of these:

```bash
# Clerk sign-in page
rm -rf packages/web/app/sign-in/

# Clerk API routes
rm -rf packages/web/app/api/sign-in/
rm -rf packages/web/app/api/sign-up/

# Unkey server actions
rm -f packages/web/app/actions.ts
rm -f packages/web/app/actions.test.ts

# Clerk UI wrapper
rm -f packages/web/components/auth-layout-wrapper.tsx

# Clerk anon utility
rm -f packages/web/app/api/anon.ts

# Unkey mock
rm -rf packages/web/__mocks__/@unkey/
```

**Verify:** `find packages/web -path "*/sign-in*" -o -path "*/sign-up*" -o -name "auth-layout-wrapper*" -o -name "anon.ts" | grep -v node_modules` → 0

---

## Task 6: Delete Token & Cron Routes

```bash
# Token usage routes
rm -rf packages/web/app/api/usage/
rm -rf packages/web/app/api/public-usage/

# Cron routes (reset-tokens + redeploy)
rm -rf packages/web/app/api/cron/
```

---

## Task 7: Delete R2 Routes

```bash
# R2 presigned URL generation
rm -rf packages/web/app/api/create-upload-url/

# R2 upload recording
rm -rf packages/web/app/api/record-upload/
```

---

## Task 8: Rewrite App Shell

### 8a: Rewrite layout.tsx

**File:** `packages/web/app/layout.tsx`

**Current:** Imports ClerkProvider, PHProvider, AuthLayoutWrapper. Conditionally wraps with Clerk.

**Replace with:**
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zenith-AI - Dashboard',
  description: 'Manage your account',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className="light">{children}</body>
    </html>
  );
}
```

### 8b: Rewrite page.tsx

**File:** `packages/web/app/page.tsx`

**Current:** Imports Clerk `auth()`, checks `ENABLE_USER_MANAGEMENT`, redirects to sign-in.

**Replace with:**
```tsx
import { redirect } from 'next/navigation';

export default async function MainPage() {
  redirect('/dashboard/self-hosted');
}
```

### 8c: Clean dashboard/page.tsx

**File:** `packages/web/app/dashboard/page.tsx`

Remove the "API Usage" card (tokenUsage, maxTokenUsage, usage %, fetch to `/api/usage`). Remove Clerk imports if any. Keep "Recent Synced Files" section if it exists.

If the entire page is just the usage card, replace with a redirect to `/dashboard/self-hosted`.

### 8d: Clean dashboard/self-hosted/page.tsx

**File:** `packages/web/app/dashboard/self-hosted/page.tsx`

Remove any reference to `VERCEL_PROJECT_PRODUCTION_URL`. Remove paid wording if any.

---

## Task 9: Clean Sync Upload Route

**File:** `packages/web/app/api/(sync)/upload/route.ts`

1. Remove `import { handleUpload, put } from '@vercel/blob';` (or similar Vercel Blob imports)
2. Remove `import { auth } from '@clerk/nextjs/server';`
3. Add `import { handleAuthorizationV2 } from '@/lib/handleAuthorization';`
4. Replace Clerk auth with: `const { userId } = await handleAuthorizationV2(request);`
5. Replace Vercel Blob upload with local file storage:
   ```typescript
   import { writeFile, mkdir } from 'fs/promises';
   import path from 'path';
   
   const uploadDir = process.env.UPLOAD_DIR || './uploads';
   await mkdir(uploadDir, { recursive: true });
   // Write file to uploadDir
   ```

---

## Task 10: Clean dashboard/sync/actions.ts

**File:** `packages/web/app/dashboard/sync/actions.ts`

1. Remove `import { auth } from '@clerk/nextjs/server';` (line 3)
2. Remove `import { put } from '@vercel/blob';` (line 6)
3. **Delete `uploadFile()` function entirely** — it's dead code (never imported by any UI)
4. For `deleteFile()`: remove Clerk `auth()` call. Since this is a server action (runs server-side), it can't easily use `handleAuthorizationV2` (no request object). Either:
   - Simplify to always allow (self-hosted, single user)
   - Or remove the function if unused
5. For `getFiles()` and `getFileStatus()`: remove Clerk userId parameter fallback, use `'user'` as default userId

---

## Task 11: Clean drizzle/schema.ts

**File:** `packages/web/drizzle/schema.ts`

Remove these items (work bottom-up):

| # | Item | Lines | Action |
|---|------|-------|--------|
| 1 | `checkTokenUsage` function | 208-245 | REMOVE |
| 2 | `incrementTokenUsage` function | 145-206 | REMOVE |
| 3 | `initializeTierConfig` function | 120-143 | REMOVE |
| 4 | `createEmptyUserUsage` function | 105-117 | REMOVE |
| 5 | `DEFAULT_API_KEY_TOKENS` constant | 31 | REMOVE |
| 6 | `hasClaimedChristmasTokens` function | 69-84 | REMOVE |
| 7 | `ChristmasClaim` type | 66 | REMOVE |
| 8 | `christmasClaims` table | 52-64 | REMOVE |
| 9 | `TierConfig` / `NewTierConfig` types | 27-28 | REMOVE |
| 10 | `TierConfigTable` table | 18-25 | REMOVE |

**Also check `vercelTokens` table** (lines 86-100): `grep -rn "vercelTokens\|VercelToken" packages/web/ --include="*.ts" | grep -v node_modules | grep -v schema.ts` — if 0 references, remove it and its type exports too.

**KEEP:**
- `db` and `drizzle` setup (lines 1-15)
- `UserUsageTable` (lines 34-49) — DB table still exists, keep for migration compat
- `uploadedFiles` table (lines 248+) — active file management

**Clean up unused imports** after removals — `eq`, `sql` from drizzle-orm may no longer be needed. Check.

---

## Task 12: Remove Package Dependencies

**File:** `packages/web/package.json`

Remove these 8 dependencies:

```
"@aws-sdk/client-s3": "^3.787.0",
"@aws-sdk/s3-request-presigner": "^3.787.0",
"@clerk/nextjs": "^6.23.3",
"@unkey/api": "^2.2.1",
"@vercel/blob": "^0.27.2",
"@vercel/sdk": "^1.1.0",
"posthog-js": "^1.203.2",
"posthog-node": "^4.3.1",
```

**After editing, run:** `cd /home/tanner/Projects/Zenith-AI/.worktrees/backend-infra-cleanup && pnpm install`

---

## Task 13: Clean .env.example

**File:** `packages/web/.env.example`

Replace with:
```
### The fastest way to get started is just to add your OpenAI API key to the .env file.
OPENAI_API_KEY="sk-xxxx"
OPENAI_API_BASE=""  # The base URL for OpenAI API
# OPENAI_WHISPER_BASE_URL=  # Optional; Whisper/transcription endpoint (defaults to OPENAI_API_BASE)
GROQ_API_KEY="gsk-xxxx"
GROQ_API_BASE=""  # The base URL for Groq API
ANTHROPIC_API_KEY="sk-xxxx"
ANTHROPIC_API_BASE=""  # The base URL for Anthropic API
GOOGLE_API_KEY="sk-xxxx"
GOOGLE_API_BASE=""  # The base URL for Google API
DEEPSEEK_API_KEY="sk-xxxx"
DEEPSEEK_API_BASE=""  # The base URL for DeepSeek API
MISTRAL_API_KEY="sk-xxxx"  # The API key for Mistral AI OCR

# Model configuration
MODEL_PROVIDER="openai"        # Provider: openai, google, anthropic, groq, mistral, deepseek
MODEL_NAME="gpt-4o-mini"       # Primary text model name
VISION_MODEL_NAME=""            # Vision model for OCR/image processing (defaults to MODEL_NAME)

# Self-hosted auth (optional — leave empty for no auth)
SOLO_API_KEY=""

# Database
POSTGRES_URL=""

# File uploads
UPLOAD_DIR="./uploads"
```

**Removed:** `LOOPS_API_KEY` (was the only extra env var beyond model configs)

---

## Task 14: Build, Test & Commit

1. **Install deps:** `pnpm install` (after package.json changes)
2. **Type check:** `cd packages/web && pnpm ts:check`
3. **Run tests:** `cd packages/web && pnpm test`
4. **Zero-remnant audit:**
   ```bash
   cd packages/web
   
   # Clerk
   grep -rn "@clerk\|clerkMiddleware\|ClerkProvider\|CLERK_SECRET\|ENABLE_USER_MANAGEMENT\|handleClerkAuth\|sign-in\|sign-up" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules
   
   # Unkey
   grep -rn "@unkey\|UNKEY_ROOT_KEY\|UNKEY_API_ID\|createLicenseKey\|verifyKey" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   
   # PostHog (stub is OK — will say "PostHog removed")
   grep -rn "posthog-js\|posthog-node\|PHProvider\|posthog-page-view\|PostHogClient\(\)" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules | grep -v "posthog.ts"
   
   # Vercel SDK/Blob
   grep -rn "@vercel/sdk\|@vercel/blob\|VERCEL_PROJECT_PRODUCTION_URL" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules
   
   # R2/S3
   grep -rn "R2_BUCKET\|R2_ENDPOINT\|R2_ACCESS\|@aws-sdk" --include="*.ts" --include="*.tsx" --include="*.js" . | grep -v node_modules
   
   # Token tracking (schema.ts UserUsageTable is OK — kept for migration compat)
   grep -rn "validateTokenUsage\|checkTokenUsage\|incrementTokenUsage\|initializeTierConfig\|ensureUserExists\|ensureTierConfig\|DEFAULT_API_KEY_TOKENS" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   
   # Christmas
   grep -rn "christmasClaims\|hasClaimedChristmasTokens\|ChristmasClaim" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   
   # Loops
   grep -rn "LOOPS_API_KEY\|loops.so" --include="*.ts" --include="*.tsx" --include="*.env*" . | grep -v node_modules
   
   # CRON_SECRET
   grep -rn "CRON_SECRET" --include="*.ts" --include="*.tsx" . | grep -v node_modules
   ```
   Expected: ALL return 0 matches

5. **Commit:**
   ```bash
   git add -A
   git commit -m "chore(web): remove Clerk/Unkey/PostHog/R2/Vercel infrastructure, simplify auth

   - Rewrite handleAuthorization.ts to SOLO_API_KEY only (566→45 lines)
   - Rewrite middleware.ts to CORS + SOLO_API_KEY only (210→55 lines)
   - Delete all Clerk pages/routes (sign-in, sign-up)
   - Delete all PostHog files (providers, page-view, lib, mock)
   - Delete all R2 routes (create-upload-url, record-upload)
   - Delete all cron routes (reset-tokens, redeploy)
   - Delete token usage routes (usage, public-usage)
   - Delete Unkey server actions + mocks
   - Rewrite app layout (no Clerk/PostHog wrappers)
   - Rewrite app page (simple redirect)
   - Clean dashboard usage card
   - Clean sync upload route (remove Vercel Blob)
   - Clean sync actions (remove dead uploadFile, Clerk auth)
   - Clean drizzle schema (remove christmas, tier, token functions)
   - Remove 8 package deps (@clerk, @unkey, @aws-sdk, @vercel, posthog)
   - Clean .env.example (remove 7 env vars)"
   ```

---

## Post-Merge Cleanup (After Both Branches Merged)

After merging both branches into master:

1. **Delete posthog.ts stub:** `rm packages/web/lib/posthog.ts` (zero consumers after Plan A's deletions)
2. **Full build:** `pnpm --filter @zenith-ai/web build:self-host`
3. **Full tests:** `cd packages/web && pnpm test`
4. **Full grep audit** (combined from both plans)
5. **Plugin build:** `cd packages/plugin && pnpm build`
