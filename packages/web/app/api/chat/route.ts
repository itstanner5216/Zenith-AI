import { NextRequest } from 'next/server';
import { streamText, stepCountIs } from 'ai';
import { getModel } from '../../../lib/models';
import { handleAuthorizationV2 } from '../../../lib/handleAuthorization';
import { getSearchQuery } from '../../../lib/tools/get-search-query';
import { getLastModifiedFiles } from '../../../lib/tools/get-last-modified-files';
import { openFile } from '../../../lib/tools/open-file';
import { moveFiles } from '../../../lib/tools/move-files';
import { renameFiles } from '../../../lib/tools/rename-files';

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
    stopWhen: stepCountIs(5),
    tools: {
      getSearchQuery,
      getLastModifiedFiles,
      openFile,
      moveFiles,
      renameFiles,
    },
  });

  return result.toUIMessageStreamResponse();
}
