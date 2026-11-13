import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "path";

import {
    buildInfoPlugin,
    DEV_PORTS,
    ENV_DIR,
    loadDeploymentEnv,
    resolveLobbyProxyTarget,
    rewriteSetCookieForLocalhost,
} from "../../vite.shared";

export default defineConfig(({ mode }) => {
    const env = loadDeploymentEnv(mode);
    // Which lobby backend the dev server proxies to (see resolveLobbyProxyTarget):
    // explicit VITE_BACKEND_URL wins, else the selected deployment's lobby.{apex},
    // else the local lobby backend on :8001. Shared with the app config so an
    // empty VITE_BACKEND_URL (shipped in .env.example) reads as unset here too.
    const backendUrl = resolveLobbyProxyTarget(env);

    return {
        plugins: [
            buildInfoPlugin(),
            // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
            tanstackRouter({
                target: "react",
                autoCodeSplitting: true,
            }),
            tailwindcss(),
            // @energetica/ui components such as Money import SVGs as React
            // components (`?react`).
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
        envDir: ENV_DIR,
        // frontend/public, shared with the app bundle. In dev it serves
        // /instances.json: the seed (scripts/lib/dev-env.sh) symlinks it to the
        // live landing aggregate, so it is never stale (issue #886). In
        // production Apache aliases /instances.json and /recaps/ from the shared
        // landing directory instead.
        publicDir: path.resolve(ENV_DIR, "public"),
        server: {
            port: DEV_PORTS.lobby,
            // Fail loudly on a busy port instead of drifting to the next free one:
            // the app bundle's login/logout bounce hard-codes this port (LOBBY_DEV_URL
            // in @energetica/core/instances), so a silent drift would send auth to a dead
            // origin. See DEV_PORTS in vite.shared.ts.
            strictPort: true,
            proxy: {
                // Lobby API (auth + my-runs).
                "^/api": {
                    target: backendUrl,
                    changeOrigin: true,
                    configure: rewriteSetCookieForLocalhost,
                },
            },
        },
        build: {
            outDir: "dist",
            emptyOutDir: true,
        },
    };
});
