/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#243347',
          850: '#172033',
        },
        // WTC range colors
        'wtc-move':       '#4A90D9',
        'wtc-advance':    '#7BB3E8',
        'wtc-scout':      '#50C878',
        'wtc-charge':     '#E84040',
        'wtc-engage':     '#C83030',
        'wtc-shoot':      '#FFD700',
        'wtc-rapid':      '#E8A838',
        'wtc-threat':     '#9B30E8',
        'wtc-aura':       '#30E8B0',
        'wtc-deepstrike': '#FF6B35',
        'wtc-custom':     '#FFFFFF',
        // Theme tokens
        'theme-bg':         'rgb(var(--color-bg-rgb) / <alpha-value>)',
        'theme-surface':    'rgb(var(--color-surface-rgb) / <alpha-value>)',
        'theme-border':     'rgb(var(--color-border-rgb) / <alpha-value>)',
        'theme-text':       'var(--color-text-primary)',
        'theme-text-2':     'var(--color-text-secondary)',
        'theme-text-muted': 'var(--color-text-muted)',
        'theme-accent':     'rgb(var(--color-accent-rgb) / <alpha-value>)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
    },
  },
  plugins: [],
  safelist: [
    'border-red-500', 'border-yellow-400', 'border-green-500',
    'text-red-400', 'text-yellow-400', 'text-green-400', 'text-blue-400',
  ],
}
