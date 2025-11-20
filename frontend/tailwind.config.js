/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue,svelte,astro,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        // Use the custom Google font first, with your original fallback
        sans: ['"Baloo 2"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Expose your palette so you can use Tailwind utilities
        white: "#ffffff",            // (You can omit; Tailwind already has white)
        bone: "#e5d9b6",
        "tan-green": "#a4be7b",
        "tan-hover": "#b5ca95",
        brand: {
            green: "#5f8d4e",       // renamed to avoid clobbering Tailwind's green scale
        },
        pine: {
          DEFAULT: "#285430",
          darker: "#1b3820"
        },
        alert: {
          red: "#f44336",
          orange: "#f59f00"
        }
      }
    }
  },
  plugins: []
};