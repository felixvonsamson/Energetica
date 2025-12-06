import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => ({
    plugins: [
        // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
        }),
        tailwindcss(),
        react(),
    ],
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
    base: mode === "development" ? "/" : "/static/react/",
    server: {
        proxy: {
            // Backend API endpoints
            "^/api": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            // Static assets
            "^/static": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            // WebSocket connection
            "^/socket.io": {
                target: "http://localhost:5001",
                changeOrigin: true,
                ws: true,
            },
            // Auth routes
            "^/(logout|location_choice)$": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            // Page routes (Jinja templates being migrated)
            "^/(landing|home|settings|profile|messages|network|map_view|scoreboard|technology|resource_market|changelog)($|/)":
                {
                    target: "http://localhost:5001",
                    changeOrigin: true,
                },
            // Facility pages
            "^/(power_facilities|storage_facilities|extraction_facilities|functional_facilities)($|/)":
                {
                    target: "http://localhost:5001",
                    changeOrigin: true,
                },
            // Overview pages
            "^/production_overview": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
            // Wiki pages
            "^/wiki": {
                target: "http://localhost:5001",
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: "../energetica/static/react",
        emptyOutDir: true,
    },
}));
