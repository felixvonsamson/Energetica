import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import {
    PageCard,
    CardTitle,
    CardContent,
    CardHeader,
} from "@energetica/ui/components/card";
import { EmptyState } from "@energetica/ui/components/empty-state";

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
        <PageCard>
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
        </PageCard>
    );
}
