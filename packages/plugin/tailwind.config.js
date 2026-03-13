/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './**/*.{js,jsx,ts,tsx}',
    '!./node_modules/**/*',
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--background-modifier-border)",
        input: "var(--background-modifier-form-field)",
        ring: "var(--background-modifier-border-focus)",
        background: "var(--background-primary)",
        foreground: "var(--text-normal)",
        primary: {
          DEFAULT: "var(--interactive-accent)",
          foreground: "var(--text-on-accent)",
        },
        secondary: {
          DEFAULT: "var(--background-secondary)",
          foreground: "var(--text-normal)",
        },
        muted: {
          DEFAULT: "var(--background-secondary)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--interactive-accent)",
          foreground: "var(--text-on-accent)",
        },
        destructive: {
          DEFAULT: "var(--text-error)",
          foreground: "var(--text-on-accent)",
        },
        popover: {
          DEFAULT: "var(--background-secondary)",
          foreground: "var(--text-normal)",
        },
        depth: {
          0: "var(--bg-depth-0)",
          1: "var(--bg-depth-1)",
          2: "var(--bg-depth-2)",
          3: "var(--bg-depth-3)",
          4: "var(--bg-depth-4)",
          5: "var(--bg-depth-5)",
        },
        card: {
          DEFAULT: "var(--bg-depth-3)",
          foreground: "var(--text-normal)",
        },
        neon: {
          cyan: "var(--text-accent)",
          pink: "var(--text-sub-accent)",
          green: "var(--text-success)",
          amber: "var(--text-warning)",
          blue: "var(--text-dim)",
          faint: "var(--text-faint)",
        },
      },
      boxShadow: {
        'glow-cyan-sm': 'var(--glow-cyan-sm)',
        'glow-cyan-md': 'var(--glow-cyan-md)',
        'glow-cyan-lg': 'var(--glow-cyan-lg)',
        'glow-pink-sm': 'var(--glow-pink-sm)',
        'glow-pink-md': 'var(--glow-pink-md)',
      },
      borderColor: {
        'subtle': 'var(--border-subtle)',
        'defined': 'var(--border-defined)',
        'accent-border': 'var(--border-accent)',
        'active': 'var(--border-active)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    container: false,
    preflight: false,
  },
}
