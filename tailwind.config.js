/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A0A0F',
          surface: '#12121A',
          elevated: '#1A1A24',
          hover: '#22222E',
        },
        accent: {
          indigo: '#6366F1',
          violet: '#8B5CF6',
          cyan: '#06B6D4',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.18)',
        },
        text: {
          primary: '#F5F5FA',
          secondary: '#A0A0B4',
          muted: '#6B6B80',
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
        'gradient-surface': 'linear-gradient(180deg, #12121A 0%, #0A0A0F 100%)',
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
