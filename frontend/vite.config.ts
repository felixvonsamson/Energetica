import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import svgr from "vite-plugin-svgr";
import path from "path";

export default defineConfig(({ mode }) => {
    // Backend URL from environment variable, fallback to local development server
    const backendUrl = process.env.VITE_BACKEND_URL || "http://localhost:8000";

    return {
        plugins: [
            // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
            tanstackRouter({
                target: "react",
                autoCodeSplitting: true,
            }),
            mdx({
                remarkPlugins: [remarkGfm, remarkMath],
                rehypePlugins: [rehypeSlug, rehypeKatex],
            }),
            tailwindcss(),
            svgr({
                svgrOptions: {
                    ref: true,
                    svgoConfig: {
                        plugins: [
                            {
                                name: "preset-default",
                                params: {
                                    overrides: {
                                        removeViewBox: false,
                                    },
                                },
                            },
                        ],
                    },
                },
            }),
            react(),
        ],
        resolve: {
            alias: { "@": path.resolve(__dirname, "./src") },
        },
        base: mode === "development" ? "/" : "/static/react/",
        server: {
            proxy: {
                // API endpoints
                "^/api": {
                    target: backendUrl,
                    changeOrigin: true,
                },
                // Static assets
                "^/static": {
                    target: backendUrl,
                    changeOrigin: true,
                },
                // WebSocket connection
                "^/socket.io": {
                    target: backendUrl,
                    changeOrigin: true,
                    ws: true,
                },
                // Service worker and manifest must be served from root by the backend
                "^/service-worker.js$": {
                    target: backendUrl,
                    changeOrigin: true,
                },
                "^/manifest.json$": {
                    target: backendUrl,
                    changeOrigin: true,
                },
                // Auth routes
                "^/logout$": {
                    target: backendUrl,
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: "../energetica/static/react",
            emptyOutDir: true,
        },
    };
});
