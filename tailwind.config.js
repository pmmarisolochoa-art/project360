/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-aware (cambian entre light/dark via CSS vars en index.css)
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-hover)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        // Theme-independent (mismos colores en ambos)
        accent: {
          indigo: '#6366F1',
          violet: '#8B5CF6',
          cyan: '#06B6D4',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        'gradient-surface': 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)',
      },
      boxShadow: {
        'glow-accent': '0 0 24px -4px rgba(139, 92, 246, 0.45)',
        'glow-cyan': '0 0 20px -4px rgba(6, 182, 212, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
