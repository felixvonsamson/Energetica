import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "path";

import { contentMdx } from "@energetica/content/vite-plugin";

import { DEV_PORTS } from "../../vite.shared";

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
            }),
            contentMdx(),
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
            alias: { "@": path.resolve(import.meta.dirname, "./src") },
        },
        base: "/",
        // The env files (.env.local, .env.game, ...) live in frontend/, shared by
        // every app.
        envDir: path.resolve(import.meta.dirname, "../.."),
        build: {
            outDir: "dist",
            emptyOutDir: true,
        },
    };
});
