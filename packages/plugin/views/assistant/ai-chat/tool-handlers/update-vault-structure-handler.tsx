import React from "react";
import { usePlugin } from "../../provider";
import type { ToolHandlerResult } from "./types";

interface UpdateVaultStructureArgs {
  newRules: string;
  reason: string;
}

interface UpdateVaultStructureHandlerProps {
  toolInvocation: any;
  handleAddResult: (result: string) => void;
}

export async function handleUpdateVaultStructure(
  args: UpdateVaultStructureArgs,
  plugin: any
): Promise<ToolHandlerResult> {
  try {
    if (!plugin.organizationPreferences) {
      return { success: false, error: "Cosmic Vault Structure service not initialized" };
    }
    await plugin.organizationPreferences.updateRules(args.newRules);
    plugin.organizationPreferences.invalidate();
    return {
      success: true,
      message: `Cosmic Vault Structure updated. Reason: ${args.reason}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function UpdateVaultStructureHandler({
  toolInvocation,
  handleAddResult,
}: UpdateVaultStructureHandlerProps) {
  const plugin = usePlugin();
  const hasExecutedRef = React.useRef(false);
  const [status, setStatus] = React.useState<string>("Updating Cosmic Vault Structure...");

  React.useEffect(() => {
    if (hasExecutedRef.current) return;
    if ("result" in toolInvocation) return;
    hasExecutedRef.current = true;

    const { newRules, reason } = toolInvocation.args as UpdateVaultStructureArgs;
    handleUpdateVaultStructure({ newRules, reason }, plugin).then(result => {
      setStatus(result.success ? (result.message || "Done") : `Error: ${result.error}`);
      handleAddResult(JSON.stringify(result));
    });
  }, [toolInvocation.toolCallId]);

  const isComplete = "result" in toolInvocation;

  return (
    <div className="text-sm p-2">
      <div className="font-medium mb-1" style={{ color: "var(--text-normal)" }}>
        {isComplete ? "✓ Cosmic Vault Structure updated" : `⏳ ${status}`}
      </div>
      {toolInvocation.args?.reason && (
        <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
          Reason: {toolInvocation.args.reason}
        </div>
      )}
    </div>
  );
}
