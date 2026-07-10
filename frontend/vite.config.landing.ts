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

import { DEV_PORTS } from "./vite.shared";

export default defineConfig(() => {
    return {
        // Pin the port (see the lobby/app configs): the fixed-port contract in
        // vite.shared.ts assumes every surface lives at a known localhost origin.
        server: { port: DEV_PORTS.landing, strictPort: true },
        plugins: [
            // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
            tanstackRouter({
                target: "react",
                autoCodeSplitting: true,
                routesDirectory: "./src/routes-landing",
                generatedRouteTree: "./src/routeTree.landing.gen.ts",
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
        base: "/",
        build: {
            outDir: "dist-landing",
            emptyOutDir: true,
            rollupOptions: {
                input: path.resolve(__dirname, "./index.landing.html"),
            },
        },
    };
});
