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

                // Facility colors (for charts, badges, etc.)
                facility: {
                    watermill: "rgb(0, 180, 216)",
                    "small-water-dam": "rgb(0, 119, 182)",
                    "large-water-dam": "rgb(3, 4, 94)",
                    "nuclear-reactor": "rgb(191, 210, 0)",
                    "nuclear-reactor-gen4": "rgb(128, 185, 24)",
                    "steam-engine": "rgb(151, 157, 172)",
                    "coal-burner": "rgb(0, 0, 0)",
                    "gas-burner": "rgb(171, 196, 255)",
                    "combined-cycle": "rgb(92, 77, 125)",
                    windmill: "rgb(156, 197, 161)",
                    "onshore-wind": "rgb(73, 160, 120)",
                    "offshore-wind": "rgb(33, 104, 105)",
                    "csp-solar": "rgb(255, 170, 0)",
                    "pv-solar": "rgb(255, 234, 0)",
                },

                // Storage colors
                storage: {
                    "small-pumped-hydro": "rgb(0, 150, 199)",
                    "large-pumped-hydro": "rgb(2, 62, 138)",
                    "lithium-ion": "rgb(108, 88, 76)",
                    "solid-state": "rgb(169, 132, 103)",
                    "molten-salt": "rgb(119, 47, 26)",
                    hydrogen: "rgb(144, 241, 239)",
                },

                // Resource colors
                resource: {
                    coal: "rgb(0, 0, 0)",
                    gas: "rgb(171, 196, 255)",
                    uranium: "rgb(191, 210, 0)",
                    imports: "rgb(255, 89, 94)",
                    exports: "rgb(138, 201, 38)",
                    dumping: "rgb(208, 0, 0)",
                },

                // Functional facility colors
                functional: {
                    industry: "rgb(188, 108, 37)",
                    research: "rgb(255, 255, 255)",
                    construction: "rgb(255, 123, 0)",
                    transport: "rgb(106, 0, 244)",
                    "carbon-capture": "rgb(173, 181, 189)",
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
