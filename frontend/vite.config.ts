import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
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

interface InstanceManifest {
    instances?: { slug?: string }[];
}

/**
 * Resolve which backend the dev server proxies /api, /socket.io and /static to.
 *
 * Precedence:
 *
 * 1. An explicit VITE_BACKEND_URL always wins (a specific instance, a local
 *    backend, CI).
 * 2. A per-deployment mode (dev:game / dev:edu / dev:ethz) sets the stable
 *    VITE_APEX_DOMAIN. The game backend lives on a rotating instance
 *    _subdomain_ ({slug}.{apex}), never the apex — which post-cutover is the
 *    pure-static landing, whose FallbackResource answers every path (so
 *    proxying /api there returns index.html → "Unexpected token '<'"). We
 *    discover the current slug at dev-server startup from the apex's public
 *    instances.json manifest (newest advertised first — the ordering the
 *    landing's picker uses), so no slug is ever baked into the repo and it
 *    self-updates when the season's instance turns over.
 * 3. Otherwise the local backend on :8000.
 *
 * Only runs for `serve`: a production `build` also sets VITE_APEX_DOMAIN but
 * must never reach out to the live manifest, and its proxy/backend config is
 * unused anyway.
 */
async function resolveBackendUrl(
    command: "serve" | "build",
    env: Record<string, string>,
): Promise<string> {
    if (env.VITE_BACKEND_URL) return env.VITE_BACKEND_URL;

    const apex = env.VITE_APEX_DOMAIN;
    if (command === "serve" && apex) {
        const manifestUrl = `https://${apex}/instances.json`;
        let manifest: InstanceManifest;
        try {
            const res = await fetch(manifestUrl, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            manifest = (await res.json()) as InstanceManifest;
        } catch (cause) {
            throw new Error(
                `[vite] could not fetch ${manifestUrl} to discover the live instance — ` +
                    `set VITE_BACKEND_URL explicitly to target a backend. (${String(cause)})`,
            );
        }
        const slug = manifest.instances?.[0]?.slug;
        if (!slug) {
            throw new Error(
                `[vite] no advertised instance at ${apex} (empty instances.json) — ` +
                    `set VITE_BACKEND_URL explicitly to target a backend.`,
            );
        }
        const url = `https://${slug}.${apex}`;
        console.info(`[vite] apex ${apex} → live instance "${slug}" (${url})`);
        return url;
    }

    return "http://localhost:8000";
}

/**
 * Dev-only: mirror production's Apache `RedirectMatch ^/$ → /app/`. The app bundle only routes
 * `/app/*` (there is no `/` route), so without this the bare root 404s in dev — in prod Apache
 * handles it. `apply: "serve"` keeps it out of builds.
 */
const devRootRedirect: Plugin = {
    name: "dev-root-redirect",
    apply: "serve",
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (req.url === "/") {
                res.writeHead(302, { Location: "/app/" });
                res.end();
                return;
            }
            next();
        });
    },
};

/**
 * Strip `Secure` and `Domain` from `Set-Cookie` on proxied responses so a session cookie minted
 * by an HTTPS backend round-trips through the `http://localhost` dev origin. Without this, the
 * browser won't persist the fresh `Secure` cookie over plain-HTTP localhost (so a stale,
 * foreign-signed cookie lingers and every authed request 401s), and a future parent-domain
 * (`Domain=.{apex}`) cookie wouldn't match `localhost` at all. No-op for the local backend, which
 * sets neither attribute.
 */
const rewriteSetCookieForLocalhost: NonNullable<ProxyOptions["configure"]> = (proxy) => {
    proxy.on("proxyRes", (proxyRes) => {
        const setCookie = proxyRes.headers["set-cookie"];
        if (setCookie) {
            proxyRes.headers["set-cookie"] = setCookie.map((cookie) =>
                cookie.replace(/;\s*Secure/gi, "").replace(/;\s*Domain=[^;]*/gi, ""),
            );
        }
    });
};

export default defineConfig(async ({ mode, command }) => {
    const env = loadEnv(mode, process.cwd(), "");
    // Backend the dev server proxies to: explicit override, else slug discovered from the
    // mode's apex manifest, else local :8000. See resolveBackendUrl above.
    const backendUrl = await resolveBackendUrl(command, env);
    const wsUrl = backendUrl.replace(/^http/, "ws");

    return {
        plugins: [
            devRootRedirect,
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
        base: command === "serve" ? "/" : "/static/app/",
        server: {
            proxy: {
                // API endpoints
                "^/api": {
                    target: backendUrl,
                    changeOrigin: true,
                    configure: rewriteSetCookieForLocalhost,
                },
                // Static assets
                "^/static": {
                    target: backendUrl,
                    changeOrigin: true,
                },
                // WebSocket connection
                "^/socket.io": {
                    target: wsUrl,
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
                    configure: rewriteSetCookieForLocalhost,
                },
            },
        },
        build: {
            outDir: "../energetica/static/app",
            emptyOutDir: true,
        },
    };
});
