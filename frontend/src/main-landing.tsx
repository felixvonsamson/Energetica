import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { ThemeProvider } from "@/contexts/theme-context";

import { routeTree } from "./routeTree.landing.gen";

import "./styles/global.css";

// The landing bundle does not augment the `Register` interface — the app bundle
// owns that augmentation. Without a Register, TanStack Router's `to` props
// fall back to loose `string` typing, which is what we want for the landing
// since many shared components link into the app bundle (`/app/*`) and those
// routes do not exist in this bundle's route tree.
const router = createRouter({
    routeTree,
    scrollRestoration: true,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <RouterProvider router={router} />
        </ThemeProvider>
    </StrictMode>,
);
