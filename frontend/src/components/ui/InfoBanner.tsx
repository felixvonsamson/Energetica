import { type ReactNode } from "react";
import { Info, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoBannerProps {
    children: ReactNode;
    variant?: "info" | "warning" | "success";
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
            container:
                "bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400",
            icon: "text-blue-500 dark:text-blue-400",
            text: "text-blue-900 dark:text-blue-100",
            IconComponent: Info,
        },
        warning: {
            container:
                "bg-orange-100 dark:bg-orange-900/30 border-alert-orange dark:border-orange-400",
            icon: "text-alert-orange dark:text-orange-400",
            text: "text-orange-900 dark:text-orange-100",
            IconComponent: AlertTriangle,
        },
        success: {
            container:
                "bg-green-100 dark:bg-green-900/30 border-brand-green dark:border-green-400",
            icon: "text-brand-green dark:text-green-400",
            text: "text-green-900 dark:text-green-100",
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
                <Icon className={cn("w-5 h-5 mt-0.5", config.icon)} />
                <div className="text-sm md:text-base">{children}</div>
            </div>
        </div>
    );
}
