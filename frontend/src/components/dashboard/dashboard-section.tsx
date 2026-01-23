import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import {
    Card,
    CardTitle,
    CardContent,
    EmptyState,
    CardHeader,
} from "@/components/ui";

interface DashboardSectionProps {
    title: ReactNode;
    children?: ReactNode;
    emptyIcon?: LucideIcon;
    emptyMessage?: string;
}

/** Reusable dashboard section with empty state handling. */
export function DashboardSection({
    title,
    children,
    emptyIcon,
    emptyMessage,
}: DashboardSectionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
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
