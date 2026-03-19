import { NextRequest, NextResponse } from 'next/server';
import { db, uploadedFiles, UploadedFile } from '@/drizzle/schema';
import { eq, or, and } from 'drizzle-orm';
import OpenAI, { toFile } from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { processImageWithVision } from '@/lib/vision';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';

export const maxDuration = 800;

// --- OpenAI Client for Image Generation ---
function getOpenAIImageClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
  });
}

// --- Local Filesystem Helpers ---
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function readLocalFile(filePath: string): Buffer {
  const fullPath = filePath.startsWith('/') ? filePath : path.join(process.cwd(), filePath);
  return fs.readFileSync(fullPath);
}

function writeLocalFile(filePath: string, data: Buffer): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, data);
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

// Function to process magic diagrams
async function processMagicDiagram(
  localFilePath: string,
  originalFileName: string,
  userId: string
): Promise<{ generatedImageUrl: string; tokensUsed: number; error?: string }> {
  let tempImagePath: string | null = null;
  try {
    console.log(
      `Processing Magic Diagram (Image Gen) for: ${originalFileName}`
    );

    // 1. Read original image from local filesystem
    console.log(`Reading original image from local path: ${localFilePath}`);
    const originalImageBuffer = readLocalFile(localFilePath);
    console.log(
      `Read ${originalImageBuffer.length} bytes for ${originalFileName}`
    );

    // 2. Create temporary file path for original image
    const tempDir = os.tmpdir();
    const safeFileName = path.basename(originalFileName);
    const extension = path.extname(safeFileName) || '.png';
    const tempOriginalFileName = `${Date.now()}-${path.basename(
      safeFileName,
      extension
    )}${extension}`;
    tempImagePath = path.join(tempDir, tempOriginalFileName);
    console.log(
      `Writing original image buffer to temporary path: ${tempImagePath}`
    );

    // 3. Write original buffer to temporary file
    fs.writeFileSync(
      tempImagePath,
      originalImageBuffer as unknown as Uint8Array
    );
    console.log(`Successfully wrote original buffer to ${tempImagePath}`);

    // 4. Prepare generation prompt
    const generationPrompt = `Digitize this sketch image into a clean, well-rendered diagram suitable for digital files. Preserve the core elements and connections shown in the sketch. Original filename for context: ${originalFileName}.`;
    console.log(
      `Generating image with prompt: ${generationPrompt.substring(0, 150)}...`
    );

    // 5. Create read stream and determine mimetype
    console.log(
      `Creating read stream for temporary original image: ${tempImagePath}`
    );
    const imageStream = fs.createReadStream(tempImagePath);
    let mimeType = 'image/png';
    const fileExt = path.extname(tempImagePath).toLowerCase();
    if (fileExt === '.jpg' || fileExt === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (fileExt === '.webp') {
      mimeType = 'image/webp';
    }
    console.log(`Determined mimetype: ${mimeType}`);

    // 6. Prepare image file using toFile
    const preparedImage = await toFile(
      imageStream,
      path.basename(tempImagePath),
      {
        type: mimeType,
      }
    );
    console.log(
      `Prepared image for OpenAI API: ${preparedImage.name} with type ${mimeType}`
    );

    // 7. Call OpenAI API, requesting b64_json
    const response = await getOpenAIImageClient().images.edit({
      model: 'gpt-image-1',
      image: preparedImage,
      prompt: generationPrompt,
      n: 1,
    });

    // 8. Extract base64 data
    const imageBase64 = response.data[0]?.b64_json;
    console.log(
      `Received image data (base64 length: ${imageBase64?.length ?? 0})`
    );

    if (!imageBase64) {
      console.error(
        'Image generation response data (check for errors):',
        response.data
      );
      throw new Error(
        'Image generation failed, no b64_json returned in the response.'
      );
    }

    // 9. Decode base64 image
    const generatedImageBuffer = Buffer.from(imageBase64, 'base64');
    console.log(
      `Decoded generated image buffer size: ${generatedImageBuffer.length} bytes`
    );

    // 10. Generate unique local path for the generated image
    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    const generatedFileExtension = '.png';
    const generatedFileName = `${Date.now()}-${uniqueSuffix}-${path.basename(
      originalFileName,
      extension
    )}${generatedFileExtension}`;
    const generatedDir = path.join(UPLOAD_DIR, 'generated', userId);
    const generatedFilePath = path.join(generatedDir, generatedFileName);

    // 11. Write generated image to local filesystem
    writeLocalFile(generatedFilePath, generatedImageBuffer);

    // 12. Construct local URL path
    const generatedLocalUrl = `/uploads/generated/${userId}/${generatedFileName}`;
    console.log(`Generated local URL: ${generatedLocalUrl}`);

    // Estimate token usage (placeholder)
    const tokensUsed = 5000;

    // 13. Return the new local URL
    return { generatedImageUrl: generatedLocalUrl, tokensUsed };
  } catch (error: unknown) {
    console.error('Error in processMagicDiagram (image generation):', error);
    let errorMessage = 'Unknown error generating diagram image';

    interface OpenAIErrorDetail {
      message?: string;
    }
    interface OpenAIErrorWrapper {
      error?: OpenAIErrorDetail;
      message?: string;
    }

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      !(error instanceof Error)
    ) {
      errorMessage = String(error.message);
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      const potentialError = error as OpenAIErrorWrapper;
      const nestedError = potentialError?.error;
      if (nestedError?.message) {
        errorMessage = String(nestedError.message);
      } else if (potentialError?.message) {
        errorMessage = String(potentialError.message);
      }
    }

    console.error('Full error object:', error);
    return {
      generatedImageUrl: '',
      tokensUsed: 0,
      error: `Error generating diagram: ${errorMessage}`,
    };
  } finally {
    // 14. Clean up temporary original image file
    if (tempImagePath) {
      console.log(
        `Cleaning up temporary original image file: ${tempImagePath}`
      );
      try {
        fs.unlinkSync(tempImagePath);
        console.log(`Successfully deleted ${tempImagePath}`);
      } catch (cleanupError) {
        console.error(
          `Failed to delete temporary file ${tempImagePath}:`,
          cleanupError
        );
      }
    }
  }
}

// --- Reusable Processing Function ---
async function processSingleFileRecord(fileRecord: UploadedFile): Promise<{
  status: 'completed' | 'error';
  textContent: string | null;
  generatedImageUrl: string | null;
  tokensUsed: number;
  error: string | null;
}> {
  const fileId = fileRecord.id;
  const userId = fileRecord.userId;
  let textContent: string | null = null;
  let generatedImageUrl: string | null = null;
  let tokensUsed = 0;
  let processingError: string | null = null;

  // Determine local file path
  let localPath: string;
  try {
    localPath = getLocalFilePath(fileRecord);
    console.log(`[File ${fileId}] Using local path: ${localPath}`);
  } catch (err) {
    console.error(
      `[File ${fileId}] Could not determine local path from blobUrl: ${fileRecord.blobUrl}`
    );
    return {
      status: 'error',
      textContent: null,
      generatedImageUrl: null,
      tokensUsed: 0,
      error: `Could not determine local file path from blobUrl: ${fileRecord.blobUrl}`,
    };
  }

  try {
    console.log(`Starting single file processing for ID: ${fileId}`);
    const processType = fileRecord.processType || 'standard-ocr';
    const fileType = fileRecord.fileType.toLowerCase();
    console.log(`Processing type: ${processType}, File type: ${fileType}`);

    // --- Processing Logic ---
    console.log(`Processing file ${fileId} with processType: ${processType}`);
    if (processType === 'magic-diagram' && fileType.startsWith('image/')) {
      // --- Magic Diagram Processing (Image Generation) ---
      console.log(`Processing Magic Diagram for ${fileId}`);
      const result = await processMagicDiagram(
        localPath,
        fileRecord.originalName,
        userId
      );
      if (result.error) {
        processingError = result.error;
        tokensUsed = 0;
        generatedImageUrl = null;
        textContent = `[Error generating diagram: ${result.error}]`;
      } else {
        generatedImageUrl = result.generatedImageUrl;
        tokensUsed = result.tokensUsed;
        textContent = `[Generated Diagram Image](${generatedImageUrl})`;
      }
    } else if (
      processType === 'standard-ocr' &&
      fileType.startsWith('image/')
    ) {
      // --- Standard OCR Processing ---
      if (!fileRecord.blobUrl) {
        throw new Error(
          `Missing blobUrl for OCR processing of file ID ${fileId}`
        );
      }
      console.log(
        `Processing Standard OCR for ${fileId} using blobUrl: ${fileRecord.blobUrl}`
      );
      const result = await processImageWithVision(fileRecord.blobUrl);
      textContent = result.textContent;
      tokensUsed = result.tokensUsed;
      if (textContent?.startsWith('Error processing image OCR')) {
        processingError = textContent;
        textContent = null;
      } else if (
        !processingError &&
        (!textContent || textContent.trim() === '')
      ) {
        console.warn(`No text content extracted for file ${fileId}`);
        textContent = '[OCR completed, but no text extracted]';
      }
      generatedImageUrl = null;
    } else if (fileType === 'application/pdf' || fileType.includes('pdf')) {
      processingError = 'PDF processing not yet implemented.';
      textContent = '[PDF Content - Processing Pending Implementation]';
      tokensUsed = 0;
      generatedImageUrl = null;
    } else {
      if (fileType === 'text/plain' || fileType === 'text/markdown') {
        console.log(
          `Handling plain text/markdown file ${fileId}. Reading content...`
        );
        const buffer = readLocalFile(localPath);
        textContent = buffer.toString('utf-8');
        tokensUsed = 0;
        console.log(
          `Extracted ${textContent.length} chars from text file ${fileId}`
        );
        generatedImageUrl = null;
      } else {
        processingError = `Unsupported file type/processType: ${fileType} / ${processType}`;
        textContent = `[Unsupported: ${fileType}]`;
        tokensUsed = 0;
        generatedImageUrl = null;
      }
    }
    // --- End Processing Logic ---
  } catch (error: unknown) {
    console.error(`Error during single file processing ${fileId}:`, error);
    processingError =
      error instanceof Error ? error.message : 'Unknown processing error';
    textContent = null;
    generatedImageUrl = null;
    tokensUsed = 0;
  }

  const finalStatus = processingError ? 'error' : 'completed';
  console.log(
    `Single file processing result for ${fileId}: Status=${finalStatus}, Error=${processingError}, Tokens=${tokensUsed}`
  );
  return {
    status: finalStatus,
    textContent: processingError
      ? `[Processing Error: ${processingError}]`
      : textContent,
    generatedImageUrl: generatedImageUrl,
    tokensUsed: tokensUsed,
    error: processingError,
  };
}

// --- Main Worker Logic --- //

export async function GET(request: NextRequest) {
  console.log('[/api/process-pending-uploads] Worker starting...');

  // 1. Authorization Check
  const { userId } = await handleAuthorizationV2(request);
  console.log(`[/api/process-pending-uploads] Authorized user: ${userId}`);

  console.log(
    '[/api/process-pending-uploads] Starting background processing job...'
  );
  let processedCount = 0;
  let errorCount = 0;

  try {
    // 2. Fetch pending files (limit batch size)
    console.log(
      '[/api/process-pending-uploads] Fetching pending files from DB...'
    );
    const pendingFiles = await db
      .select()
      .from(uploadedFiles)
      .where(
        or(
          eq(uploadedFiles.status, 'pending'),
          eq(uploadedFiles.status, 'processing')
        )
      )
      .limit(10);

    console.log(
      `[/api/process-pending-uploads] Found ${pendingFiles.length} files to process.`
    );
    if (pendingFiles.length > 0) {
      console.log(
        '[/api/process-pending-uploads] Pending file IDs and types:',
        pendingFiles.map((f) => ({
          id: f.id,
          status: f.status,
          processType: f.processType,
        }))
      );
    }

    if (pendingFiles.length === 0) {
      console.log(
        '[/api/process-pending-uploads] No pending files to process.'
      );
      return NextResponse.json({ message: 'No pending files' });
    }

    console.log(
      `Found ${pendingFiles.length} pending/processing files to attempt.`
    );

    // 3. Process each file
    for (const fileRecord of pendingFiles) {
      const fileId = fileRecord.id;
      const fileUserId = fileRecord.userId;

      try {
        if (fileRecord.status !== 'processing') {
          const [claimed] = await db
            .update(uploadedFiles)
            .set({ status: 'processing', updatedAt: new Date(), error: null })
            .where(
              and(
                eq(uploadedFiles.id, fileId),
                eq(uploadedFiles.status, 'pending')
              )
            )
            .returning({ id: uploadedFiles.id });

          if (!claimed) {
            console.log(`File ${fileId} already claimed by another worker, skipping.`);
            continue;
          }
          console.log(`Claimed file ${fileId} for processing.`);
        } else {
          console.log(
            `File ${fileId} was already marked as processing, retrying...`
          );
        }

        const result = await processSingleFileRecord(fileRecord);

        // 4. Update Database Record
        await db
          .update(uploadedFiles)
          .set({
            status: result.status,
            textContent: result.textContent,
            generatedImageUrl: result.generatedImageUrl,
            tokensUsed: result.tokensUsed,
            error: result.error,
            updatedAt: new Date(),
          })
          .where(eq(uploadedFiles.id, fileId));

        console.log(
          `Finished processing file ${fileId} with final status: ${result.status}`
        );

        if (result.status === 'completed' && result.tokensUsed > 0) {
          processedCount++;
          try {
            console.log(
              `Incremented token usage for user ${fileUserId} by ${result.tokensUsed}`
            );
          } catch (tokenError) {
            console.error(
              `Failed to increment token usage for user ${fileUserId} after processing file ${fileId}:`,
              tokenError
            );
          }
        } else if (result.status === 'error') {
          errorCount++;
        } else {
          processedCount++;
        }
      } catch (dbUpdateError: unknown) {
        console.error(
          `Critical error during processing loop for file ${fileId}:`,
          dbUpdateError
        );
        errorCount++;
        try {
          await db
            .update(uploadedFiles)
            .set({
              status: 'error',
              error: `Processing Loop Error: ${
                dbUpdateError instanceof Error
                  ? dbUpdateError.message
                  : String(dbUpdateError)
              }`,
              updatedAt: new Date(),
            })
            .where(eq(uploadedFiles.id, fileId));
        } catch (finalDbError) {
          console.error(
            `Failed even to mark file ${fileId} as error after critical loop failure:`,
            finalDbError
          );
        }
      }
    }

    return NextResponse.json({
      message: `Processing complete. Attempted: ${pendingFiles.length}, Succeeded: ${processedCount}, Errors: ${errorCount}`,
    });
  } catch (error: unknown) {
    console.error('Error in background processing job:', error);
    return NextResponse.json(
      {
        error: 'Background processing job failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
