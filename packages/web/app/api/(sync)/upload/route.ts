import { NextRequest, NextResponse } from "next/server";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { db, uploadedFiles } from "@/drizzle/schema";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await handleAuthorizationV2(request);

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // Handle base64 upload from mobile
      const { name, type, base64 } = await request.json();

      if (!name || !type || !base64) {
        return NextResponse.json(
          { success: false, error: "Missing required fields" },
          { status: 400 }
        );
      }

      ensureDir(UPLOAD_DIR);
      const uniqueName = `${uuidv4()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(UPLOAD_DIR, uniqueName);
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buffer);

      const localUrl = `/uploads/${uniqueName}`;

      const [file] = await db
        .insert(uploadedFiles)
        .values({
          userId,
          originalName: name,
          fileType: type,
          status: "uploaded",
          blobUrl: localUrl,
        })
        .returning();

      return NextResponse.json({
        success: true,
        fileId: file.id,
        status: file.status,
        url: localUrl,
      });
    }

    // Handle multipart form upload
    const formData = await request.formData();
    const files = formData.getAll('files');

    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "No files provided" },
        { status: 400 }
      );
    }

    ensureDir(UPLOAD_DIR);

    const results = await Promise.all(
      files.map(async (file: any) => {
        const uniqueName = `${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = path.join(UPLOAD_DIR, uniqueName);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        const localUrl = `/uploads/${uniqueName}`;

        const [record] = await db
          .insert(uploadedFiles)
          .values({
            userId,
            originalName: file.name,
            fileType: file.type || 'application/octet-stream',
            status: "uploaded",
            blobUrl: localUrl,
          })
          .returning();

        return { fileId: record.id, name: file.name, url: localUrl, status: "uploaded" };
      })
    );

    return NextResponse.json({ success: true, files: results });
  } catch (error: any) {
    if (error?.name === 'AuthorizationError') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status || 401 }
      );
    }
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Server error during upload", retryable: true },
      { status: 500 }
    );
  }
}