import { Info, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface InfoBannerProps {
    children: ReactNode;
    variant?: "info" | "warning" | "error" | "success";
    className?: string;
}

/** Coloured banner for displaying informational messages. */
export function InfoBanner({
    children,
    variant = "info",
    className,
}: InfoBannerProps) {
    const variants = {
        info: {
            container: "bg-info/10 border-info",
            icon: "text-info",
            text: "text-info",
            IconComponent: Info,
        },
        warning: {
            container: "bg-warning/10 border-warning",
            icon: "text-warning",
            text: "text-warning",
            IconComponent: AlertTriangle,
        },
        error: {
            container: "bg-destructive/10 border-destructive",
            icon: "text-destructive",
            text: "text-destructive",
            IconComponent: XCircle,
        },
        success: {
            container: "bg-success/10 border-success",
            icon: "text-success",
            text: "text-success",
            IconComponent: CheckCircle,
        },
    };

    const config = variants[variant];
    const Icon = config.IconComponent;

    return (
        <div
            className={cn(
                "border-l-4 p-4 rounded",
                config.container,
                config.text,
                className,
            )}
        >
            <div className="flex items-start gap-3">
                <Icon className={cn("w-10 h-10 mt-0.5", config.icon)} />
                <div className="text-sm md:text-base">{children}</div>
            </div>
        </div>
    );
}
