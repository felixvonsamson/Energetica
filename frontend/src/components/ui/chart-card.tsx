/** Reusable card component for displaying charts with consistent styling */

import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import {
    CardContent,
    PageCard,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
    icon?: LucideIcon;
    iconClassName?: string;
    title: ReactNode;
    subtitle?: ReactNode;
    children: ReactNode;
    className?: string;
    headerContent?: ReactNode;
}

/**
 * A card component specifically designed for chart displays. Provides
 * consistent layout with optional icon, title, and subtitle.
 *
 * @example
 *     ```tsx
 *     <ChartCard
 *       icon={Zap}
 *       iconClassName="text-primary"
 *       title="Power Generation"
 *       subtitle="Last 24 hours"
 *     >
 *       <TimeSeriesChart {...chartProps} />
 *     </ChartCard>
 *     ```;
 */
export function ChartCard({
    icon: Icon,
    iconClassName,
    title,
    subtitle,
    children,
    className,
    headerContent,
}: ChartCardProps) {
    return (
        <PageCard className={cn(className)}>
            {(Icon || title || headerContent) && (
                <CardHeader>
                    <div className="flex items-center gap-2">
                        {Icon && (
                            <Icon className={cn("w-6 h-6", iconClassName)} />
                        )}
                        <div className="flex-1">
                            <CardTitle>{title}</CardTitle>
                            {subtitle && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {headerContent}
                    </div>
                </CardHeader>
            )}
            <CardContent className="flex flex-col gap-6">
                {children}
            </CardContent>
        </PageCard>
    );
}
