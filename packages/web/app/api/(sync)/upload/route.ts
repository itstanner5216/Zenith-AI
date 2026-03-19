import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { handleAuthorizationV2, AuthorizationError } from '@/lib/handleAuthorization';
import { db, uploadedFiles } from '@/drizzle/schema';

export const runtime = "nodejs"; // Use Node.js runtime

// Define the response type
type UploadResponse = {
  success: boolean;
  fileId?: number | string;
  status?: string;
  error?: string;
  retryable?: boolean;
  url?: string;
};

// Define type for the server-side JSON request body
interface FileUploadData {
  name: string;
  type: string;
  base64: string;
}

/**
 * Upload handler — accepts base64-encoded file data and writes to local storage
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await handleAuthorizationV2(request);

    if (request.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await request.json() as FileUploadData;
        return await handleBase64Upload(userId, body);
      } catch (error) {
        console.error("JSON parsing error:", error);
        return NextResponse.json<UploadResponse>(
          { success: false, error: "Invalid JSON format", retryable: false },
          { status: 400 }
        );
      }
    }

    return NextResponse.json<UploadResponse>(
      { success: false, error: "Unsupported content type", retryable: false },
      { status: 415 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json<UploadResponse>(
        { success: false, error: error.message, retryable: false },
        { status: error.status }
      );
    }
    console.error("Upload error:", error);
    return NextResponse.json<UploadResponse>(
      {
        success: false,
        error: "Server error during upload",
        retryable: true,
      },
      { status: 500 }
    );
  }
}

/**
 * Handles base64 uploads from clients by writing to local file storage
 */
async function handleBase64Upload(
  userId: string,
  fileData: FileUploadData
): Promise<NextResponse> {
  const { name, type, base64 } = fileData;

  if (!name || !type || !base64) {
    console.error("Missing required fields");
    return NextResponse.json<UploadResponse>(
      { success: false, error: "Missing required fields", retryable: true },
      { status: 400 }
    );
  }

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64, 'base64');

    // Write file to local upload directory
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    await mkdir(uploadDir, { recursive: true });

    const safeName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, safeFileName);
    await writeFile(filePath, new Uint8Array(buffer));

    // Create database record
    const [file] = await db
      .insert(uploadedFiles)
      .values({
        userId,
        originalName: name,
        fileType: type,
        status: "uploaded",
        blobUrl: filePath,
      })
      .returning();

    return NextResponse.json<UploadResponse>({
      success: true,
      fileId: file.id,
      status: file.status,
      url: filePath,
    });
  } catch (error) {
    console.error("Base64 upload error:", error);
    return NextResponse.json<UploadResponse>(
      {
        success: false,
        error: (error as Error).message || "Failed to upload file",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
