import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserHistory, createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

import "./styles/global.css"
import { queryClient } from "./queryClient";

const router = createRouter({
    routeTree,
    basepath: '/admin-dashboard'
})

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            {/* <App /> */}
            <RouterProvider router={router} />
        </QueryClientProvider>
    </StrictMode>
);