import { Link, LinkProps } from "@tanstack/react-router";
import { type LucideIcon } from "lucide-react";

import { TypographyH2 } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

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
                "bg-card hover:bg-tan-hover dark:hover:bg-muted",
                "p-6 rounded-lg text-center transition-colors block",
                "border border-transparent hover:border-pine dark:hover:border-brand-green",
                className,
            )}
        >
            {Icon && <Icon className="w-8 h-8 mx-auto mb-2 text-foreground" />}
            <TypographyH2 className="text-xl text-foreground">{title}</TypographyH2>
        </Link>
    );
}
