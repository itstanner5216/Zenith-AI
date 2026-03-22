import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { moment, Notice, MarkdownView } from "obsidian";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Send, Square, Bot, Download } from "lucide-react";
import { StyledContainer } from "@/components/ui/utils";
import { Editor } from "@tiptap/react";

import ZenithAI from "../../..";
import Tiptap from "./tiptap";
import { usePlugin } from "../provider";

import { logMessage } from "../../../someUtils";
import { MessageRenderer } from "./message-renderer";
import ToolCallHandler from "./tool-handlers/tool-invocation-handler";
import { UIMessage, isTextUIPart } from "ai";
import { isPluginToolPart } from "./tool-handlers/types";
import { ContextLimitIndicator } from "./context-limit-indicator";
import { ModelSelector } from "./model-selector";
import { useZenithChat } from "./hooks/use-zenith-chat";
import { AIService } from "../../../services/ai/ai-service";
import { createPluginTools } from "../../../services/ai/tool-adapter";
import { logger } from "../../../services/logger";
import { SubmitButton } from "./submit-button";
import {
  getUniqueReferences,
  useContextItems,
  clearEphemeralContext,
} from "./use-context-items";
import { ContextItems } from "./components/context-items";
import { useCurrentFile } from "./hooks/use-current-file";
import { ExamplePrompts } from "./components/example-prompts";
import { AttachmentHandler } from "./components/attachment-handler";
import { LocalAttachment } from "./types/attachments";
import {
  useEditorSelection,
  formatEditorContextForAI,
  EditorSelectionContext,
} from "./use-editor-selection";
import { EditorContextBadge } from "./components/editor-context-badge";
import {
  ChatHistoryManager,
  ChatSession,
} from "./services/chat-history-manager";
import { ChatHistoryCombobox } from "./components/chat-history-combobox";
import {
  exportChatToVault,
  copyChatToClipboard,
} from "./export-chat-as-markdown";
import { tw } from "../../../lib/utils";

interface ChatComponentProps {
  plugin: ZenithAI;
  inputRef: React.RefObject<HTMLDivElement | null>;
  onTokenLimitError?: (error: string) => void;
  activeChatId: string | null;
  onSessionUpdate?: (session: ChatSession) => void;
  chatSessions?: ChatSession[];
  onSelectChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  isChatTabActive?: boolean;
}

export const ChatComponent: React.FC<ChatComponentProps> = ({
  inputRef,
  onTokenLimitError,
  activeChatId,
  onSessionUpdate,
  chatSessions = [],
  onSelectChat,
  onDeleteChat,
  isChatTabActive,
}) => {
  const plugin = usePlugin();
  const app = plugin.app;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasScribe, setHasScribe] = useState(!!plugin.backgroundScribe);
  const [scribeActive, setScribeActive] = useState(plugin.backgroundScribe?.isActiveState ?? false);

  // Keep scribe UI state in sync with plugin events
  useEffect(() => {
    const handler = () => {
      setHasScribe(!!plugin.backgroundScribe);
      setScribeActive(plugin.backgroundScribe?.isActiveState ?? false);
    };
    const ref = app.workspace.on("zenith-ai:background-scribe-changed" as any, handler);
    return () => app.workspace.off("zenith-ai:background-scribe-changed" as any, handler);
  }, [app.workspace, plugin]);

  // Chat history manager instance
  const chatHistoryManager = useMemo(
    () => ChatHistoryManager.getInstance(plugin.app),
    [plugin.app]
  );

  // Ref to access Tiptap editor
  const tiptapEditorRef = useRef<Editor | null>(null);

  // Exact context used when generating each assistant message
  // Keyed by message ID (from onFinish) for reliable lookup
  const contextByAssistantIdRef = useRef<Record<string, string>>({});

  // Context used by the most recent request (so onFinish can store it)
  const lastContextSentRef = useRef<string>("");

  // Ref to track latest messages for onFinish (to avoid stale closure)
  const messagesRef = useRef<UIMessage[]>([]);

  // Ref to track if we're currently loading a session (to prevent save on load)
  const isLoadingSessionRef = useRef<boolean>(false);

  // Ref to store onSessionUpdate callback to avoid dependency issues
  const onSessionUpdateRef = useRef(onSessionUpdate);
  onSessionUpdateRef.current = onSessionUpdate;

  // Ref to store activeChatId to access it in callbacks
  const activeChatIdRef = useRef<string | null>(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const {
    setCurrentFile,
    files,
    folders,
    tags,
    searchResults,
    currentFile,
    textSelections,
  } = useContextItems();

  const uniqueReferences = getUniqueReferences();
  logger.debug("uniqueReferences", uniqueReferences);

  // Track editor selection for contextual understanding
  // Uses frozen context to preserve selection even when chat input gets focus
  const {
    current: currentEditorContext,
    frozen: frozenEditorContext,
    clearFrozen,
  } = useEditorSelection(app);

  const editorContext = frozenEditorContext;

  const contextItems = {
    files,
    folders,
    tags,
    currentFile,
    searchResults,
    textSelections,
  };

  // Track if chat has started (will be computed after useZenithChat hook)
  const [chatHasStarted, setChatHasStarted] = useState(false);

  const contextString = React.useMemo(() => {
    return JSON.stringify(contextItems);
  }, [contextItems]);
  logger.debug("contextString", contextString);

  const [activeModelConfigId, setActiveModelConfigId] = useState(
    plugin.settings.activeModelConfigId
  );

  const aiService = useMemo(() => new AIService(plugin.settings), [plugin.settings]);
  const pluginTools = useMemo(() => createPluginTools(), []);

  const {
    status,
    messages,
    sendMessage,
    addToolResult,
    stop,
    error,
    reload,
    setMessages,
  } = useZenithChat({
    aiService,
    tools: pluginTools,
    maxSteps: 5,
    onError: error => {
      logger.error("Chat error:", error);
      setErrorMessage(error.message || "An error occurred");
    },
    onFinish: message => {
      const contextUsed = lastContextSentRef.current;
      if (message.id) {
        contextByAssistantIdRef.current[message.id] = contextUsed;
      }
      clearEphemeralContext();
      const currentActiveChatId = activeChatIdRef.current;
      if (currentActiveChatId) {
        const currentMessages = messagesRef.current;
        chatHistoryManager.updateSession(currentActiveChatId, {
          messages: currentMessages.concat(message) as any,
        });
        onSessionUpdateRef.current?.({
          ...chatHistoryManager.getSession(currentActiveChatId)!,
          messages: currentMessages.concat(message) as any,
        });
      }
      plugin.app.workspace.trigger("vault-intelligence:chat-turn" as any, {
        sessionId: currentActiveChatId,
        message,
        context: contextUsed,
      });
    },
  });

  // Update messagesRef and chatHasStarted when messages change (must be after useZenithChat)
  useEffect(() => {
    messagesRef.current = messages;
    setChatHasStarted(messages.length > 0);
  }, [messages]);

  // skip the use context items entirely (chatHasStarted is now available)
  useCurrentFile({
    app,
    setCurrentFile,
    chatHasStarted,
  });

  // Derive isGenerating from status (replacement for deprecated isLoading)
  const isGenerating = status === "streaming" || status === "submitted";

  // Check if there are tool invocations (executing or waiting for AI response)
  const hasToolActivity = React.useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return false;

    // Extract tool parts from message.parts (v5 direction via parts, not toolInvocations)
    const toolParts = (lastMessage.parts ?? []).filter(isPluginToolPart);

    if (toolParts.length === 0) return false;

    const hasExecutingTools = toolParts.some(
      part => part.state === "input-available",
    );

    const allToolsComplete = toolParts.every(
      part => part.state === "output-available",
    );
    const waitingForAI = allToolsComplete;

    return hasExecutingTools || waitingForAI;
  }, [messages]);

  // Show loading indicator when:
  // 1. Status is "submitted" (initial request)
  // 2. Tools are executing (before results appear)
  // 3. Tools are complete but AI hasn't started streaming yet
  const showLoadingIndicator =
    status === "submitted" || (hasToolActivity && status !== "streaming");

  // Helper to normalize message with timestamp
  const normalizeMessage = (
    msg: UIMessage,
    existingTimestamp?: number
  ): any => {
    const normalized = { ...msg } as any;
    if (existingTimestamp) {
      normalized.createdAt = existingTimestamp;
    } else if ((msg as any).createdAt instanceof Date) {
      normalized.createdAt = (msg as any).createdAt.getTime();
    } else if (typeof (msg as any).createdAt === "number") {
      normalized.createdAt = (msg as any).createdAt;
    } else {
      // New message, add timestamp
      normalized.createdAt = Date.now();
    }
    return normalized;
  };

  // Track messages with timestamps (convert Date to number for consistency)
  const [messagesWithTimestamps, setMessagesWithTimestamps] = useState<
    Array<any>
  >([]);

  // Sync messages with timestamps
  useEffect(() => {
    setMessagesWithTimestamps(prev => {
      return messages.map(msg => {
        // Find existing message to preserve timestamp
        const existing = prev.find(m => m.id === msg.id);
        return normalizeMessage(msg, existing?.createdAt);
      });
    });
  }, [messages]);

  // Load messages when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      isLoadingSessionRef.current = true;
      const session = chatHistoryManager.getSession(activeChatId);
      if (session && session.messages.length > 0) {
        setMessages(session.messages as any);

        // Restore context snapshots from saved session
        if (session.messageContextSnapshots) {
          Object.entries(session.messageContextSnapshots).forEach(
            ([messageId, context]) => {
              contextByAssistantIdRef.current[messageId] = context;
            }
          );
        }

        // Restore context items from saved session
        if (session.contextItems) {
          const store = useContextItems.getState();

          // Clear current context items
          store.clearAll();

          // Restore saved context items
          if (session.contextItems.files) {
            Object.values(session.contextItems.files).forEach(file => {
              store.addFile(file);
            });
          }
          if (session.contextItems.folders) {
            Object.values(session.contextItems.folders).forEach(folder => {
              store.addFolder(folder);
            });
          }
          if (session.contextItems.tags) {
            Object.values(session.contextItems.tags).forEach(tag => {
              store.addTag(tag);
            });
          }
          if (session.contextItems.searchResults) {
            Object.values(session.contextItems.searchResults).forEach(
              search => {
                store.addSearchResults(search);
              }
            );
          }
          if (session.contextItems.textSelections) {
            Object.values(session.contextItems.textSelections).forEach(
              selection => {
                store.addTextSelection(selection);
              }
            );
          }
          if (session.contextItems.currentFile) {
            // Set current file and enable display (includeCurrentFile must be true to show it)
            useContextItems.setState({
              currentFile: session.contextItems.currentFile,
              includeCurrentFile: true, // Enable display of restored current file
            });
            console.log(
              "[Chat] ✅ Restored current file:",
              session.contextItems.currentFile.title
            );
          }

          console.log(
            "[Chat] ✅ Restored context items for session:",
            activeChatId,
            {
              filesCount: Object.keys(session.contextItems.files || {}).length,
              foldersCount: Object.keys(session.contextItems.folders || {})
                .length,
              tagsCount: Object.keys(session.contextItems.tags || {}).length,
              hasCurrentFile: !!session.contextItems.currentFile,
              includeCurrentFile: useContextItems.getState().includeCurrentFile,
            }
          );
        }
      } else {
        // New or empty session
        const store = useContextItems.getState();
        store.clearAll();
        setMessages([]);

        // Add current file to context for new chats (only if session has no saved context items)
        // This ensures we only add current file for brand new chats, not when loading existing empty sessions
        if (!session || !session.contextItems) {
          const activeFile = app.workspace.getActiveFile();
          if (activeFile && activeFile.extension === "md") {
            // Only add markdown files (skip media files)
            app.vault
              .cachedRead(activeFile)
              .then(content => {
                const fileContextItem = {
                  id: activeFile.path,
                  type: "file" as const,
                  path: activeFile.path,
                  title: activeFile.basename,
                  content,
                  reference: "Current File",
                  createdAt: activeFile.stat.ctime,
                };

                // Set as current file and ensure includeCurrentFile is enabled
                // clearAll() sets includeCurrentFile to false, so we need to enable it
                // Use setState to update both currentFile and includeCurrentFile at once
                useContextItems.setState({
                  currentFile: fileContextItem,
                  includeCurrentFile: true, // Enable display of current file
                });

                console.log(
                  "[Chat] ✅ Added current file to new chat context:",
                  {
                    filename: activeFile.basename,
                    includeCurrentFile:
                      useContextItems.getState().includeCurrentFile,
                    currentFile: useContextItems.getState().currentFile?.title,
                  }
                );
              })
              .catch(error => {
                console.warn(
                  "[Chat] Failed to read current file for new chat:",
                  error
                );
              });
          }
        }
      }
      // Reset loading flag after a brief delay to allow state to update
      setTimeout(() => {
        isLoadingSessionRef.current = false;
      }, 100);
    } else {
      // No active chat - clear context items
      const store = useContextItems.getState();
      store.clearAll();
      setMessages([]);
      isLoadingSessionRef.current = false;
    }
  }, [activeChatId, chatHistoryManager]);

  // Track last saved message state to prevent unnecessary saves
  const lastSavedMessagesRef = useRef<string>("");

  // Save messages when they change (debounced via manager)
  useEffect(() => {
    // Don't save if we're currently loading a session
    if (isLoadingSessionRef.current) {
      return;
    }

    if (activeChatId && messages.length > 0) {
      // Create a stable key from messages to detect actual changes
      const messagesKey = `${activeChatId}-${messages.length}-${messages
        .map(m => m.id)
        .join(",")}`;

      // Skip if we've already saved this exact state
      if (lastSavedMessagesRef.current === messagesKey) {
        return;
      }

      const session = chatHistoryManager.getSession(activeChatId);
      if (session) {
        // Auto-generate title from first user message if title is still "New Chat"
        let title = session.title;
        if (title === "New Chat") {
          const generatedTitle =
            ChatHistoryManager.generateTitleFromMessages(messages as any);
          title = generatedTitle;
        }

        // Store context snapshot for reference
        // Context is always built fresh from current vault state when sending messages,
        // but we store a snapshot for reference
        // Note: We read files/folders/tags/currentFile from closure, but don't include them in deps
        // to avoid infinite loops - context metadata is just for reference
        const contextMetadata = {
          filesCount: Object.keys(files).length,
          foldersCount: Object.keys(folders).length,
          tagsCount: Object.keys(tags).length,
          hasCurrentFile: !!currentFile,
          currentFile: currentFile?.title || null,
          timestamp: Date.now(),
        };

        // Store context snapshots for assistant messages (for refresh functionality)
        const messageContextSnapshots: Record<string, string> = {};
        messages.forEach(msg => {
          if (
            msg.role === "assistant" &&
            msg.id &&
            contextByAssistantIdRef.current[msg.id]
          ) {
            messageContextSnapshots[msg.id] =
              contextByAssistantIdRef.current[msg.id];
          }
        });

        // Store context items to restore when switching chats
        const contextItemsToStore = {
          files: { ...files },
          folders: { ...folders },
          tags: { ...tags },
          searchResults: { ...searchResults },
          textSelections: { ...textSelections },
          currentFile: currentFile ? { ...currentFile } : null,
        };

        chatHistoryManager.updateSession(activeChatId, {
          messages: messages as any,
          title,
          contextSnapshot: JSON.stringify(contextMetadata),
          messageContextSnapshots,
          contextItems: contextItemsToStore,
        });

        // Mark as saved
        lastSavedMessagesRef.current = messagesKey;

        // Notify parent of update - use ref to avoid dependency issues
        if (onSessionUpdateRef.current) {
          const updatedSession = chatHistoryManager.getSession(activeChatId);
          if (updatedSession) {
            // Use setTimeout to defer callback to next tick, preventing render loops
            setTimeout(() => {
              onSessionUpdateRef.current?.(updatedSession);
            }, 0);
          }
        }
      }
    }
  }, [messages, activeChatId, chatHistoryManager]);

  // Save context items when they change (independent of messages)
  useEffect(() => {
    // Don't save if we're currently loading a session
    if (isLoadingSessionRef.current) {
      return;
    }

    if (activeChatId) {
      const session = chatHistoryManager.getSession(activeChatId);
      if (session) {
        // Store context items to restore when switching chats
        const contextItemsToStore = {
          files: { ...files },
          folders: { ...folders },
          tags: { ...tags },
          searchResults: { ...searchResults },
          textSelections: { ...textSelections },
          currentFile: currentFile ? { ...currentFile } : null,
        };

        // Only update if context items actually changed
        const currentContextKey = JSON.stringify(contextItemsToStore);
        const savedContextKey = session.contextItems
          ? JSON.stringify(session.contextItems)
          : "";

        if (currentContextKey !== savedContextKey) {
          chatHistoryManager.updateSession(activeChatId, {
            contextItems: contextItemsToStore,
          });

          console.log(
            "[Chat] ✅ Saved context items for session:",
            activeChatId
          );
        }
      }
    }
  }, [
    files,
    folders,
    tags,
    searchResults,
    textSelections,
    currentFile,
    activeChatId,
    chatHistoryManager,
  ]);

  const toggleScribe = useCallback(() => {
    if (!plugin.backgroundScribe) return;
    if (scribeActive) {
      plugin.backgroundScribe.deactivate();
      setScribeActive(false);
    } else {
      const activated = plugin.backgroundScribe.activate();
      if (!activated) {
        new Notice("Background Scribe is disabled in settings. Enable it in Settings → Advanced → Chat Features.");
      } else {
        setScribeActive(true);
      }
    }
  }, [plugin.backgroundScribe, scribeActive]);

  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [exportMenuPosition, setExportMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!exportMenuOpen || !exportButtonRef.current) {
      setExportMenuPosition(null);
      return;
    }
    const updatePosition = () => {
      const btn = exportButtonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setExportMenuPosition({
        top: rect.top,
        right: window.innerWidth - rect.left + 4,
      });
    };
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = exportMenuRef.current?.contains(target);
      const inMenu = exportDropdownRef.current?.contains(target);
      if (!inTrigger && !inMenu) setExportMenuOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [exportMenuOpen]);

  const handleExportSaveAsNote = useCallback(() => {
    setExportMenuOpen(false);
    const sessionTitle = activeChatId
      ? chatHistoryManager.getSession(activeChatId)?.title ?? null
      : null;
    exportChatToVault(app, messages as any, sessionTitle);
  }, [activeChatId, chatHistoryManager, app, messages]);

  const handleExportCopy = useCallback(() => {
    setExportMenuOpen(false);
    const sessionTitle = activeChatId
      ? chatHistoryManager.getSession(activeChatId)?.title ?? null
      : null;
    copyChatToClipboard(messages as any, sessionTitle);
  }, [activeChatId, chatHistoryManager, messages]);

  const handleAttachmentsChange = useCallback(
    (newAttachments: LocalAttachment[]) => {
      setAttachments(newAttachments);
    },
    []
  );

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status !== "ready") {
      stop();
      return;
    }

    const editor = tiptapEditorRef.current;
    const editorContent = editor?.getText() || "";
    if (!editorContent.trim()) return;

    if (!plugin.settings.activeModelConfigId) {
      new Notice("No model configured. Go to Settings → Providers to set up a model.", 5000);
      return;
    }

    const store = useContextItems.getState();
    const freshContextItems = {
      files: store.files || {},
      folders: store.folders || {},
      tags: store.tags || {},
      currentFile: store.currentFile || null,
      searchResults: store.searchResults || {},
      textSelections: store.textSelections || {},
    };
    const contextJson = JSON.stringify(freshContextItems);

    const contextFilePaths = [
      ...Object.values(freshContextItems.files).map((f: { path: string }) => f.path),
      ...(freshContextItems.currentFile &&
      !Object.values(freshContextItems.files).some(
        (f: { path: string }) => f.path === freshContextItems.currentFile?.path
      )
        ? [freshContextItems.currentFile.path]
        : []),
    ];
    const filePathsBlock =
      contextFilePaths.length > 0
        ? `Attached file paths — use these exact strings for mergeFiles sourceFiles, deleteFiles filePaths (do not modify):
${contextFilePaths.join("\n")}

`
        : "";
    const freshContextString = filePathsBlock + contextJson;

    let freshEditorContext = "";
    try {
      const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (view && view.editor) {
        freshEditorContext = formatEditorContextForAI({
          selectedText: view.editor.getSelection(),
          cursorPosition: view.editor.getCursor(),
          currentLine: view.editor.getLine(view.editor.getCursor().line),
          lineNumber: view.editor.getCursor().line,
          hasSelection: view.editor.getSelection().length > 0,
          filePath: view.file?.path || null,
          fileName: view.file?.basename || null,
          selection: view.editor.getSelection().length > 0
            ? { anchor: view.editor.getCursor("from"), head: view.editor.getCursor("to") }
            : null,
        });
      }
    } catch (err) {
      logger.warn("Failed to get editor context:", err);
    }

    const fullContext = freshEditorContext
      ? `${freshContextString}

${freshEditorContext}`
      : freshContextString;

    lastContextSentRef.current = fullContext;

    editor?.commands.setContent("");

    await sendMessage(editorContent, { context: fullContext });

    setAttachments([]);
  };



  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(event as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevChatTabActiveRef = useRef<boolean | undefined>(undefined);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const wasActive = prevChatTabActiveRef.current;
    prevChatTabActiveRef.current = isChatTabActive;
    if (isChatTabActive && wasActive === false) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [isChatTabActive]);

  const [maxContextSize] = useState(80 * 1000); // Keep this one



  const handleExampleClick = (example: string) => {
    tiptapEditorRef.current?.commands.setContent(example);
  };

  const handleRetry = () => {
    setErrorMessage(null);
    reload();
  };

  const handleDismissError = () => {
    setErrorMessage(null);
  };

  const handleNewChat = () => {
    // Note: New chat creation is now handled by container
    // This is kept for backward compatibility but may not be used
    setMessages([]);
    setMessagesWithTimestamps([]);
    setErrorMessage(null);
  };



  const handleMessageRefresh = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    const trimmed = messages.slice(0, messageIndex);
    setMessages(trimmed);

    const store = useContextItems.getState();
    const contextJson = JSON.stringify({
      files: store.files || {},
      folders: store.folders || {},
      tags: store.tags || {},
      currentFile: store.currentFile || null,
      searchResults: store.searchResults || {},
      textSelections: store.textSelections || {},
    });
    lastContextSentRef.current = contextJson;

    await reload({ context: contextJson });
  };

  return (
    <StyledContainer className="flex flex-col h-full w-full max-h-full overflow-hidden">
      {/* Chat Header - minimal */}
      <div className="flex-none border-b border-defined px-3 py-1.5 bg-depth-1">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            {/* Export chat as markdown - menu rendered in portal so it isn't clipped by overflow-hidden */}
            <div ref={exportMenuRef}>
              <button
                ref={exportButtonRef}
                type="button"
                title="Export chat as markdown"
                disabled={messages.length === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setExportMenuOpen((open) => !open);
                }}
                className={tw(
                  "clickable-icon flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                  messages.length === 0
                    ? "text-dim cursor-not-allowed opacity-50"
                    : "text-dim hover:text-neon-cyan hover:bg-[var(--border-defined)]"
                )}
                aria-label="Export chat as markdown"
              >
                <Download className="w-4 h-4" />
              </button>
              {exportMenuOpen &&
                exportMenuPosition &&
                createPortal(
                  <div
                    ref={exportDropdownRef}
                    role="menu"
                    className={tw(
                      "min-w-[200px] py-1 rounded-md border border-accent-border",
                      "bg-depth-3 shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_6px_rgba(14,210,247,0.2)]"
                    )}
                    style={{
                      position: "fixed",
                      top: exportMenuPosition.top,
                      right: exportMenuPosition.right,
                      zIndex: 10000,
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={tw(
                        "w-full text-left px-3 py-2 text-sm text-foreground whitespace-nowrap",
                        "hover:bg-[var(--border-defined)]"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportSaveAsNote();
                      }}
                    >
                      Save as note in vault
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={tw(
                        "w-full text-left px-3 py-2 text-sm text-foreground whitespace-nowrap",
                        "hover:bg-[var(--border-defined)]"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportCopy();
                      }}
                    >
                      Copy to clipboard
                    </button>
                  </div>,
                  document.body
                )}
            </div>
            {/* Chat History Combobox - Always show if we have callbacks */}
            {onSelectChat && onDeleteChat && (
              <ChatHistoryCombobox
                sessions={chatSessions || []}
                activeChatId={activeChatId}
                onSelectChat={onSelectChat}
                onDeleteChat={onDeleteChat}
                app={app}
              />
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages - compressed spacing */}
      <div className="flex-1 overflow-y-auto px-3 py-2 bg-depth-2">
        <div className="flex flex-col space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ExamplePrompts onExampleClick={handleExampleClick} />
            </div>
          ) : (
            messages.map(message => {
              const toolParts = (message.parts ?? []).filter(isPluginToolPart);

              return (
                <React.Fragment key={message.id}>
                  {/* Render tool parts FIRST so they appear above the message content */}
                  {toolParts.map(part => (
                    <ToolCallHandler
                      key={part.toolCallId}
                      part={part}
                      addToolResult={addToolResult}
                      app={app}
                      chatStatus={status}
                    />
                  ))}
                  {/* Finally render the message content (summary) so it appears below tool invocations */}
                  <MessageRenderer
                    message={
                      messagesWithTimestamps.find(m => m.id === message.id) ||
                      normalizeMessage(message)
                    }
                    onMessageRefresh={handleMessageRefresh}
                  />
                </React.Fragment>
              );
            })
          )}

          {showLoadingIndicator && (
            <div className="flex items-center gap-3 py-2.5">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(14,210,247,0.15)_0%,transparent_70%)] animate-[zenith-typing-pulse_2s_ease-in-out_infinite]" />
                <Bot
                  size={16}
                  className="text-neon-cyan relative z-10 drop-shadow-glow-cyan-sm"
                />
              </div>

              <div className="h-8 flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-[zenith-dot-pulse_1.4s_ease-in-out_infinite] [animation-delay:0ms]"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-[zenith-dot-pulse_1.4s_ease-in-out_infinite] [animation-delay:200ms]"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-[zenith-dot-pulse_1.4s_ease-in-out_infinite] [animation-delay:400ms]"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(14,210,247,0.4))' }}
                />
              </div>
            </div>
          )}

          {/* Error message - renders as normal message in chat flow */}
          {errorMessage && (
            <div className="flex items-start gap-2 py-1.5 border-b border-subtle pb-2">
              <div className="w-4 text-xs text-neon-pink">⚠</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neon-pink font-medium">
                    Error
                  </div>
                  <button
                    onClick={handleDismissError}
                    className="text-dim hover:text-foreground text-xs"
                    title="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap select-text">
                  {errorMessage}
                </div>
                <Button
                  onClick={handleRetry}
                  variant="ghost"
                  size="sm"
                  className="text-xs mt-1 hover:bg-[var(--border-defined)]"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Unified Command Center Footer */}
      <div className="flex-none border-t border-defined bg-depth-1">
        <form onSubmit={handleSendMessage} className="p-3" role="form" aria-label="Chat message input form">
          {/* Row 1: Context attachments - compact chips */}
          <div className="mb-2" role="region" aria-label="Context attachments">
            <ContextItems />
          </div>

          {/* File attachments - drag and drop */}
          <AttachmentHandler
            onAttachmentsChange={handleAttachmentsChange}
          />

          {/* Row 2: Input area with embedded send button */}
          <div className="relative" ref={inputRef}>
            {/* Show editor context badge if we have selection */}
            <EditorContextBadge context={editorContext} onClear={clearFrozen} />
            <Tiptap
              value=""
              onChange={() => {}}
              onKeyDown={handleKeyDown}
              editorRef={tiptapEditorRef}
            />
            {/* Embedded controls - bottom right corner of input */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button
                type="submit"
                className={`flex items-center justify-center transition-all rounded-md w-8 h-8 ${
                  isGenerating
                    ? "text-dim cursor-pointer opacity-80 hover:opacity-100"
                    : "text-depth-2 bg-neon-cyan hover:bg-[rgba(14,210,247,0.8)] shadow-[0_0_8px_rgba(14,210,247,0.3)] hover:shadow-[0_0_14px_rgba(14,210,247,0.5)] active:scale-[0.93] transition-all duration-150"
                }`}
                title={isGenerating ? "Stop generating" : "Send message"}
                aria-label={isGenerating ? "Stop generating" : "Send message"}
              >
                {isGenerating ? (
                  <Square className="w-4 h-4" fill="currentColor" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Row 3: Modifier bar - subtle toggles and status */}
          <div className="flex items-center justify-between mt-1.5 text-xs text-dim">
            <div className="flex items-center gap-3">
              <ContextLimitIndicator
                unifiedContext={contextString}
                maxContextSize={maxContextSize}
              />
              {hasScribe && (
                <button
                  onClick={toggleScribe}
                  className={tw(
                    "px-2 py-1 text-[10px] rounded transition-all duration-150 border",
                    scribeActive
                      ? "bg-[var(--border-defined)] text-neon-cyan border-accent-border shadow-glow-cyan-sm"
                      : "text-dim border-subtle hover:text-neon-cyan hover:border-defined"
                  )}
                  title={scribeActive ? "Background Scribe: Active" : "Background Scribe: Inactive"}
                >
                  {scribeActive ? "⏸ Scribe" : "▶ Scribe"}
                </button>
              )}
            </div>
            <ModelSelector
              selectedModelConfigId={activeModelConfigId}
              onModelSelect={setActiveModelConfigId}
            />
          </div>
        </form>
      </div>
    </StyledContainer>
  );
};
