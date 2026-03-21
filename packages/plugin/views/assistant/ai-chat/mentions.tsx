import React, {
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { FileText, Hash, Folder } from 'lucide-react';

interface MentionItem {
  id?: string;
  title: string;
  content?: string;
  type?: 'file' | 'tag' | 'folder';
  label?: string;
  path?: string;
}

interface MentionsProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export interface MentionsHandle {
  onKeyDown: (args: { event: KeyboardEvent }) => boolean;
}

const ItemIcon = ({ type }: { type?: string }) => {
  const className = "w-4 h-4";
  
  switch (type) {
    case 'file':
      return <FileText className={className} />;
    case 'tag':
      return <Hash className={className} />;
    case 'folder':
      return <Folder className={className} />;
    default:
      return null;
  }
};



export const Mentions = ({ ref, ...props }: MentionsProps & { ref?: React.Ref<MentionsHandle> }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
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

  return (
    <div className="rounded-md overflow-hidden border border-[rgba(14,210,247,0.15)] shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_12px_rgba(14,210,247,0.1)] bg-[#191621]">
      {props.items.length ? (
        <ul className="max-h-[300px] overflow-y-auto list-none p-1 m-0 zenith-scrollbar">
          {props.items.map((item, index) => (
            <li
              key={item.path || item.title}
              className="list-none"
            >
              <button
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-100 cursor-pointer ${
                  index === selectedIndex
                    ? "bg-[rgba(14,210,247,0.12)] text-[#0fb6d6] shadow-[inset_0_0_0_1px_rgba(14,210,247,0.2)]"
                    : "text-[#bebebe] hover:bg-[rgba(14,210,247,0.06)] hover:text-[#bebebe]"
                }`}
                onClick={() => selectItem(index)}
              >
                <span className={`flex-shrink-0 ${
                  index === selectedIndex ? "text-[#0fb6d6]" : "text-[#45aaff]"
                }`}>
                  <ItemIcon type={item.type} />
                </span>

                <div className="flex-grow min-w-0">
                  <div className="font-medium truncate text-xs leading-tight">
                    {item.title}
                  </div>
                  {item.path && item.path !== item.title && (
                    <div className="text-[10px] text-[#45aaff] opacity-60 truncate mt-0.5">
                      {item.path}
                    </div>
                  )}
                </div>

                {item.type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium uppercase tracking-wider ${
                    index === selectedIndex
                      ? "bg-[rgba(14,210,247,0.15)] text-[#0fb6d6]"
                      : "bg-[rgba(69,170,255,0.1)] text-[#45aaff]"
                  }`}>
                    {item.type}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-4 text-xs text-[#45aaff] text-center opacity-60">
          No matching items found
        </div>
      )}
    </div>
  );
};

export default Mentions;
