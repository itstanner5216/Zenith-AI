import React, { useRef, useState } from "react";
import { App, Notice } from "obsidian";
import { ToolInvocation } from "ai";

interface CreateTemplateHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

export function CreateTemplateHandler({
  toolInvocation,
  handleAddResult,
  app,
}: CreateTemplateHandlerProps) {
  const hasFetchedRef = useRef(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleConfirmCreate = async () => {
    const {
      templateName,
      templateContent,
      templateFolder = "Templates",
      description,
    } = toolInvocation.args;

    try {
      // Ensure templates folder exists
      const folderExists = app.vault.getAbstractFileByPath(templateFolder);
      if (!folderExists) {
        await app.vault.createFolder(templateFolder);
      }

      // Create template file path
      const templatePath = `${templateFolder}/${templateName}.md`;

      // Check if template already exists
      const existingFile = app.vault.getAbstractFileByPath(templatePath);
      if (existingFile) {
        const confirmOverwrite = confirm(
          `Template "${templateName}" already exists. Overwrite?`
        );
        if (!confirmOverwrite) {
          setIsDone(true);
          handleAddResult(
            JSON.stringify({
              success: false,
              message: "User cancelled template creation (already exists)",
            })
          );
          return;
        }
        await app.vault.modify(existingFile as any, templateContent);
      } else {
        await app.vault.create(templatePath, templateContent);
      }

      setIsDone(true);

      const message = `Created template "${templateName}" in ${templateFolder}/`;

      new Notice(message);

      handleAddResult(
        JSON.stringify({
          success: true,
          templatePath,
          message,
        })
      );
    } catch (error) {
      setIsDone(true);
      new Notice(`Failed to create template: ${error.message}`);
      handleAddResult(
        JSON.stringify({
          success: false,
          error: error.message,
        })
      );
    }
  };

  const handleCancel = () => {
    setIsDone(true);
    handleAddResult(
      JSON.stringify({
        success: false,
        message: "User cancelled template creation",
      })
    );
  };

  const {
    templateName,
    templateContent,
    description,
    message: reason,
  } = toolInvocation.args;
  const isComplete = "result" in toolInvocation;

  if (isComplete || isDone) {
    return (
      <div className="text-sm border-b border-[rgba(14,210,247,0.08)] pb-2">
        <div className="text-[#50fa7b] text-xs">
          {isDone && !isConfirmed
            ? "✗ Template creation cancelled"
            : "✓ Template created"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 border border-[rgba(14,210,247,0.08)]">
      <div className="flex items-start gap-2">
        <span className="text-[#0fb6d6] text-lg">📋</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[#bebebe] mb-1">
            Create Template
          </div>
          <div className="text-xs text-[#7aa2f7] mb-2">{reason}</div>
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[#7aa2f7] uppercase">
          Template Details
        </div>
        <div className="text-[#bebebe] pl-2">
          <strong>Name:</strong> {templateName}
        </div>
        <div className="text-[#bebebe] pl-2">
          <strong>Description:</strong> {description}
        </div>
      </div>

      <div className="text-xs space-y-1">
        <div className="font-semibold text-[#7aa2f7] uppercase">
          Template Preview
        </div>
        <div className="p-2 bg-[#191621] text-[#7aa2f7] font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
          {templateContent.slice(0, 300)}
          {templateContent.length > 300 && "..."}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-xs border border-[rgba(14,210,247,0.08)] hover:bg-[rgba(14,210,247,0.04)] text-[#bebebe]"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setIsConfirmed(true);
            handleConfirmCreate();
          }}
          className="flex-1 px-3 py-1.5 text-xs bg-[#0fb6d6] hover:bg-[rgba(14,210,247,0.8)] text-[#0d0b12] font-medium"
        >
          Create Template
        </button>
      </div>
    </div>
  );
}
