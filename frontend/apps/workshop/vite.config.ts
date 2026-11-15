import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "path";

import {
    buildInfoPlugin,
    DEV_PORTS,
    devRootRedirect,
    ENV_DIR,
    explicitBackendUrl,
    loadDeploymentEnv,
    rewriteSetCookieForLocalhost,
} from "../../vite.shared";

export default defineConfig(({ mode, command }) => {
    const env = loadDeploymentEnv(mode);
    // The Workshop backend the dev server proxies to: an explicit VITE_BACKEND_URL,
    // else the local app backend on :8000, started with a Workshop Run's slug (see
    // docs/getting-started/local-development.md). No Workshop Run is deployed, so
    // unlike the persistent world's config there is no live instance to discover.
    const backendUrl = explicitBackendUrl(env) ?? "http://localhost:8000";

    return {
        plugins: [
            devRootRedirect,
            buildInfoPlugin("workshop"),
            // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
            tanstackRouter({
                target: "react",
                autoCodeSplitting: true,
            }),
            tailwindcss(),
            // The logo and the coin icon are SVGs imported as React components (`?react`).
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
            alias: {
                // Shared packages import this app's API types through `@api`. Those
                // imports are type-only, so this alias is only a safety net.
                "@api": path.resolve(
                    import.meta.dirname,
                    "./src/types/api-helpers.ts",
                ),
                "@": path.resolve(import.meta.dirname, "./src"),
            },
        },
        envDir: ENV_DIR,
        // frontend/public, shared with the persistent world's app: it holds the PWA
        // manifest, which Apache serves at /manifest.json from the Instance's bundle.
        publicDir: path.resolve(ENV_DIR, "public"),
        // Served at the same URL as the persistent world's bundle, since an Instance
        // serves one or the other. See docs/architecture/
        // static-serving-and-deployment.md § Request routing.
        base: command === "serve" ? "/" : "/static/app/",
        server: {
            // An Instance's port, shared with the persistent world's app. See DEV_PORTS.
            port: DEV_PORTS.app,
            strictPort: true,
            proxy: {
                "^/api": {
                    target: backendUrl,
                    changeOrigin: true,
                    configure: rewriteSetCookieForLocalhost,
                },
                // Socket.IO, through which the backend invalidates queries. See the
                // persistent world's config for why it targets the HTTP origin.
                "^/socket.io": {
                    target: backendUrl,
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
        build: {
            outDir: "dist",
            emptyOutDir: true,
        },
    };
});
