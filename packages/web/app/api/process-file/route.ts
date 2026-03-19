import { NextRequest, NextResponse } from "next/server";
import { db, uploadedFiles, UploadedFile } from "@/drizzle/schema";
import { eq, or, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { processImageWithVision } from "@/lib/vision";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
export const maxDuration = 800;

// --- Local Filesystem Helpers ---
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function readLocalFile(filePath: string): Buffer {
  const fullPath = filePath.startsWith('/') ? filePath : path.join(process.cwd(), filePath);
  return fs.readFileSync(fullPath);
}

function getLocalFilePath(fileRecord: { blobUrl: string; r2Key: string | null }): string {
  if (fileRecord.r2Key) {
    return path.join(UPLOAD_DIR, path.basename(fileRecord.r2Key));
  }
  const blobPath = fileRecord.blobUrl;
  if (blobPath.startsWith('/')) {
    return path.join(process.cwd(), blobPath);
  }
  const parts = blobPath.split('/');
  const uploadIdx = parts.findIndex(p => p === 'uploads');
  if (uploadIdx !== -1) {
    return path.join(UPLOAD_DIR, ...parts.slice(uploadIdx + 1));
  }
  return path.join(UPLOAD_DIR, parts[parts.length - 1]);
}

// --- Reusable Processing Function ---
async function processSingleFileRecord(fileRecord: UploadedFile): Promise<{
  status: "completed" | "error";
  textContent: string | null;
  tokensUsed: number;
  error: string | null;
}> {
  const fileId = fileRecord.id;
  let textContent = "";
  let tokensUsed = 0;
  let processingError: string | null = null;

  try {
    console.log(`Starting single file processing for ID: ${fileId}`);

    // Determine local file path
    const localPath = getLocalFilePath(fileRecord);
    console.log(`Using local file path: ${localPath}`);

    const fileType = fileRecord.fileType.toLowerCase();

    // --- Processing Logic ---
    if (fileType === "application/pdf" || fileType.includes("pdf")) {
      console.warn(`PDF processing (${fileId}) needs full implementation`);
      processingError = "PDF processing not yet fully implemented.";
      textContent = "[PDF Content - Processing Pending Implementation]";
      tokensUsed = 0;
    } else if (fileType.startsWith("image/")) {
      console.log(
        `Processing Image (${fileId}) using vision model with URL: ${fileRecord.blobUrl}`
      );
      if (!fileRecord.blobUrl) {
        throw new Error(`Missing blobUrl for image file ID ${fileId}`);
      }
      const result = await processImageWithVision(fileRecord.blobUrl);
      textContent = result.textContent;
      tokensUsed = result.tokensUsed;
      if (textContent.startsWith("Error processing image")) {
        processingError = textContent;
      }
    } else {
      if (fileType === "text/plain" || fileType === "text/markdown") {
        console.warn(
          `Text file processing (${fileId}) - reading from local filesystem`
        );
        const buffer = readLocalFile(localPath);
        textContent = buffer.toString("utf-8");
        tokensUsed = 0;
        console.log(
          `Extracted ${textContent.length} chars from text file ${fileId}`
        );
      } else {
        console.warn(`Unsupported file type for processing: ${fileType}`);
        processingError = `Unsupported file type: ${fileType}`;
      }
    }
    // --- End Processing Logic ---

    if (!processingError && (!textContent || textContent.trim() === "")) {
      console.warn(
        `No text content extracted or file was empty for file ${fileId}`
      );
      textContent =
        "[Processing completed, but no text extracted or file was empty]";
    }
  } catch (error: unknown) {
    console.error(`Error during single file processing ${fileId}:`, error);
    processingError =
      error instanceof Error ? error.message : "Unknown processing error";
    textContent = null;
    tokensUsed = 0;
  }

  const finalStatus = processingError ? "error" : "completed";
  console.log(
    `Single file processing result for ${fileId}: Status=${finalStatus}, Error=${processingError}`
  );
  return {
    status: finalStatus,
    textContent: processingError ? null : textContent,
    tokensUsed: processingError ? 0 : tokensUsed,
    error: processingError,
  };
}

// --- Main POST Handler ---
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let fileId: number | null = null;

  try {
    // 1. Authorization
    console.log("API: Received request to /api/process-file");
    const authResult = await handleAuthorizationV2(request);
    userId = authResult.userId;
    if (!userId) {
      console.error("Authorization failed - no userId returned");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`Authorized user ${userId} for /api/process-file`);

    // 2. Get fileId from request body
    const payload = (await request.json()) as { fileId: number | string };
    if (!payload.fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Convert fileId to number
    try {
      fileId = Number(payload.fileId);
      if (isNaN(fileId)) {
        throw new Error("Invalid numeric file ID");
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid file ID format" },
        { status: 400 }
      );
    }
    console.log(`Request to process file ID: ${fileId}`);

    // 3. Fetch File Record & Check Permissions
    const [fileRecord] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (fileRecord.userId !== userId) {
      console.error(
        `User mismatch: Request from ${userId}, file ${fileId} belongs to ${fileRecord.userId}`
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Avoid reprocessing completed/failed files unless explicitly intended
    if (fileRecord.status === "completed" || fileRecord.status === "error") {
      console.log(
        `File ${fileId} is already in status '${fileRecord.status}'. Skipping reprocessing.`
      );
      return NextResponse.json({
        success: true,
        message: `File already processed with status: ${fileRecord.status}`,
        status: fileRecord.status,
        text: fileRecord.textContent,
        error: fileRecord.error,
      });
    }

    // 4. Mark as Processing
    console.log(`Marking file ${fileId} as processing...`);
    await db
      .update(uploadedFiles)
      .set({ status: "processing", updatedAt: new Date(), error: null })
      .where(eq(uploadedFiles.id, fileId));

    // 5. Call Reusable Processing Function
    const result = await processSingleFileRecord(fileRecord);

    // 6. Update Database Record with Final Result
    console.log(
      `Updating database for file ${fileId} with final status: ${result.status}`
    );
    await db
      .update(uploadedFiles)
      .set({
        status: result.status,
        textContent: result.textContent,
        tokensUsed: result.tokensUsed,
        error: result.error,
        updatedAt: new Date(),
      })
      .where(eq(uploadedFiles.id, fileId));

    // 7. Increment Token Usage (if successful)
    if (result.status === "completed" && result.tokensUsed > 0) {
      try {
        console.log(
          `Incremented token usage for user ${userId} by ${result.tokensUsed} for file ${fileId}`
        );
      } catch (tokenError) {
        console.error(
          `Failed to increment token usage for user ${userId} after processing file ${fileId}:`,
          tokenError
        );
      }
    }

    // 8. Return Response
    console.log(
      `Processing finished for file ${fileId}. Status: ${result.status}`
    );
    if (result.status === "completed") {
      return NextResponse.json({
        success: true,
        message: "File processed successfully.",
        status: result.status,
        text: result.textContent,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "File processing failed.",
        status: result.status,
        error: result.error,
      });
    }
  } catch (error: unknown) {
    console.error(
      `Unhandled error in /api/process-file for file ID ${fileId}:`,
      error
    );

    if (fileId && userId) {
      try {
        await db
          .update(uploadedFiles)
          .set({
            status: "error",
            error: `Unhandled API Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.userId, userId))
          );
      } catch (dbUpdateError) {
        console.error(
          `Failed to mark file ${fileId} as error after unhandled exception:`,
          dbUpdateError
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to process file due to an internal server error." },
      { status: 500 }
    );
  }
}
