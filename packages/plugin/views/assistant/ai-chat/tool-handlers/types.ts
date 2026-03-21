import { App } from "obsidian";
import { ToolUIPart } from "ai";

export interface ToolHandlerProps {
  toolInvocation: ToolUIPart;
  handleAddResult: (result: string) => void;
  app: App;
}

export interface ToolHandlerResult {
  success: boolean;
  message?: string;
  error?: string;
}