import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

import { rewriteSetCookieForLocalhost } from "./vite.shared";

/**
 * Serve `index.lobby.html` for every SPA path in dev. Vite's dev server always
 * answers HTML requests with the root `index.html` (the _game_ entry — build
 * `rollupOptions.input` only applies to `vite build`), which would pull the
 * game's module graph into the lobby dev server. Registered in
 * `configureServer`, so it runs before Vite's internal HTML middleware — and
 * therefore also before the proxy middleware, so /api is excluded explicitly (a
 * browser navigation to an API URL must reach the backend, not the shell).
 */
const lobbyHtmlFallback: Plugin = {
    name: "lobby-html-fallback",
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const url = (req.url ?? "").split("?")[0];
            const acceptsHtml = (req.headers.accept ?? "").includes(
                "text/html",
            );
            if (
                acceptsHtml &&
                url !== undefined &&
                !url.includes(".") &&
                !url.startsWith("/api")
            ) {
                req.url = "/index.lobby.html";
            }
            next();
        });
    },
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    // The lobby backend (main_lobby.py) defaults to :8001; VITE_BACKEND_URL
    // overrides, mirroring the main config's precedence.
    const backendUrl = env.VITE_BACKEND_URL ?? "http://localhost:8001";

    return {
        plugins: [
            lobbyHtmlFallback,
            // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
            tanstackRouter({
                target: "react",
                autoCodeSplitting: true,
                routesDirectory: "./src/routes-lobby",
                generatedRouteTree: "./src/routeTree.lobby.gen.ts",
            }),
            tailwindcss(),
            react(),
        ],
        resolve: {
            alias: { "@": path.resolve(__dirname, "./src") },
        },
        base: "/",
        // Keep the dev dependency scanner off the sibling entries (index.html
        // pulls the game graph, whose .mdx this config cannot parse).
        optimizeDeps: {
            entries: ["index.lobby.html"],
        },
        server: {
            proxy: {
                // Lobby API (auth + my-runs). /instances.json is deliberately
                // not proxied: in production Apache aliases it from the shared
                // landing dir; in dev it 404s and the picker degrades to "no
                // open runs".
                "^/api": {
                    target: backendUrl,
                    changeOrigin: true,
                    configure: rewriteSetCookieForLocalhost,
                },
            },
        },
        build: {
            outDir: "dist-lobby",
            emptyOutDir: true,
            rollupOptions: {
                input: path.resolve(__dirname, "./index.lobby.html"),
            },
        },
    };
});
