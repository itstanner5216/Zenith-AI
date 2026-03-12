import React from 'react';

interface Example {
  prompt: string;
  description: string;
  icon: string;
}

const examples: Example[] = [
//   {
//     prompt: "Move all my untitled notes to an 'Inbox' folder",
//     description: "File organization",
//     icon: "📁"
//   },
//   {
//     prompt: "Rename my daily notes to include topics discussed",
//     description: "Smart renaming",
//     icon: "✏️"
//   },
  {
    prompt: "Add a summary section at the bottom of my current note",
    description: "Content editing",
    icon: "➕"
  },
  {
    prompt: "Search for notes about project planning",
    description: "Smart search",
    icon: "🔍"
  },
//   {
//     prompt: "Tag my book notes with relevant categories",
//     description: "Auto-tagging",
//     icon: "🏷️"
//   },
//   {
//     prompt: "Analyze my vault structure and suggest improvements",
//     description: "Vault analysis",
//     icon: "📊"
//   },

  {
    prompt: "Help me set up my vault organization settings",
    description: "Vault setup",
    icon: "⚙️"
  },
  {
    prompt: "Show me my recently modified files",
    description: "Recent activity",
    icon: "🕒"
  },
  {
    prompt: "Summarize this video https://www.youtube.com/watch?v=AyLXmbTnJIY&t=1s",
    description: "Content import",
    icon: "▶️"
  }
];

// Function to get random examples
const getRandomExamples = (count: number = 5): Example[] => {
  const shuffled = [...examples].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const ExamplePrompts: React.FC<{
  onExampleClick: (prompt: string) => void;
}> = ({ onExampleClick }) => {
  const [displayedExamples] = React.useState(() => getRandomExamples());

  return (
    <div className="flex flex-col gap-3 p-4 mx-auto max-w-xl">
      {displayedExamples.map((example, index) => (
        <button
          key={index}
          onClick={() => onExampleClick(example.prompt)}
          className="text-left p-3 border border-[rgba(14,210,247,0.1)] hover:border-[rgba(14,210,247,0.25)] bg-[#191621] hover:bg-[rgba(14,210,247,0.06)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:shadow-[0_0_10px_rgba(14,210,247,0.08)] active:scale-[0.98] transition-all duration-150 flex items-start gap-3 group w-full rounded-md"
        >
          <div className="text-[#7aa2f7] group-hover:text-[#0fb6d6] text-xl transition-colors">
            {example.icon}
          </div>
          <div className="flex-1">
            <p className="text-[#bebebe] font-medium mb-1 group-hover:text-[#0fb6d6] transition-colors">{example.prompt}</p>
            <span className="text-[#7aa2f7] text-sm" style={{ opacity: 0.7 }}>{example.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
};
