/**
 * Layout wrapper for wiki pages. Provides styling for MDX content and
 * navigation links to other wiki pages.
 */

import { Link, useParams } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { HomeLayout } from "@/components/home-layout";
import { GameLayout } from "@/components/layout/game-layout";
import { MdxContent } from "@/components/mdx-content";
import { TypographyH2 } from "@/components/ui/typography";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface WikiLayoutProps {
    children: ReactNode;
}

const wikiLinks = [
    { slug: "introduction", label: "Introduction" },
    { slug: "map", label: "The Map" },
    { slug: "projects", label: "Projects" },
    { slug: "power-facilities", label: "Power Facilities" },
    { slug: "storage-facilities", label: "Storage Facilities" },
    { slug: "resources", label: "Natural Resources" },
    { slug: "functional-facilities", label: "Functional Facilities" },
    { slug: "technologies", label: "Technology" },
    { slug: "power-management", label: "Power Management" },
    { slug: "network", label: "Network" },
    { slug: "time-and-weather", label: "Time & Weather" },
    { slug: "climate-effects", label: "Climate Change" },
];

export function WikiLayout({ children }: WikiLayoutProps) {
    const { isAuthenticated } = useAuth();
    const { slug: currentSlug } = useParams({ from: "/app/wiki/$slug" });

    const content = (
        <div className="bg-background text-foreground px-6 lg:px-8 pb-24">
            {/* MDX content with prose styling */}
            <MdxContent>{children}</MdxContent>

            {/* Navigation */}
            <nav className="max-w-4xl mx-auto mt-12">
                <TypographyH2 className="text-center mb-6">
                    Navigation
                </TypographyH2>
                <div className="flex flex-wrap gap-2 justify-center">
                    {wikiLinks.map((link) => {
                        const isActive = link.slug === currentSlug;
                        return (
                            <Link
                                key={link.slug}
                                to="/app/wiki/$slug"
                                params={{ slug: link.slug }}
                                className={cn(
                                    "px-4 py-2 rounded-lg",
                                    "transition-colors duration-200",
                                    "text-sm",
                                    isActive
                                        ? "bg-accent font-semibold"
                                        : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 font-medium",
                                )}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );

    return isAuthenticated ? (
        <GameLayout>{content}</GameLayout>
    ) : (
        <HomeLayout>{content}</HomeLayout>
    );
}
