import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { GameTickProvider } from "@/contexts/GameTickContext";

import "./styles/global.css";

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
            <AuthProvider>
                <SocketProvider>
                    <GameTickProvider>
                        <RouterProvider router={router} />
                    </GameTickProvider>
                </SocketProvider>
            </AuthProvider>
        </QueryClientProvider>
    </StrictMode>,
);
