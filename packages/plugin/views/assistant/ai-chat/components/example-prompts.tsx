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
    prompt: "Help me organize my recent notes",
    description: "Note organization",
    icon: "📋"
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
          key={example.prompt}
          onClick={() => onExampleClick(example.prompt)}
          className="text-left p-3 border border-defined hover:border-accent-border bg-depth-3 hover:bg-depth-4 shadow-elevation-md hover:shadow-[0_4px_14px_rgba(0,0,0,0.5),0_0_6px_rgba(14,210,247,0.2)] hover:translate-y-[-1px] active:scale-[0.98] transition-all duration-150 flex items-start gap-3 group w-full rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-depth-2"
        >
          <div className="text-dim group-hover:text-neon-cyan text-xl transition-all duration-150 group-hover:drop-shadow-[0_0_4px_rgba(14,210,247,0.3)]">
            {example.icon}
          </div>
          <div className="flex-1">
            <p className="text-foreground font-medium mb-1 group-hover:text-neon-cyan transition-colors">{example.prompt}</p>
            <span className="text-dim text-xs opacity-70">{example.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
};
