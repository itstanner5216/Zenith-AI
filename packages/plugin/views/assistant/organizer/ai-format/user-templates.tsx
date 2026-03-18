import * as React from "react";
import { TFile } from "obsidian";
import ZenithAI from "../../../../index";
import { logMessage } from "../../../../someUtils";
import { logger } from "../../../../services/logger";
import {
  cleanup,
  getTokenCount,
  initializeTokenCounter,
} from "../../../../utils/token-counter";

interface UserTemplatesProps {
  plugin: ZenithAI;
  file: TFile | null;
  content: string;
  refreshKey: number;
  onFormat: (templateName: string) => void;
  onTokenLimitError?: (error: string) => void;
}

export const UserTemplates: React.FC<UserTemplatesProps> = ({
  plugin,
  file,
  content,
  refreshKey,
  onFormat,
  onTokenLimitError,
}) => {
  const [templateNames, setTemplateNames] = React.useState<string[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = React.useState<
    string | null
  >(null);
  const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
  const [formatting, setFormatting] = React.useState<boolean>(false);
  const [contentLoadStatus, setContentLoadStatus] = React.useState<
    "loading" | "success" | "error"
  >("loading");
  const [classificationStatus, setClassificationStatus] = React.useState<
    "loading" | "success" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [isFileTooLarge, setIsFileTooLarge] = React.useState<boolean>(false);

  React.useEffect(() => {
    let isMounted = true;

    const checkTokenCount = async () => {
      try {
        await initializeTokenCounter();
        if (isMounted) {
          const tokenCount = getTokenCount(content);
          setIsFileTooLarge(tokenCount > 128000);
        }
      } catch (error) {
        console.error("Error checking token count:", error);
      }
    };

    checkTokenCount();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [content]);

  React.useEffect(() => {
    const fetchClassificationAndTemplates = async () => {
      if (!content || !file) {
        setContentLoadStatus("error");
        logger.error("No content or file available");
        return;
      }

      setContentLoadStatus("loading");
      setClassificationStatus("loading");

      try {
        const fileContent = await plugin.app.vault.read(file);
        if (typeof fileContent !== "string") {
          throw new Error("File content is not a string");
        }
        logMessage(fileContent, "fileContent");
        setContentLoadStatus("success");

        const fetchedTemplateNames = await plugin.getTemplateNames();
        setTemplateNames(fetchedTemplateNames);
        logMessage(fetchedTemplateNames, "fetchedTemplateNames");

        const classifiedAs = await plugin.classifyContentV2(
          fileContent,
          fetchedTemplateNames
        );
        logMessage(classifiedAs, "classifiedAs");

        const selectedClassification = fetchedTemplateNames.find(
          t => t.toLowerCase() === classifiedAs?.toLowerCase()
        );
        if (selectedClassification) {
          setSelectedTemplateName(selectedClassification);
        } else {
          console.warn(
            "No matching classification found, using empty classification"
          );
          setSelectedTemplateName(null);
        }
        setClassificationStatus("success");
      } catch (error) {
        logger.error("Error in fetchClassificationAndTemplates:", error);

        // Check if this is a token limit error
        if (error && typeof error === 'object' && 'status' in error && (error as any).status === 429) {
          const errorMessage = (error as any).message || "Token limit exceeded. Please upgrade your plan for more tokens.";
          // Notify parent component to show upgrade button
          onTokenLimitError?.(errorMessage);
        }

        setClassificationStatus("error");
      }
    };
    fetchClassificationAndTemplates();

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [content, file, plugin, refreshKey]);

  const getDisplayText = () => {
    if (selectedTemplateName) {
      return `Format as ${selectedTemplateName}`;
    }
    return "Select template";
  };

  const dropdownTemplates = templateNames.filter(
    t => t !== selectedTemplateName
  );

  const handleFormatClick = async () => {
    if (selectedTemplateName) {
      setFormatting(true);
      try {
        await onFormat(selectedTemplateName);
      } catch (error) {
        logger.error("Error formatting:", error);
      } finally {
        setFormatting(false);
      }
    }
  };

  const renderContent = () => {
    if (contentLoadStatus === "error" || classificationStatus === "error") {
      return (
        <div className="text-[#f4569d] p-2 bg-[rgba(244,86,157,0.08)] border border-[rgba(244,86,157,0.2)] rounded">
          Unable to process the content. Please try again later.
        </div>
      );
    }
    if (classificationStatus === "loading") {
      return (
        <div className="text-[#45aaff] p-2">Classifying content...</div>
      );
    }

    return (
      <div className="flex flex-col space-y-2">
        <div className="relative" ref={dropdownRef}>
          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-[#0d0b12] text-[#bebebe] border border-[rgba(14,210,247,0.08)] rounded hover:bg-[rgba(14,210,247,0.08)] hover:border-[rgba(14,210,247,0.15)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(14,210,247,0.45)] focus-visible:shadow-[0_0_6px_rgba(14,210,247,0.2)] transition-all duration-200"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span>{getDisplayText()}</span>
            <svg
              className="w-4 h-4 ml-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 9L12 15L18 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-[#191621] border border-[rgba(14,210,247,0.15)] rounded shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_6px_rgba(14,210,247,0.2)]">
              {dropdownTemplates.length > 0 ? (
                dropdownTemplates.map((templateName, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 cursor-pointer hover:bg-[rgba(14,210,247,0.08)] hover:shadow-[0_0_6px_rgba(14,210,247,0.2)] text-[#bebebe] transition-all duration-150"
                    onClick={() => {
                      setSelectedTemplateName(templateName);
                      setShowDropdown(false);
                    }}
                  >
                    {templateName}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-[#45aaff]">
                  No templates available
                </div>
              )}
            </div>
          )}
        </div>
        {isFileTooLarge && (
          <div className="text-[#f4569d] p-2 bg-[rgba(244,86,157,0.08)] border border-[rgba(244,86,157,0.2)] rounded">
            File is too large to format.
          </div>
        )}
        <button
          className={`px-4 py-2 transition-all duration-200 flex items-center justify-center rounded active:scale-[0.97] ${
            !selectedTemplateName || formatting
              ? "bg-[rgba(14,210,247,0.05)] text-[#45aaff] cursor-not-allowed border border-[rgba(14,210,247,0.05)]"
              : "bg-[rgba(14,210,247,0.15)] text-[#0fb6d6] border border-[rgba(14,210,247,0.45)] hover:bg-[rgba(14,210,247,0.25)] hover:border-[rgba(14,210,247,0.45)] hover:shadow-[0_0_6px_rgba(14,210,247,0.2)]"
          }`}
          disabled={!selectedTemplateName || formatting || isFileTooLarge}
          onClick={handleFormatClick}
        >
          {formatting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 zenith-spinner-glow"
                style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Applying...
            </span>
          ) : (
            "Apply"
          )}
        </button>
      </div>
    );
  };

  return <div className="">{renderContent()}</div>;
};
