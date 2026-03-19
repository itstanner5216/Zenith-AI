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

function TabContent({
  activeTab,
  plugin,
  onTokenLimitError,
}: {
  activeTab: Tab;
  plugin: ZenithAI;
  onTokenLimitError?: (error: string) => void;
}) {
  return (
    <div className={tw("flex flex-col h-full w-full")}>
      <div
        className={tw(
          "flex-1 min-h-0 w-full",
          activeTab === "chat" ? "flex flex-col" : "hidden"
        )}
      >
        <AIChatSidebar
          plugin={plugin}
          apiKey={plugin.settings.API_KEY}
          onTokenLimitError={onTokenLimitError}
          isChatTabActive={activeTab === "chat"}
        />
      </div>

      <div
        className={tw(
          "flex-1 min-h-0 w-full flex flex-col items-center justify-center",
          activeTab === "scribe" ? "flex" : "hidden"
        )}
      >
        <div className={tw("text-[#45aaff] text-sm opacity-70")}>
          Background Scribe is active
        </div>
      </div>
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

  React.useEffect(() => {
    if (activeTab === "scribe" && plugin.backgroundScribe) {
      plugin.backgroundScribe.activate();
    }
  }, [activeTab, plugin]);

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
      id: "open-chat-tab",
      name: "Open Chat Tab",
      callback: () => this.activateTab("chat"),
    });

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
