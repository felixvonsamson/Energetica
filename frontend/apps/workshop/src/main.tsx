import { ThemeProvider } from "@energetica/ui/contexts/theme-context";
import { clearAssetColorCache } from "@energetica/ui/lib/asset-colors";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { queryClient } from "@/lib/query-client";

import { routeTree } from "./routeTree.gen";

import "./styles.css";

// HMR: the facility colours are read from CSS variables and cached, so clear the
// cache once an edit to the stylesheet has been applied.
if (import.meta.hot) {
    import.meta.hot.on("vite:afterUpdate", () => {
        clearAssetColorCache();
    });
}

const router = createRouter({
    routeTree,
    // An Instance serves its app under /app/, the path Apache falls back to the
    // app's index.html for. The routes themselves do not repeat it.
    basepath: "/app",
    scrollRestoration: true,
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
                <RouterProvider router={router} />
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
);
