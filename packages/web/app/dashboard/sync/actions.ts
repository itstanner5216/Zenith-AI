"use server";

import { db, uploadedFiles } from "@/drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

// Types
interface PaginationParams {
  page: number;
  limit: number;
}

interface FileListResponse {
  files: Array<{
    id: number;
    originalName: string;
    fileType: string;
    status: string;
    createdAt: Date;
    tokensUsed: number | null;
    error: string | null;
    textContent: string | null;
    blobUrl: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface FileStatusResponse {
  status: string;
  text: string | null;
  error: string | null;
}

// Get files with pagination
export async function getFiles(
  { page = 1, limit = 10 },
  userId?: string
): Promise<FileListResponse | { error: string }> {
  try {
    if (!userId) {
      return { error: "Unauthorized" };
    }

    const offset = (page - 1) * limit;

    const files = await db
      .select({
        id: uploadedFiles.id,
        originalName: uploadedFiles.originalName,
        fileType: uploadedFiles.fileType,
        status: uploadedFiles.status,
        createdAt: uploadedFiles.createdAt,
        tokensUsed: uploadedFiles.tokensUsed,
        error: uploadedFiles.error,
        textContent: uploadedFiles.textContent,
        blobUrl: uploadedFiles.blobUrl,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId))
      .orderBy(desc(uploadedFiles.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId));

    return {
      files,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    console.error("List files error:", error);
    return { error: "Failed to list files" };
  }
}

// Get file status
export async function getFileStatus(
  fileId: number,
  userId?: string
): Promise<FileStatusResponse | { error: string }> {
  try {
    if (!userId) {
      return { error: "Unauthorized" };
    }

    const [file] = await db
      .select({
        userId: uploadedFiles.userId,
        status: uploadedFiles.status,
        textContent: uploadedFiles.textContent,
        error: uploadedFiles.error,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!file) {
      return { error: "File not found" };
    }

    if (file.userId !== userId) {
      return { error: "Unauthorized" };
    }

    return {
      status: file.status,
      text: file.textContent,
      error: file.error,
    };
  } catch (error) {
    console.error("Get file status error:", error);
    return { error: "Failed to get file status" };
  }
}

// Delete file
export async function deleteFile(
  fileId: number,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));

    return { success: true };
  } catch (error) {
    console.error("Delete file error:", error);
    return { success: false, error: "Failed to delete file" };
  }
}
