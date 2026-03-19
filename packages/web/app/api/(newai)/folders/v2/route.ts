import { NextRequest, NextResponse } from "next/server";
import { handleAuthorizationV2, AuthorizationError } from "@/lib/handleAuthorization";
import { getModel } from "@/lib/models";
import { z } from "zod";
import { generateObject } from "ai";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, fileName, folders, customInstructions, count = 3 } =
      await request.json();
    const model = getModel();
    const response = await generateObject({
      model: model as any, // Type cast for AI SDK v2 compatibility
      schema: z.object({
        suggestedFolders: z
          .array(
            z.object({
              score: z.number().min(0).max(100),
              isNewFolder: z.boolean(),
              folder: z.string(),
              reason: z.string(),
            })
          )
          .min(1)
          .max(count)
      }),
      system: `Given the content and file name: "${fileName}", suggest exactly ${count} folders. You can use: ${folders.join(
        ", "
      )}. If none are relevant, suggest new folders. ${
        customInstructions ? `Instructions: "${customInstructions}"` : ""
      }`,
      prompt: `Content: "${content}"`,
    });
    return NextResponse.json({
      folders: response.object.suggestedFolders.sort(
        (a, b) => b.score - a.score
      ),
    });
  } catch (error) {
    // Properly handle AuthorizationError with status codes
    // Use try-catch for instanceof check in case AuthorizationError is undefined (e.g., in tests)
    try {
      if (error instanceof AuthorizationError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
    } catch {
      // AuthorizationError may be undefined in test environment, fall through to property check
    }

    // Handle errors with status property
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      return NextResponse.json(
        { error: (error as any).message },
        { status: (error as any).status || 500 }
      );
    }

    // Fallback for other errors
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
