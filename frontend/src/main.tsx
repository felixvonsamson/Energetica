import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { queryClient } from "@lib/query-client";
import { AuthProvider } from "@contexts/AuthContext";
import { SocketProvider } from "@contexts/SocketContext";
import { GameTickProvider } from "@contexts/GameTickContext";
import { ThemeProvider } from "@contexts/ThemeContext";
import { clearAssetColorCache } from "@lib/asset-colors";

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

const router = createRouter({
    routeTree,
    context: {
        queryClient,
    },
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
                <AuthProvider>
                    <SocketProvider>
                        <GameTickProvider>
                            <RouterProvider router={router} />
                        </GameTickProvider>
                    </SocketProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
);
