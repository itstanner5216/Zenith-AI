import * as React from "react";
import { tw } from "@/lib/utils";
import { StyledContainer } from "@/components/ui/utils";
import { Check, Clock, AlertCircle, Loader } from "lucide-react";
import { Action, FileRecord } from "../../../../inbox/services/record-manager";

interface ProcessingTimelineProps {
  record: FileRecord;
}

interface TimelineStep {
  action: Action;
  label: string;
  timestamp?: string;
  duration?: number;
  status: "pending" | "processing" | "completed" | "error" | "skipped";
}

export const ProcessingTimeline: React.FC<ProcessingTimelineProps> = ({ record }) => {
  const getSteps = (): TimelineStep[] => {
    const actionOrder: Action[] = [
      Action.VALIDATE,
      Action.CONTAINER,
      Action.MOVING_ATTACHMENT,
      Action.EXTRACT,
      Action.CLEANUP,
      Action.FETCH_YOUTUBE,
      Action.CLASSIFY,
      Action.MOVING,
      Action.RENAME,
      Action.FORMATTING,
      Action.APPEND,
      Action.TAGGING,
      Action.COMPLETED,
    ];

    return actionOrder.map(action => {
      const log = record.logs[action];
      const getLabel = (action: Action): string => {
        const labels: Record<Action, string> = {
          [Action.VALIDATE]: "Validate",
          [Action.CONTAINER]: "Container",
          [Action.MOVING_ATTACHMENT]: "Attachments",
          [Action.EXTRACT]: "Extract",
          [Action.CLEANUP]: "Cleanup",
          [Action.FETCH_YOUTUBE]: "YouTube",
          [Action.CLASSIFY]: "Classify",
          [Action.MOVING]: "Move",
          [Action.RENAME]: "Rename",
          [Action.FORMATTING]: "Format",
          [Action.APPEND]: "Append",
          [Action.TAGGING]: "Tags",
          [Action.COMPLETED]: "Complete",
        } as any;
        return labels[action] || action.toString();
      };

      let status: TimelineStep["status"] = "pending";
      if (log) {
        if (log.error) status = "error";
        else if (log.skipped) status = "skipped";
        else if (log.completed) status = "completed";
        else status = "processing";
      }

      return {
        action,
        label: getLabel(action),
        timestamp: log?.timestamp,
        status,
      };
    }).filter(step => step.status !== "pending"); // Only show steps that have started
  };

  const steps = getSteps();

  // Calculate durations between steps
  const stepsWithDuration = steps.map((step, index) => {
    if (index === 0) return { ...step, duration: 0 };

    const prevStep = steps[index - 1];
    if (step.timestamp && prevStep.timestamp) {
      const duration = new Date(step.timestamp).getTime() - new Date(prevStep.timestamp).getTime();
      return { ...step, duration };
    }
    return step;
  });

  const getStepIcon = (status: TimelineStep["status"]) => {
    switch (status) {
      case "completed":
        return <Check className={tw("w-4 h-4 text-[var(--text-accent)]")} style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.5))' }} />;
      case "processing":
        return <Loader className={tw("w-4 h-4 text-[var(--text-accent)] animate-spin")} style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.5))' }} />;
      case "error":
        return <AlertCircle className={tw("w-4 h-4 text-[var(--text-sub-accent)]")} />;
      case "skipped":
        return <div className={tw("w-4 h-4 rounded-full bg-[rgba(14,210,247,0.1)]")} />;
      default:
        return <Clock className={tw("w-4 h-4 text-[var(--text-dim)]")} />;
    }
  };

  const getStepColor = (status: TimelineStep["status"]) => {
    switch (status) {
      case "completed":
        return "bg-[var(--text-accent)]";
      case "processing":
        return "bg-[var(--text-accent)]";
      case "error":
        return "bg-[var(--text-sub-accent)]";
      default:
        return "bg-[rgba(14,210,247,0.1)]";
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (steps.length === 0) {
    return null;
  }

  return (
    <StyledContainer className={tw("bg-[var(--bg-depth-1)] rounded p-4 border border-[rgba(14,210,247,0.08)]")}>
      <div className={tw("flex items-center justify-between mb-4")}>
        <h4 className={tw("text-sm font-medium text-[var(--text-accent)]")}>Processing Timeline</h4>
        <div className={tw("text-xs")}>
          {record.status === "completed" && <span className="text-[var(--text-accent)]" style={{ textShadow: '0 0 8px rgba(14,210,247,0.5)' }}>✓ Completed</span>}
          {record.status === "processing" && <span className="text-[var(--text-accent)]">⏳ In Progress</span>}
          {record.status === "error" && <span className="text-[var(--text-sub-accent)]">⚠ Error</span>}
        </div>
      </div>

      <div className={tw("space-y-3")}>
        {stepsWithDuration.map((step, index) => (
          <div key={step.action} className={tw("flex items-start gap-3")}>
            {/* Timeline connector */}
            <div className={tw("flex flex-col items-center")}>
              <div className={`w-8 h-8 rounded-full bg-[var(--bg-depth-1)] border-2 flex items-center justify-center ${
                step.status === "completed" ? "border-[var(--text-accent)] shadow-[0_0_6px_rgba(14,210,247,0.3)]" :
                step.status === "error" ? "border-[var(--text-sub-accent)]" :
                step.status === "processing" ? "border-[var(--text-accent)] animate-[zenith-cyan-pulse_2s_ease-in-out_infinite]" :
                "border-[rgba(14,210,247,0.1)]"
              }`}>
                {getStepIcon(step.status)}
              </div>
              {index < stepsWithDuration.length - 1 && (
                <div className={`w-0.5 h-6 mt-1 opacity-50 ${getStepColor(step.status)}`} />
              )}
            </div>

            {/* Step details */}
            <div className={tw("flex-1 pb-2")}>
              <div className={tw("flex items-center justify-between")}>
                <span className={tw("text-sm font-medium text-[var(--text-normal)]")}>
                  {step.label}
                </span>
                {step.duration !== undefined && step.duration > 0 && (
                  <span className={tw("text-xs text-[var(--text-dim)] font-mono")} className="opacity-60">
                    {formatDuration(step.duration)}
                  </span>
                )}
              </div>
              {step.timestamp && (
                <div className={tw("text-xs text-[var(--text-dim)] mt-0.5")} className="opacity-40">
                  {formatTime(step.timestamp)}
                </div>
              )}
              {step.status === "skipped" && (
                <div className={tw("text-xs text-[var(--text-dim)] italic mt-1")} className="opacity-50">
                  Skipped
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      {record.status === "completed" && stepsWithDuration.length > 1 && (
        <div className={tw("mt-4 pt-4 border-t border-[rgba(14,210,247,0.08)]")}>
          <div className={tw("flex items-center justify-between text-xs")}>
            <span className={tw("text-[var(--text-dim)]")}>Total time:</span>
            <span className={tw("text-[var(--text-accent)] font-mono font-medium")}>
              {formatDuration(
                stepsWithDuration.reduce((sum, step) => sum + (step.duration || 0), 0)
              )}
            </span>
          </div>
        </div>
      )}
    </StyledContainer>
  );
};
