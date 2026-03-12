import React, { useState, useEffect } from "react";
import { TFile } from "obsidian";
import { Button } from "../ai-chat/button";
import { FileText, Trash2, ExternalLink, RefreshCw, AlertCircle, Search } from "lucide-react";
import ZenithAI from "../../../index";
import { tw } from "../../../lib/utils";
import { Notice } from "obsidian";
import { logger } from "../../../services/logger";
import { EmptyState } from "../organizer/components/empty-state";
import {
  MeetingMetadataManager,
  RecordingMetadata,
} from "./meeting-metadata";
import { EnhanceNoteHandler } from "./enhance-note-handler";

interface RecentMeetingsProps {
  plugin: ZenithAI;
}

export const RecentMeetings: React.FC<RecentMeetingsProps> = ({ plugin }) => {
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const metadataManager = React.useRef(
    new MeetingMetadataManager(plugin)
  ).current;

  const loadRecordings = async () => {
    setIsLoading(true);
    try {
      await metadataManager.loadMetadata();
      const allRecordings = metadataManager.getRecordings();

      // Sort by creation date (newest first)
      const sorted = allRecordings.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      setRecordings(sorted);
    } catch (error) {
      logger.error("Failed to load recordings", error);
    } finally {
      setIsLoading(false);
    }
  };

  const scanForRecordings = async () => {
    setIsScanning(true);
    try {
      await metadataManager.discoverRecordings();
      await loadRecordings();
      new Notice("Scan complete. Found recordings added to list.");
    } catch (error) {
      logger.error("Failed to scan for recordings", error);
      new Notice("Failed to scan for recordings");
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    loadRecordings();

    // Listen for new recordings
    const handleRecording = () => {
      loadRecordings();
    };
    window.addEventListener("meeting-recorded", handleRecording);

    // Initial discovery on first load
    const doInitialDiscovery = async () => {
      const metadata = await metadataManager.loadMetadata();
      // Only scan if we haven't scanned recently (within last hour)
      const lastScan = metadata.lastScan
        ? new Date(metadata.lastScan).getTime()
        : 0;
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      if (lastScan < oneHourAgo) {
        await scanForRecordings();
      } else {
        await loadRecordings();
      }
    };
    doInitialDiscovery();

    return () => {
      window.removeEventListener("meeting-recorded", handleRecording);
    };
  }, []);

  const handleDelete = async (filePath: string) => {
    if (!confirm("Delete this recording?")) return;

    try {
      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (file && file instanceof TFile) {
        await plugin.app.vault.delete(file);
      }
      await metadataManager.removeRecording(filePath);
      await loadRecordings();
      new Notice("Recording deleted");
    } catch (error) {
      logger.error("Failed to delete recording", error);
      new Notice("Failed to delete recording");
    }
  };

  const handleOpenInVault = (filePath: string) => {
    const file = plugin.app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile) {
      plugin.app.workspace.openLinkText(filePath, "", true);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 1) {
      const seconds = Math.round(minutes * 60);
      return `${seconds} ${seconds === 1 ? "sec" : "sec"}`;
    }
    const wholeMinutes = Math.floor(minutes);
    const remainingSeconds = Math.round((minutes - wholeMinutes) * 60);

    if (wholeMinutes === 0) {
      return `${remainingSeconds} ${remainingSeconds === 1 ? "sec" : "sec"}`;
    }
    if (remainingSeconds === 0) {
      return `${wholeMinutes} ${wholeMinutes === 1 ? "min" : "min"}`;
    }
    return `${wholeMinutes} ${wholeMinutes === 1 ? "min" : "min"} ${remainingSeconds} ${remainingSeconds === 1 ? "sec" : "sec"}`;
  };

  if (isLoading) {
    return (
      <div className={tw("p-4 text-center text-[#7aa2f7]")}>
        Loading recordings...
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className={tw("p-4")}>
        <div className={tw("flex items-center justify-between mb-4")}>
          <h3 className={tw("text-lg font-medium text-[#bebebe]")}>
            Recent Meetings
          </h3>
          <button
            onClick={scanForRecordings}
            disabled={isScanning}
            className={tw(
              "flex items-center gap-1.5 px-2 py-1 text-xs",
              "bg-[#0d0b12] hover:bg-[rgba(14,210,247,0.04)]",
              "border border-[rgba(14,210,247,0.08)] rounded",
              "text-[#bebebe]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
            title="Scan vault for audio recordings"
          >
            {isScanning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Scan</span>
              </>
            )}
          </button>
        </div>
        <EmptyState message="No recordings yet. Start recording to see meetings here." />
      </div>
    );
  }

  return (
    <div className={tw("p-4 flex-1 overflow-y-auto")}>
      <div className={tw("flex items-center justify-between mb-4")}>
        <h3 className={tw("text-lg font-medium text-[#bebebe]")}>
          Recent Meetings
        </h3>
        <button
          onClick={scanForRecordings}
          disabled={isScanning}
          className={tw(
            "flex items-center gap-1.5 px-2 py-1 text-xs",
            "bg-[#0d0b12] hover:bg-[rgba(14,210,247,0.04)]",
            "border border-[rgba(14,210,247,0.08)] rounded",
            "text-[#bebebe]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
          title="Scan vault for audio recordings"
        >
          {isScanning ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              <span>Scan</span>
            </>
          )}
        </button>
      </div>

      <div className={tw("space-y-2")}>
        {recordings.map((recording) => {
          const file = plugin.app.vault.getAbstractFileByPath(
            recording.filePath
          ) as TFile | null;
          const fileSize = file?.stat?.size || 0;
          const isInRecordingsFolder = recording.filePath.startsWith(
            plugin.settings.recordingsFolderPath
          );

          return (
            <div
              key={recording.filePath}
              className={tw(
                "bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded p-3 hover:bg-[rgba(14,210,247,0.06)] hover:border-[rgba(14,210,247,0.15)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-200"
              )}
            >
              <div className={tw("flex items-start justify-between mb-2 gap-2")}>
                <div className={tw("flex-1 min-w-0 pr-2")}>
                  <div className={tw("flex items-start gap-2 mb-1 flex-wrap")}>
                    <span
                      className={tw("text-sm font-medium text-[#bebebe] break-all")}
                      title={recording.filePath.split("/").pop()}
                    >
                      {recording.filePath.split("/").pop()}
                    </span>
                    {recording.discovered && (
                      <span
                        className={tw(
                          "text-xs px-1.5 py-0.5 rounded bg-[rgba(14,210,247,0.15)] text-[#0fb6d6] font-medium"
                        )}
                      >
                        Discovered
                      </span>
                    )}
                    {!isInRecordingsFolder && (
                      <span
                        className={tw(
                          "text-xs px-1.5 py-0.5 rounded bg-[rgba(14,210,247,0.08)] text-[#7aa2f7]"
                        )}
                      >
                        {recording.filePath.split("/").slice(0, -1).join("/")}
                      </span>
                    )}
                  </div>
                  <div className={tw("text-xs text-[#7aa2f7] space-x-3")}>
                    <span>{formatDate(recording.createdAt)}</span>
                    {fileSize > 0 && <span>{formatFileSize(fileSize)}</span>}
                    {recording.duration && (
                      <span>{formatDuration(recording.duration)}</span>
                    )}
                    {recording.transcribed && (
                      <span className={tw("text-[#0fb6d6]")}>Transcribed</span>
                    )}
                  </div>
                </div>
                <div className={tw("flex items-center gap-1")}>
                  <Button
                    onClick={() => handleOpenInVault(recording.filePath)}
                    className={tw("p-1")}
                    title="Open in vault"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(recording.filePath)}
                    className={tw("p-1 text-[#f4569d]")}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className={tw("flex items-center gap-2 mt-2")}>
                <EnhanceNoteHandler
                  plugin={plugin}
                  recording={recording}
                  metadataManager={metadataManager}
                  onEnhanced={() => loadRecordings()}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
