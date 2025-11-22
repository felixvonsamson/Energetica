/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx,vue,svelte,astro,mdx}",
    ],
    darkMode: "class", // Enable class-based dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Baloo 2"', "system-ui", "sans-serif"],
            },
            colors: {
                // Base palette with proper text colors
                bone: {
                    DEFAULT: "#e5d9b6",
                    text: "#000000", // Black text on bone background
                },
                "tan-green": {
                    DEFAULT: "#a4be7b",
                    hover: "#b5ca95",
                    text: "#000000", // Black text on tan-green
                },
                brand: {
                    green: "#5f8d4e",
                    "green-text": "#ffffff", // White text on brand green
                },
                pine: {
                    DEFAULT: "#285430",
                    darker: "#1b3820",
                    lighter: "#5f8d4e",
                    text: "#ffffff", // White text on pine
                },
                alert: {
                    red: "#f44336",
                    orange: "#f59f00",
                },


                // Dark mode colors
                dark: {
                    bg: {
                        primary: "#1a1a1a",
                        secondary: "#2d2d2d",
                        tertiary: "#3a3a3a",
                    },
                    text: {
                        primary: "#ffffff",
                        secondary: "#e5e5e5",
                        muted: "#a0a0a0",
                    },
                    border: "#404040",
                },
            },

            // Background colors for light/dark mode
            backgroundColor: {
                "game-bg": "var(--game-bg)",
                "content-bg": "var(--content-bg)",
                "card-bg": "var(--card-bg)",
            },

            // Text colors for light/dark mode
            textColor: {
                primary: "var(--text-primary)",
                secondary: "var(--text-secondary)",
                muted: "var(--text-muted)",
            },

            // Border colors
            borderColor: {
                "default": "var(--border-default)",
            },
        },
    },
    plugins: [],
};
