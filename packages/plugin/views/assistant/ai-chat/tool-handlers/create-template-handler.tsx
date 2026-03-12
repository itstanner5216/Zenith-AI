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
    <div className="p-3 space-y-3 bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
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
        <div className="p-2 bg-[#0d0b12] text-[#7aa2f7] font-mono text-xs max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-[rgba(14,210,247,0.06)]">
          {templateContent.slice(0, 300)}
          {templateContent.length > 300 && "..."}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[rgba(14,210,247,0.15)] text-[#bebebe] hover:bg-[rgba(14,210,247,0.06)] hover:border-[rgba(14,210,247,0.3)] hover:text-[#0fb6d6] active:scale-[0.97] transition-all duration-150"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setIsConfirmed(true);
            handleConfirmCreate();
          }}
          className="flex-1 px-3 py-1.5 text-xs rounded-md bg-[#0fb6d6] text-[#0d0b12] font-semibold hover:bg-[rgba(14,210,247,0.85)] active:scale-[0.97] transition-all duration-150 shadow-[0_0_6px_rgba(14,210,247,0.2)] hover:shadow-[0_0_10px_rgba(14,210,247,0.35)]"
        >
          Create Template
        </button>
      </div>
    </div>
  );
}
