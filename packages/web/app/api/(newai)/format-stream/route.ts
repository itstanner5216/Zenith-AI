import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse, NextRequest } from 'next/server';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { getModel } from '@/lib/models';

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, formattingInstruction } = await request.json();
    const model = getModel();

    // Check if this is a flash_cards template
    const isFlashCardsTemplate = formattingInstruction.includes('flash_cards') ||
      formattingInstruction.includes('Flash Card Generation') ||
      formattingInstruction.includes('flashcard');

    // Add YAML frontmatter reminder for flash_cards template
    const yamlReminder = isFlashCardsTemplate
      ? `\n\nIMPORTANT: When generating frontmatter, use flat YAML format with each property on its own line (no nesting). Example:\n---\ntotal: 15\ntopics: ["Topic 1", "Topic 2", "Topic 3"]\ncreated: "2025-01-09"\n---`
      : '';

    const result = await streamText({
      model: model as any,
      system: 'Answer directly in markdown',
      messages: [
        {
          role: 'user',
          content: `Format the following content according to the given instruction.${yamlReminder}

Context:
  Time: ${new Date().toISOString()}

Content:
"${content}"

Formatting Instruction:
"${formattingInstruction}"`,
        },
      ],
      onFinish: async ({ usage }) => {
        console.log('Token usage:', usage);
      },
    });

    const response = result.toTextStreamResponse();

    return response;
  } catch (error) {
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
  }
}
