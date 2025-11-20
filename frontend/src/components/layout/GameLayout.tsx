/**
 * Main game layout component.
 * Provides the structure for all game pages with navigation, top bar, and content area.
 */

import { type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Navigation } from "./Navigation";

interface GameLayoutProps {
    children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
    return (
        <div className="min-h-screen bg-[#2d5016] text-white">
            {/* Version info - bottom left corner */}
            <div className="fixed bottom-0 left-0 z-10 hidden md:flex flex-col gap-2 p-4 text-sm">
                <a
                    href="/wiki/introduction"
                    className="bg-white text-black px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                >
                    <i className="fa fa-book"></i>&nbsp;Game Wiki
                </a>
                <a
                    href="/changelog"
                    className="bg-white text-black px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                >
                    <i className="fa fa-bullhorn"></i>&nbsp;Changelog
                </a>
            </div>

            {/* Top bar with resources and notifications */}
            <TopBar />

            {/* Main navigation */}
            <Navigation />

            {/* Main content area */}
            <main className="bg-[#c9d4b5] min-h-[calc(100vh-120px)]">
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
