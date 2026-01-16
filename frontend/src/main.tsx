import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { AuthProvider } from "@/contexts/auth-context";
import { GameTickProvider } from "@/contexts/game-tick-context";
import { SocketProvider } from "@/contexts/socket-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { TimeModeProvider } from "@/contexts/time-mode-context";
import { clearAssetColorCache } from "@/lib/assets/asset-colors";
import { queryClient } from "@/lib/query-client";

import { routeTree } from "./routeTree.gen";

import "./styles/global.css";

// HMR: Invalidate color cache when any file updates during development
// This ensures CSS variable changes are reflected immediately after editing global.css
// We use vite:afterUpdate (not beforeUpdate) to ensure CSS is applied to DOM first
if (import.meta.hot) {
    import.meta.hot.on("vite:afterUpdate", () => {
        clearAssetColorCache();
        // Trigger MapCanvas dimension recalculation on HMR updates
        window.dispatchEvent(new Event("map-canvas-invalidated"));
        console.log("Sending map-canvas-invalidated");
    });
}

/* This allows for cleaner query flag parameters */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stringifySearchWithFlags = (search: Record<string, any>) => {
    const params = new URLSearchParams();

    for (const key in search) {
        const value = search[key];
        if (value !== undefined) {
            params.set(key, String(value));
        }
    }

    let result = params.toString();

    // Remove trailing `=` for empty string values (converts `key=` to `key`)
    result = result.replace(/=(?=&|$)/g, "");

    return result ? `?${result}` : "";
};

const router = createRouter({
    routeTree,
    context: {
        queryClient,
    },
    stringifySearch: stringifySearchWithFlags,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <TimeModeProvider>
                    <AuthProvider>
                        <SocketProvider>
                            <GameTickProvider>
                                <RouterProvider router={router} />
                            </GameTickProvider>
                        </SocketProvider>
                    </AuthProvider>
                </TimeModeProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
);
