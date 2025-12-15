import { Link, LinkProps } from "@tanstack/react-router";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

interface QuickLinkCardProps {
    to: LinkProps["to"];
    icon?: LucideIcon;
    title: string;
    className?: string;
}

/** Quick link card for dashboard navigation. */
export function QuickLinkCard({
    to,
    icon: Icon,
    title,
    className,
}: QuickLinkCardProps) {
    return (
        <Link
            to={to}
            className={cn(
                "bg-bone dark:bg-dark-bg-secondary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary",
                "p-6 rounded-lg text-center transition-colors block",
                "border border-transparent hover:border-pine dark:hover:border-brand-green",
                className,
            )}
        >
            {Icon && (
                <Icon className="w-8 h-8 mx-auto mb-2 text-pine dark:text-dark-text-primary" />
            )}
            <h2 className="text-xl font-bold text-bone-text dark:text-dark-text-primary">
                {title}
            </h2>
        </Link>
    );
}
