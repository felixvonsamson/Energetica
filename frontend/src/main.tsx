import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode, type ReactNode } from "react";
import ReactDOM from "react-dom/client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthProvider } from "@/contexts/auth-context";
import { GameTickProvider } from "@/contexts/game-tick-context";
import { ResolutionProvider } from "@/contexts/resolution-context";
import { SocketProvider } from "@/contexts/socket-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { useRunMode } from "@/hooks/use-run-mode";
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
    scrollRestoration: true,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

/**
 * The providers for this instance's Run mode (#995). The persistent world's
 * auth, socket and tick providers all call persistent-world endpoints on mount,
 * which a Workshop Run's backend does not serve, so a Workshop Run gets none of
 * them. Its root route enters through `/workshop/enter` instead.
 */
function RunModeProviders({ children }: { children: ReactNode }) {
    const { data: mode, isError, refetch } = useRunMode();

    if (isError) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <p>Could not reach the server.</p>
                <Button variant="outline" onClick={() => void refetch()}>
                    Try again
                </Button>
            </div>
        );
    }
    if (mode === undefined) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner />
            </div>
        );
    }
    if (mode === "workshop") return children;
    return (
        <AuthProvider>
            <SocketProvider>
                <GameTickProvider>{children}</GameTickProvider>
            </SocketProvider>
        </AuthProvider>
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <ResolutionProvider>
                    <RunModeProviders>
                        <RouterProvider router={router} />
                    </RunModeProviders>
                </ResolutionProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
);
