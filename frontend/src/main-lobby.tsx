import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { ThemeProvider } from "@/contexts/theme-context";

import { routeTree } from "./routeTree.lobby.gen";

import "./styles/global.css";

// Like the landing, the lobby bundle does not augment the router `Register`
// interface — the app bundle owns that augmentation — so `to` props fall back
// to loose `string` typing.
const router = createRouter({
    routeTree,
    scrollRestoration: true,
});

// Light providers, like the landing, plus a query client for the picker's
// my-runs/auth state. Deliberately not the game's `query-client.ts` client:
// that one is tuned for the in-game Socket.IO cache-invalidation setup, none
// of which exists here.
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            staleTime: 30 * 1000,
        },
    },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </ThemeProvider>
    </StrictMode>,
);
