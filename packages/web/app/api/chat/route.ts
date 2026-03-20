import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getModel } from '../../../lib/models';
import { handleAuthorizationV2 } from '../../../lib/handleAuthorization';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  await handleAuthorizationV2(req);

  const { messages } = await req.json();

  const result = streamText({
    model: getModel(),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
