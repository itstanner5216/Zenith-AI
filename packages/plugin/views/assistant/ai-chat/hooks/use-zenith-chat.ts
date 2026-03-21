import { useState, useCallback, useRef } from "react";
import { convertToModelMessages } from "ai";
import type { UIMessage, ToolSet, StepResult } from "ai";
import type { AIService } from "../../../../services/ai/ai-service";

/** Status states that match the existing ToolCallHandler's expectations */
export type ChatStatus = "ready" | "submitted" | "streaming";

export interface UseZenithChatOptions {
  aiService: AIService;
  tools?: ToolSet;
  maxSteps?: number;
  onFinish?: (message: UIMessage) => void;
  onError?: (error: Error) => void;
  onStepFinish?: (step: StepResult<any>) => void;
}

export interface UseZenithChatReturn {
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | null;
  sendMessage: (content: string, opts?: {
    context?: string;
    systemPrompt?: string;
  }) => Promise<void>;
  addToolResult: (result: { toolCallId: string; result: string }) => void;
  stop: () => void;
  reload: (opts?: { context?: string; systemPrompt?: string }) => Promise<void>;
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
}

/**
 * useZenithChat — replaces @ai-sdk/react's useChat.
 *
 * Calls AIService.streamChat() directly (no server needed).
 * Manages message state, streaming, tool result collection, abort, reload.
 */
export function useZenithChat(options: UseZenithChatOptions): UseZenithChatReturn {
  const { aiService, tools, maxSteps = 5, onFinish, onError, onStepFinish } = options;

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  /**
   * Core streaming function. Converts current messages to model format,
   * calls streamText, and processes the stream chunk by chunk.
   */
  const runStream = useCallback(async (
    currentMessages: UIMessage[],
    systemPrompt?: string,
  ) => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setStatus("submitted");

      const modelMessages = convertToModelMessages(currentMessages);

      const result = aiService.streamChat({
        messages: modelMessages,
        systemPrompt,
        tools,
        maxSteps,
        abortSignal: abortController.signal,
        onStepFinish,
      });

      // Create the assistant message shell
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [],
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStatus("streaming");

      let accumulatedText = "";

      // Process the text stream
      for await (const chunk of result.textStream) {
        if (abortController.signal.aborted) break;
        accumulatedText += chunk;

        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].id === assistantMessageId) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              parts: [{ type: "text" as const, text: accumulatedText }],
            };
          }
          return updated;
        });
      }

      // After stream completes, await the resolved Promises on StreamTextResult
      const [resolvedText, resolvedToolCalls] = await Promise.all([
        result.text,
        result.toolCalls,
      ]);

      // Build final parts from the response
      const finalParts: UIMessage["parts"] = [];

      // Add tool call parts using v6 tool-<toolName> pattern
      if (resolvedToolCalls && resolvedToolCalls.length > 0) {
        for (const tc of resolvedToolCalls) {
          finalParts.push({
            type: `tool-${tc.toolName}`,
            toolCallId: tc.toolCallId,
            input: tc.input,
            state: "input-available",
          } as any);
        }
      }

      // Add text part
      const finalText = resolvedText || accumulatedText;
      if (finalText) {
        finalParts.push({ type: "text" as const, text: finalText });
      }

      // Update the assistant message with final parts
      const finalMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: finalParts.length > 0 ? finalParts : [{ type: "text" as const, text: finalText }],
      };

      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].id === assistantMessageId) {
          updated[lastIdx] = finalMessage;
        }
        return updated;
      });

      onFinish?.(finalMessage);
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User cancelled — not an error
      } else {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    } finally {
      isGeneratingRef.current = false;
      abortControllerRef.current = null;
      setStatus("ready");
    }
  }, [aiService, tools, maxSteps, onFinish, onError, onStepFinish]);

  /** Send a new user message and stream the assistant response */
  const sendMessage = useCallback(async (
    content: string,
    opts?: { context?: string; systemPrompt?: string },
  ) => {
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text" as const, text: content }],
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Build system prompt with optional context
    let systemPrompt = opts?.systemPrompt || "";
    if (opts?.context) {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n<context>\n${opts.context}\n</context>`
        : `<context>\n${opts.context}\n</context>`;
    }

    await runStream(updatedMessages, systemPrompt || undefined);
  }, [messages, runStream]);

  /** Add a tool result — updates the matching tool part's state to output-available */
  const addToolResult = useCallback((result: { toolCallId: string; result: string }) => {
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.role !== "assistant") return msg;

        const updatedParts = msg.parts.map((part): typeof part => {
          if (
            part.type.startsWith("tool-") &&
            "toolCallId" in part &&
            (part as any).toolCallId === result.toolCallId
          ) {
            return {
              ...(part as any),
              state: "output-available",
              output: result.result,
            };
          }
          return part;
        });

        return { ...msg, parts: updatedParts };
      });
    });
  }, []);

  /** Stop the current generation */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  /** Reload: remove last assistant message and re-stream */
  const reload = useCallback(async (opts?: { context?: string; systemPrompt?: string }) => {
    // Find and remove the last assistant message
    const lastAssistantIdx = messages.findLastIndex(m => m.role === "assistant");
    if (lastAssistantIdx === -1) return;

    const messagesWithoutLast = messages.slice(0, lastAssistantIdx);
    setMessages(messagesWithoutLast);

    let systemPrompt = opts?.systemPrompt || "";
    if (opts?.context) {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n<context>\n${opts.context}\n</context>`
        : `<context>\n${opts.context}\n</context>`;
    }

    await runStream(messagesWithoutLast, systemPrompt || undefined);
  }, [messages, runStream]);

  return {
    messages,
    status,
    error,
    sendMessage,
    addToolResult,
    stop,
    reload,
    setMessages,
  };
}
