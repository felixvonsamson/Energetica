import { type ReactNode } from "react";
import { Card, CardTitle, CardContent, EmptyState } from "@/components/ui";
import { type LucideIcon } from "lucide-react";

interface DashboardSectionProps {
    title: string;
    children?: ReactNode;
    emptyIcon?: LucideIcon;
    emptyMessage?: string;
}

/**
 * Reusable dashboard section with empty state handling.
 */
export function DashboardSection({
    title,
    children,
    emptyIcon,
    emptyMessage,
}: DashboardSectionProps) {
    return (
        <Card>
            <CardTitle>{title}</CardTitle>
            <CardContent>
                {children || (
                    <EmptyState
                        icon={emptyIcon}
                        title={emptyMessage || "No data available"}
                    />
                )}
            </CardContent>
        </Card>
    );
}
