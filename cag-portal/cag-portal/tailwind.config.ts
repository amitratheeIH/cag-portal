import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1A3A6B',
          dark:    '#102548',
          light:   '#2A5298',
        },
        blue:    '#0057A8',
        saffron: {
          DEFAULT: '#F47920',
          light:   '#FFF3E8',
        },
        cag: {
          bg:      '#F4F6FA',
          surface: '#FFFFFF',
          border:  '#D8E0EC',
          text:    '#1A1A2E',
          text2:   '#3D4B6B',
          text3:   '#6B7A99',
        },
      },
      fontFamily: {
        sans:  ['Noto Sans', 'sans-serif'],
        serif: ['Noto Serif', 'serif'],
        mono:  ['Noto Sans Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(26,58,107,.10), 0 4px 12px rgba(26,58,107,.06)',
        md:   '0 4px 16px rgba(26,58,107,.14)',
      },
    },
  },
  plugins: [],
}

export default config
