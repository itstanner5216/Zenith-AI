import React, { useState, useEffect } from "react";
import { SectionHeader } from "../section-header";
import { makeApiRequest } from "../../../apiUtils";
import { requestUrl, Notice, TFolder } from "obsidian";
import ZenithAI from "../../../index";
import { Button } from "../../../components/ui/button";
import { StyledContainer } from "@/components/ui/utils";
import { tw } from "@/lib/utils";
import { EmptyState } from "../organizer/components/empty-state";

// Import icons for file types
import {
  FileText,
  FileImage,
  RefreshCw,
  Download,
  Cloud,
  Check,
  AlertCircle,
  RotateCw,
  Clock,
  DownloadCloud,
} from "lucide-react";

// Storage key for downloaded files
const DOWNLOADED_FILES_KEY = "file-organizer-downloaded-files";

interface RemoteFile {
  id: string;
  userId: string;
  blobUrl: string;
  fileType: string;
  originalName: string;
  status: "pending" | "processing" | "completed" | "error";
  textContent?: string;
  tokensUsed?: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  previewUrl?: string; // URL for preview thumbnail
}

// Cache for binary previews
interface PreviewCache {
  [fileId: string]: {
    url: string;
    dataUrl: string;
  };
}

interface PaginatedResponse {
  files: RemoteFile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function SyncTab({
  plugin,
  onTokenLimitError,
}: {
  plugin: ZenithAI;
  onTokenLimitError?: (error: string) => void;
}) {
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(
    new Set()
  );
  const [syncingAll, setSyncingAll] = useState(false);
  const [previewCache, setPreviewCache] = useState<PreviewCache>({});
  const [loadingPreviews, setLoadingPreviews] = useState<Record<string, boolean>>({});

  // Load downloaded files from local storage
  useEffect(() => {
    const loadDownloadedFiles = () => {
      try {
        const savedFiles = localStorage.getItem(DOWNLOADED_FILES_KEY);
        if (savedFiles) {
          setDownloadedFiles(new Set(JSON.parse(savedFiles)));
        }
      } catch (err) {
        console.error("Error loading downloaded files", err);
      }
    };

    loadDownloadedFiles();
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [page, plugin]);

  async function fetchFiles() {
    if (!plugin.settings.API_KEY) {
      setError("API key not found. Please set your API key in settings.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Make the request directly to check status code
      const urlResponse = await requestUrl({
        url: `${plugin.getServerUrl()}/api/files?page=${page}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${plugin.settings.API_KEY}`,
        },
      });

      // Check for 429 status (token limit exceeded)
      if (urlResponse.status === 429) {
        const errorData = urlResponse.json as { error?: string };
        const errorMessage =
          errorData?.error ||
          "Token limit exceeded. Please upgrade your plan for more tokens.";
        setError(errorMessage);
        setLoading(false);
        // Notify parent component to show upgrade button
        onTokenLimitError?.(errorMessage);
        return;
      }

      // For successful responses, parse the JSON
      if (urlResponse.status >= 200 && urlResponse.status < 300) {
        const response = urlResponse.json as PaginatedResponse;
        setFiles(response.files);
        setTotalPages(response.pagination.totalPages);
        setLoading(false);

        // After loading files, fetch previews for any binary files
        for (const file of response.files) {
          if (file.status === "completed" &&
              (file.fileType.startsWith('image/') || file.fileType === 'application/pdf')) {
            fetchPreview(file);
          }
        }
        return;
      }

      // Handle other error statuses
      const errorData = urlResponse.json as { error?: string };
      throw new Error(errorData?.error || `Request failed with status ${urlResponse.status}`);
    } catch (err) {
      // Check if error message contains token limit information
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      if (
        errorMessage.includes("Token limit exceeded") ||
        errorMessage.includes("token limit") ||
        errorMessage.includes("429")
      ) {
        setError("Token limit exceeded. Please upgrade your plan for more tokens.");
        onTokenLimitError?.("Token limit exceeded");
      } else {
        setError("Failed to fetch files: " + errorMessage);
      }
      setLoading(false);
    }
  }

  // Fetch preview for binary files (images and PDFs)
  const fetchPreview = async (file: RemoteFile) => {
    // Skip if not a previewable file or already in cache
    if (previewCache[file.id] || file.status !== "completed") {
      return;
    }

    // Only load previews for images and PDFs
    const isImage = file.fileType.startsWith('image/');
    const isPDF = file.fileType === 'application/pdf';

    if (!isImage && !isPDF) {
      return;
    }

    // Set loading state
    setLoadingPreviews(prev => ({ ...prev, [file.id]: true }));

    try {
      // Fetch the binary file
      const response = await requestUrl({
        url: file.blobUrl,
        method: "GET"
      });

      // Convert to data URL
      let dataUrl = '';

      if (isImage) {
        // For images, create a data URL
        const blob = new Blob([response.arrayBuffer], { type: file.fileType });
        dataUrl = await blobToDataUrl(blob);
      } else if (isPDF) {
        // For PDFs, we'll just use a PDF icon or first page if possible
        dataUrl = 'pdf'; // Just a marker that we have the PDF
      }

      // Update cache
      setPreviewCache(prev => ({
        ...prev,
        [file.id]: {
          url: file.blobUrl,
          dataUrl
        }
      }));
    } catch (err) {
      console.error(`Error fetching preview for file ${file.id}:`, err);
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [file.id]: false }));
    }
  };

  // Helper to convert Blob to data URL
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Mark a file as downloaded
  const markFileAsDownloaded = (fileId: string) => {
    const newDownloadedFiles = new Set(downloadedFiles);
    newDownloadedFiles.add(fileId);
    setDownloadedFiles(newDownloadedFiles);

    // Save to localStorage
    try {
      localStorage.setItem(
        DOWNLOADED_FILES_KEY,
        JSON.stringify([...newDownloadedFiles])
      );
    } catch (err) {
      console.error("Error saving downloaded files", err);
    }
  };

  // Clear download history
  const clearDownloadHistory = () => {
    if (
      confirm(
        "Are you sure you want to clear your download history? This won't delete any files from your vault, but will reset the 'synced' status for all files."
      )
    ) {
      setDownloadedFiles(new Set());
      localStorage.removeItem(DOWNLOADED_FILES_KEY);
      new Notice("Download history cleared");
    }
  };

  // Download all undownloaded files
  const downloadAllMissingFiles = async () => {
    if (syncingAll) return;

    try {
      setSyncingAll(true);

      // Find all completed files that haven't been downloaded
      const filesToDownload = files.filter(
        file => file.status === "completed" && !downloadedFiles.has(file.id)
      );

      if (filesToDownload.length === 0) {
        new Notice("All files are already synchronized");
        return;
      }

      new Notice(`Syncing ${filesToDownload.length} file(s)...`);

      // Download each file one by one
      for (const file of filesToDownload) {
        if (!downloading[file.id]) {
          await downloadFile(file);
        }
      }

      new Notice(`Successfully synchronized ${filesToDownload.length} file(s)`);
    } catch (err) {
      new Notice(
        `Error during bulk sync: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      console.error("Bulk sync error:", err);
    } finally {
      setSyncingAll(false);
    }
  };

  async function downloadFile(file: RemoteFile) {
    if (downloading[file.id]) return;

    setDownloading(prev => ({ ...prev, [file.id]: true }));

    try {
      // Determine destination folder - use the dedicated sync folder
      const folderPath =
        plugin.settings.syncFolderPath || "_NoteCompanion/Sync";

      try {
        await plugin.ensureFolderExists(folderPath);
      } catch (err) {
        new Notice(`Failed to create sync folder: ${folderPath}`);
        throw err;
      }

      // Fetch file content from blob URL
      const fileResponse = await requestUrl({
        url: file.blobUrl,
        method: "GET",
      });

      // Create a sanitized filename
      const sanitizedFilename = file.originalName.replace(/[\\/:*?"<>|]/g, "_");
      const isImage = file.fileType.startsWith("image/");
      const isPDF = file.fileType === "application/pdf";

      // Create a date-based subfolder to organize downloads
      const today = new Date();
      const dateFolder = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const dateFolderPath = `${folderPath}/${dateFolder}`;

      try {
        await plugin.ensureFolderExists(dateFolderPath);
      } catch (err) {
        // If date folder fails, just use the main sync folder
        console.warn("Failed to create date folder, using main sync folder", err);
      }

      const finalPath = `${dateFolderPath}/${sanitizedFilename}`;

      // Check if file already exists
      const existingFile = plugin.app.vault.getAbstractFileByPath(finalPath);
      if (existingFile) {
        // If it exists, we could either skip or append a timestamp
        // For now, let's just mark it as downloaded
        markFileAsDownloaded(file.id);
        new Notice(`File already exists: ${sanitizedFilename}`);
      } else {
        // Create the file in the vault
        await plugin.app.vault.createBinary(finalPath, fileResponse.arrayBuffer);
        markFileAsDownloaded(file.id);
        new Notice(`Downloaded: ${sanitizedFilename}`);
      }
    } catch (err) {
      new Notice(
        `Failed to download ${file.originalName}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      console.error("Download error:", err);
    } finally {
      setDownloading(prev => ({ ...prev, [file.id]: false }));
    }
  }

  function getFileIcon(fileType: string, className?: string) {
    if (fileType.startsWith("image/"))
      return <FileImage className={className} />;
    return <FileText className={className} />;
  }

  return (
    <StyledContainer className={tw("flex flex-col h-full")}>
      <div className={tw("p-4 border-b border-[rgba(14,210,247,0.08)]")}>
        <div className={tw("flex items-center justify-between mb-2")}>
          <h2 className={tw("text-lg font-semibold text-[#bebebe] flex items-center gap-2")}>
            <Cloud className={tw("w-5 h-5 text-[#0fb6d6]")} />
            Mobile Sync
          </h2>
          <div className={tw("flex items-center gap-2")}>
            <button
              onClick={fetchFiles}
              disabled={loading}
              className={tw("p-2 rounded-full hover:bg-[rgba(14,210,247,0.08)] text-[#45aaff] transition-colors")}
              title="Refresh files"
            >
              <RotateCw className={tw(`w-4 h-4 ${loading ? "animate-spin" : ""}`)} />
            </button>
          </div>
        </div>
        <p className={tw("text-xs text-[#45aaff] mb-4")}>
          Access files uploaded from your mobile device or web dashboard.
        </p>

        <div className={tw("flex gap-2")}>
          <button
            onClick={downloadAllMissingFiles}
            disabled={loading || syncingAll || files.length === 0}
            className={tw(`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all duration-200 ${
              loading || syncingAll || files.length === 0
                ? "bg-[#191621] text-[rgba(122,162,247,0.4)] cursor-not-allowed"
                : "bg-[#0fb6d6] text-[#0d0b12] hover:bg-[rgba(14,210,247,0.85)] shadow-[0_0_8px_rgba(14,210,247,0.2)]"
            }`)}
          >
            {syncingAll ? (
              <RefreshCw className={tw("w-4 h-4 animate-spin")} />
            ) : (
              <DownloadCloud className={tw("w-4 h-4")} />
            )}
            <span>{syncingAll ? "Syncing..." : "Sync All New"}</span>
          </button>

          {downloadedFiles.size > 0 && (
            <button
              onClick={clearDownloadHistory}
              className={tw("px-3 py-2 rounded text-xs font-medium bg-[#191621] text-[#45aaff] border border-[rgba(14,210,247,0.08)] hover:bg-[rgba(14,210,247,0.06)] transition-colors")}
              title="Clear sync history"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* File list - compact rows */}
      <div className={tw("flex-1 overflow-y-auto")}>


      {error && (
        <div className={tw("px-3 py-2 bg-[rgba(244,86,157,0.1)] border-l-2 border-[#f4569d]")}>
          <div className={tw("flex items-center gap-2 text-sm text-[#f4569d]")}>
            <AlertCircle className={tw("w-4 h-4")} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className={tw("border-t border-[rgba(14,210,247,0.08)]")}>
          {[1, 2, 3].map(i => (
            <div key={i} className={tw("flex items-center px-3 py-2 border-b border-[rgba(14,210,247,0.08)] animate-pulse")}>
              <div className={tw("w-6 h-6 mr-3 bg-[rgba(14,210,247,0.08)]")}></div>
              <div className={tw("flex-1")}>
                <div className={tw("h-4 bg-[rgba(14,210,247,0.08)] w-2/3")}></div>
              </div>
              <div className={tw("h-3 bg-[rgba(14,210,247,0.08)] w-16 mr-4")}></div>
              <div className={tw("w-4 h-4 bg-[rgba(14,210,247,0.08)]")}></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {files.length === 0 ? (
            <EmptyState message="No files yet. Upload via mobile or web app." />
          ) : (
            <div className={tw("border-t border-[rgba(14,210,247,0.08)]")}>
              {files.map(file => (
                <div
                  key={file.id}
                  onClick={() => file.status === 'completed' && !downloading[file.id] && downloadFile(file)}
                  className={tw(`flex items-center gap-3 px-3 py-2 border-b border-[rgba(14,210,247,0.08)] transition-colors group ${
                    file.status === 'completed' && !downloading[file.id]
                      ? 'cursor-pointer hover:bg-[rgba(14,210,247,0.06)] hover:border-[rgba(14,210,247,0.12)]'
                      : 'cursor-default'
                  }`)}
                >
                  {/* Thumbnail (larger for images) */}
                  <div className={tw("mr-3 flex-shrink-0 overflow-hidden")}>
                    {file.fileType.startsWith('image/') ? (
                      <img
                        src={file.previewUrl || file.blobUrl}
                        alt={file.originalName}
                        className={tw("w-16 h-16 object-cover border border-[rgba(14,210,247,0.08)]")}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={tw("flex items-center justify-center w-6 h-6")}
                      style={{ display: file.fileType.startsWith('image/') ? 'none' : 'flex' }}
                    >
                      {getFileIcon(file.fileType, tw("w-4 h-4 text-[#45aaff]"))}
                    </div>
                  </div>

                  {/* File info */}
                  <div className={tw("flex-1 min-w-0 flex flex-col justify-center")}>
                    <div className={tw("text-sm text-[#bebebe] truncate font-medium")}>
                      {file.originalName}
                    </div>
                    <div className={tw("text-xs text-[#45aaff] flex items-center gap-2")}>
                      <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      {file.fileType.startsWith('image/') && (
                        <span className={tw("text-[rgba(122,162,247,0.4)]")}>• Image</span>
                      )}
                    </div>
                  </div>

                  {/* Status icon */}
                  <div className={tw("w-5 h-5 flex items-center justify-center flex-shrink-0")}>
                    {downloading[file.id] ? (
                      <DownloadCloud className={tw("w-4 h-4 text-[#45aaff] animate-pulse")} />
                    ) : downloadedFiles.has(file.id) ? (
                      <Check className={tw("w-4 h-4 text-[#0fb6d6]")} />
                    ) : file.status === 'completed' ? (
                      <Download className={tw("w-4 h-4 text-[#45aaff] opacity-0 group-hover:opacity-100 transition-opacity")} />
                    ) : (
                      <Clock className={tw("w-4 h-4 text-[#ffb74d]")} style={{ filter: 'drop-shadow(0 0 4px rgba(255,183,77,0.4))' }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className={tw("flex justify-between items-center mt-8 bg-[#0d0b12] border border-[rgba(14,210,247,0.08)] p-4")}>
              <Button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={tw(`px-4 py-2 h-auto transition-colors duration-200 flex items-center gap-2 ${
                  page === 1
                    ? "bg-[#191621] text-[rgba(122,162,247,0.4)] cursor-not-allowed"
                    : "bg-[#0d0b12] border border-[rgba(14,210,247,0.08)] hover:bg-[#191621] text-[#bebebe]"
                }`)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tw("w-4 h-4")}>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span>Previous</span>
              </Button>

              <div className={tw("bg-[#191621] border border-[rgba(14,210,247,0.08)] px-4 py-2 text-sm font-medium text-[#bebebe]")}>
                Page {page} of {totalPages}
              </div>

              <Button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={tw(`px-4 py-2 h-auto transition-colors duration-200 flex items-center gap-2 ${
                  page === totalPages
                    ? "bg-[#191621] text-[rgba(122,162,247,0.4)] cursor-not-allowed"
                    : "bg-[#0d0b12] border border-[rgba(14,210,247,0.08)] hover:bg-[#191621] text-[#bebebe]"
                }`)}
              >
                <span>Next</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tw("w-4 h-4")}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Button>
            </div>
          )}
        </>
      )}
      </div>
    </StyledContainer>
  );
}
