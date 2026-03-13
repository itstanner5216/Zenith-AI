import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: "format" | "action" | "ai";
  command?: string;
  args?: any;
  action?: string;
  templateName?: string;
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

const CommandIcon = ({ icon }: { icon: React.ReactNode }) => {
  return (
    <span className="text-[var(--text-dim)] flex-shrink-0 w-5 h-5 flex items-center justify-center">
      {icon}
    </span>
  );
};

export const CommandList = forwardRef<
  { onKeyDown: (args: { event: KeyboardEvent }) => boolean },
  CommandListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    console.log("Command selected:", item);
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "format":
        return "Format Templates";
      case "action":
        return "Actions";
      case "ai":
        return "AI Commands";
      default:
        return "";
    }
  };

  // Group items by category
  const groupedItems = props.items.reduce((acc, item, index) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push({ ...item, originalIndex: index });
    return acc;
  }, {} as Record<string, (CommandItem & { originalIndex: number })[]>);

  const categories = ["format", "action", "ai"] as const;

  return props.items.length ? (
    <div className="max-h-[400px] overflow-y-auto bg-[var(--bg-depth-3)] border border-[rgba(14,210,247,0.08)] rounded-md shadow-lg w-80">
      {categories.map(category => {
        const items = groupedItems[category] || [];
        if (items.length === 0) return null;

        return (
          <div key={category} className="py-1.5 first:pt-2.5 last:pb-2.5">
            <div className="text-xs font-semibold text-[var(--text-dim)] uppercase px-3 py-1.5 mb-1">
              {getCategoryLabel(category)}
            </div>
            {items.map(item => {
              const isSelected = props.items[selectedIndex]?.id === item.id;
              return (
                <button
                  key={item.id}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer hover:bg-[rgba(14,210,247,0.08)] transition-colors ${
                    isSelected
                      ? "bg-[rgba(14,210,247,0.08)] text-[var(--text-accent)]"
                      : "text-[var(--text-normal)]"
                  }`}
                  onClick={() => selectItem(item.originalIndex)}
                >
                  <CommandIcon icon={item.icon} />
                  <div className="flex-grow min-w-0 flex items-center gap-2">
                    <span className="font-medium text-sm leading-tight">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-xs text-[var(--text-dim)] leading-tight">
                        {item.description}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center py-6 text-center bg-[var(--bg-depth-3)] border border-[rgba(14,210,247,0.08)] rounded-md">
      <p className="text-sm text-[var(--text-normal)]" className="opacity-50">No matching commands found</p>
      <p className="text-xs text-[var(--text-normal)] mt-1" className="opacity-30">Try a different search term</p>
    </div>
  );
});

CommandList.displayName = "CommandList";

export default CommandList;
