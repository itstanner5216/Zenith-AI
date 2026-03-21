import { ItemView, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { Root, createRoot } from "react-dom/client";
import ZenithAI from "../..";
import { AppContext } from "./provider";
import AIChatSidebar from "./ai-chat/container";
import { StyledContainer } from "../../components/ui/utils";
import { tw } from "../../lib/utils";
import { MessageSquare, Bot } from "lucide-react";

export const ORGANIZER_VIEW_TYPE = "fo2k.assistant.sidebar2";

type Tab = "chat" | "scribe";

function ScribeView({ plugin }: { plugin: ZenithAI }) {
  const [isActive, setIsActive] = React.useState(
    () => plugin.backgroundScribe?.isActiveState ?? false
  );
  const [bufferCount, setBufferCount] = React.useState(
    () => plugin.backgroundScribe?.bufferCount ?? 0
  );
  const [lastSynth, setLastSynth] = React.useState<string | null>(null);
  const [isSynthing, setIsSynthing] = React.useState(false);

  React.useEffect(() => {
    const onChanged = () => {
      setIsActive(plugin.backgroundScribe?.isActiveState ?? false);
      setBufferCount(plugin.backgroundScribe?.bufferCount ?? 0);
    };
    plugin.app.workspace.on("zenith-ai:background-scribe-changed" as any, onChanged);
    return () => plugin.app.workspace.off("zenith-ai:background-scribe-changed" as any, onChanged);
  }, [plugin]);

  const handleSynthesizeNow = async () => {
    if (!plugin.backgroundScribe || isSynthing) return;
    setIsSynthing(true);
    try {
      await plugin.backgroundScribe.synthesizeTODO();
      setLastSynth(new Date().toLocaleTimeString());
      setBufferCount(0);
    } catch (e) {
      console.error("[Scribe] Manual synthesis failed:", e);
    } finally {
      setIsSynthing(false);
    }
  };

  return (
    <div className={tw("flex items-center gap-3 px-3 py-2 bg-[#0d0b12]")}>
      {/* Listening indicator */}
      <div className={tw("relative flex-shrink-0")}>
        <Bot className={tw("w-4 h-4", isActive ? "text-[#0fb6d6]" : "text-[#45aaff] opacity-30")} />
        {isActive && (
          <span className={tw("absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#0fb6d6] shadow-[0_0_4px_rgba(14,210,247,0.8)] animate-pulse")} />
        )}
      </div>

      {/* Status text */}
      <span className={tw("text-xs", isActive ? "text-[#0fb6d6]" : "text-[#45aaff] opacity-40")}>
        {isActive ? `Listening · ${bufferCount} turn${bufferCount !== 1 ? "s" : ""} buffered` : "Inactive"}
      </span>

      {lastSynth && (
        <span className={tw("text-[10px] text-[#50fa7b] opacity-70")}>✓ {lastSynth}</span>
      )}

      {/* Manual trigger */}
      {isActive && bufferCount > 0 && (
        <button
          onClick={handleSynthesizeNow}
          disabled={isSynthing}
          className={tw(
            "ml-auto text-[10px] px-2 py-0.5 rounded transition-all duration-150",
            isSynthing
              ? "text-[#45aaff] opacity-40 cursor-not-allowed"
              : "text-[#0fb6d6] border border-[rgba(14,210,247,0.2)] hover:bg-[rgba(14,210,247,0.08)] active:scale-[0.97]"
          )}
        >
          {isSynthing ? "Synthesizing…" : "Synthesize now"}
        </button>
      )}
    </div>
  );
}

function TabContent({
  activeTab,
  plugin,
  onTokenLimitError,
}: {
  activeTab: Tab;
  plugin: ZenithAI;
  onTokenLimitError?: (error: string) => void;
}) {
  React.useEffect(() => {
    if (activeTab === "scribe") {
      plugin.backgroundScribe?.activate();
    } else {
      plugin.backgroundScribe?.deactivate();
    }
  }, [activeTab, plugin]);

  if (activeTab === "scribe") {
    return (
      <div className={tw("flex flex-col h-full w-full")}>
        <ScribeView plugin={plugin} />
        <div className={tw("flex-1 min-h-0 border-t border-[rgba(14,210,247,0.08)]")}>
          <AIChatSidebar
            plugin={plugin}
            apiKey={plugin.settings.API_KEY}
            onTokenLimitError={onTokenLimitError}
            isChatTabActive={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={tw("flex flex-col h-full w-full")}>
      <AIChatSidebar
        plugin={plugin}
        apiKey={plugin.settings.API_KEY}
        onTokenLimitError={onTokenLimitError}
        isChatTabActive={true}
      />
    </div>
  );
}

function TabButton({
  isActive,
  onClick,
  icon,
  children,
  badge,
}: {
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={tw(
        "px-3 py-2 text-xs transition-all duration-150 relative flex items-center gap-1.5 cursor-pointer select-none",
        isActive
          ? "text-[#0fb6d6] font-semibold drop-shadow-[0_0_4px_rgba(14,210,247,0.4)]"
          : "text-[#45aaff] opacity-70 hover:opacity-100 hover:text-[#0fb6d6]"
      )}
      style={
        isActive
          ? {
              borderBottom: "2px solid #0fb6d6",
              marginBottom: "-1px",
              textShadow: "0 0 8px rgba(14,210,247,0.3)",
            }
          : { borderBottom: "2px solid transparent", marginBottom: "-1px" }
      }
    >
      {icon && <span className={tw("w-3.5 h-3.5 flex-shrink-0")}>{icon}</span>}
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className={tw(
            "ml-0.5 px-1.5 py-0.5 text-[9px] rounded-full font-semibold min-w-[1.1rem] text-center",
            badge > 0
              ? "bg-[rgba(244,86,157,0.2)] text-[#f4569d] shadow-[0_0_4px_rgba(244,86,157,0.3)]"
              : "bg-[rgba(14,210,247,0.15)] text-[#0fb6d6]"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function AssistantContent({
  plugin,
  initialTab,
  onTabChange,
}: {
  plugin: ZenithAI;
  initialTab: Tab;
  onTabChange: (setTab: (tab: Tab) => void) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<Tab>(initialTab);

  React.useEffect(() => {
    onTabChange(setActiveTab);
  }, [onTabChange]);

  return (
    <div className={tw("flex flex-col h-full w-full bg-[#0d0b12]")}>
      {/* Native tab navigation */}
      <div
        className={tw(
          "flex gap-0 px-3 pt-2 pb-0 border-b border-[rgba(14,210,247,0.08)] bg-[#0d0b12] items-center justify-between"
        )}
      >
        <div className={tw("flex gap-0")}>
          <TabButton
            isActive={activeTab === "chat"}
            onClick={() => setActiveTab("chat")}
            icon={<MessageSquare className="w-4 h-4" />}
          >
            Chat
          </TabButton>
          <TabButton
            isActive={activeTab === "scribe"}
            onClick={() => setActiveTab("scribe")}
            icon={<Bot className="w-4 h-4" />}
          >
            Scribe
          </TabButton>
        </div>
      </div>

      {/* Content area - Layer 2 */}
      <div className={tw("flex-1 min-h-0 w-full overflow-hidden bg-[#100e17]")}>
        <TabContent
          activeTab={activeTab}
          plugin={plugin}
          onTokenLimitError={undefined}
        />
      </div>
    </div>
  );
}

export class AssistantViewWrapper extends ItemView {
  root: Root | null = null;
  plugin: ZenithAI;
  private activeTab: Tab = "chat";
  private setActiveTab: (tab: Tab) => void = () => {};

  constructor(leaf: WorkspaceLeaf, plugin: ZenithAI) {
    super(leaf);
    this.plugin = plugin;

    this.plugin.addCommand({
      id: "open-scribe-tab",
      name: "Open Scribe Tab",
      callback: () => this.activateTab("scribe"),
    });

  }

  activateTab(tab: Tab) {
    // Ensure view is open
    this.plugin.app.workspace.revealLeaf(this.leaf);

    // Update tab
    this.activeTab = tab;
    this.setActiveTab(tab);
  }

  getViewType(): string {
    return ORGANIZER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Zenith-AI";
  }

  getIcon(): string {
    return "sparkle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.addClass("fo2k-view");
    this.root = createRoot(container);
    this.render();
  }

  render(): void {
    this.root?.render(
      <AppContext.Provider value={{ plugin: this.plugin, root: this.root }}>
        <React.StrictMode>
          <StyledContainer>
            <AssistantContent
              plugin={this.plugin}
              initialTab={this.activeTab}
              onTabChange={setTab => {
                this.setActiveTab = setTab;
              }}
            />
          </StyledContainer>
        </React.StrictMode>
      </AppContext.Provider>
    );
  }

  async onClose(): Promise<void> {
    this.containerEl.children[1].removeClass("fo2k-view");
    this.root?.unmount();
  }
}
