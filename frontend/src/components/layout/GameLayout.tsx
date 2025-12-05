/**
 * Main game layout component. Provides the structure for all game pages with
 * navigation, top bar, and content area.
 */

import { type ReactNode } from "react";
import { TopBar } from "./TopBar";

interface GameLayoutProps {
    children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
    return (
        <div className="bg-game-bg text-primary flex flex-col min-h-screen">
            {/* Top bar with resources, notifications, and navigation */}
            <TopBar />

            {/* Main content area */}
            <main className="bg-content-bg text-primary flex-1">
                {children}
            </main>

            {/* Toast notifications container */}
            <div
                id="toasts"
                className="fixed top-4 right-4 z-50 flex flex-col gap-2"
            ></div>
        </div>
    );
}
