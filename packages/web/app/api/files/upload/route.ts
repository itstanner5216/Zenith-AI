import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { mkdir } from "fs/promises";
import { handleAuthorizationV2 } from "@/lib/handleAuthorization";

async function ensureDir(dirPath: string) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

    await ensureDir(uploadDir);

    const formData = await request.formData();
    const files = formData.getAll('files');

    const uploadedFiles = await Promise.all(
      files.map(async (file: any) => {
        const fileName = file.name;
        const fileType = fileName.split('.').pop() || 'unknown';
        const uniqueFileName = `${uuidv4()}-${fileName}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        const stats = fs.statSync(filePath);

        return {
          id: uniqueFileName.split('-')[0],
          name: fileName,
          path: filePath.replace(process.cwd(), ''),
          type: fileType === 'md' ? 'markdown' :
                ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType) ? 'image' : 'file',
          size: stats.size,
          date: new Date().toISOString()
        };
      })
    );

    return NextResponse.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error: any) {
    if (error?.name === 'AuthorizationError') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status || 401 }
      );
    }
    console.error('Error uploading files:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}
