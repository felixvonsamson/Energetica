/**
 * Main game layout component. Provides the structure for all game pages with
 * navigation, top bar, and content area.
 */

import { type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Navigation } from "./Navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface GameLayoutProps {
    children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
    return (
        <div className="bg-game-bg text-primary flex flex-col min-h-screen">
            {/* Theme toggle moved into TopBar to avoid overlapping other controls */}

            {/* Version info - bottom left corner */}
            {/* <div className="fixed bottom-0 left-0 z-10 hidden md:flex flex-col gap-2 p-4 text-sm">
                <a
                    href="/wiki/introduction"
                    className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-3 py-2 rounded hover:bg-tan-green dark:hover:bg-dark-bg-tertiary transition-colors"
                >
                    <i className="fa fa-book"></i>&nbsp;Game Wiki
                </a>
                <a
                    href="/changelog"
                    className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-3 py-2 rounded hover:bg-tan-green dark:hover:bg-dark-bg-tertiary transition-colors"
                >
                    <i className="fa fa-bullhorn"></i>&nbsp;Changelog
                </a>
            </div> */}

            {/* Top bar with resources and notifications */}
            <TopBar />

            {/* Main navigation */}
            <Navigation />

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
