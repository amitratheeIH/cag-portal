import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['system-ui', 'sans-serif'],
        serif: ["'EB Garamond'", "'Times New Roman'", 'Times', 'serif'],
        mono:  ['monospace'],
      },
      colors: {
        navy: { DEFAULT:'#1a3a6b', dark:'#0f2a50', light:'#edf1f8' },
        saffron: { DEFAULT:'#c47a20', light:'#fdf4e7' },
        cag: {
          bg:'#f4f2ee', surface:'#faf9f7',
          border:'#d0d0c8', text:'#1a1a1a',
          text2:'#3a3a3a', text3:'#6b6b6b',
        },
      },
      boxShadow: {
        card:'0 1px 3px rgba(26,58,107,.08)',
        md:'0 4px 16px rgba(26,58,107,.12)',
      },
    },
  },
  plugins: [],
}
export default config
