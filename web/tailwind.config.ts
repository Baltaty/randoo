import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#ffd53a',
          secondary: '#ff66b3',
          tertiary: '#3aff43',
          alternate: '#7c61ff',
        },
        accent: {
          1: '#2dd6ff',
          2: '#cbdb42',
          3: '#e6fdd3',
          4: '#e3e8a0',
        },
        semantic: {
          success: '#3beea8',
          error: '#f02031',
          warning: '#f9cf58',
        },
        dark: {
          bg: '#0a0a0a',
          card: '#141414',
          border: '#272727',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
