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

const CommandIcon = ({ icon, selected }: { icon: React.ReactNode; selected?: boolean }) => {
  return (
    <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center transition-colors duration-150 ${
      selected ? 'text-[#0fb6d6]' : 'text-[#45aaff]'
    }`}>
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
    <div className="max-h-[400px] overflow-y-auto bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_6px_rgba(14,210,247,0.2)] w-80 zenith-scrollbar">
      {categories.map(category => {
        const items = groupedItems[category] || [];
        if (items.length === 0) return null;

        return (
          <div key={category} className="py-1.5 first:pt-2.5 last:pb-2.5">
            <div className="text-xs font-semibold text-[#45aaff] uppercase px-3 py-1.5 mb-1">
              {getCategoryLabel(category)}
            </div>
            {items.map(item => {
              const isSelected = props.items[selectedIndex]?.id === item.id;
              return (
                <button
                  key={item.id}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(14,210,247,0.45)] ${
                    isSelected
                      ? "bg-[rgba(14,210,247,0.08)] text-[#0fb6d6] border-l-2 border-l-[#0fb6d6] shadow-[0_0_6px_rgba(14,210,247,0.2)]"
                      : "text-[#bebebe] hover:bg-[rgba(14,210,247,0.06)] hover:shadow-[0_0_6px_rgba(14,210,247,0.2)]"
                  }`}
                  onClick={() => selectItem(item.originalIndex)}
                >
                  <CommandIcon icon={item.icon} selected={isSelected} />
                  <div className="flex-grow min-w-0 flex items-center gap-2">
                    <span className="font-medium text-sm leading-tight">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-xs text-[#45aaff] leading-tight">
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
    <div className="flex flex-col items-center justify-center py-6 text-center bg-[#191621] border border-[rgba(14,210,247,0.08)] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
      <p className="text-sm text-[#bebebe] opacity-50">No matching commands found</p>
      <p className="text-xs text-[#45aaff] mt-1 opacity-70">Try a different search term</p>
    </div>
  );
});

CommandList.displayName = "CommandList";

export default CommandList;
