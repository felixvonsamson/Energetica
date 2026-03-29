import { Clock, Pause, PlayCircle, Truck, ZapOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
    status:
        | "paused"
        | "waiting"
        | "ongoing"
        | "in-transit"
        | "slowed"
        | "stopped";
    size?: "sm" | "md";
    className?: string;
}

/**
 * Status badge component for displaying project/shipment status with icon and
 * color coding.
 *
 * @example
 *     <StatusBadge status="ongoing" />
 *     <StatusBadge status="paused" size="sm" />
 */
export function StatusBadge({
    status,
    size = "md",
    className,
}: StatusBadgeProps) {
    const baseStyles =
        "inline-flex items-center gap-1 rounded-full font-medium px-2 py-1";

    const sizeStyles = {
        sm: "text-xs",
        md: "text-sm",
    };

    const iconSize = size === "sm" ? 12 : 14;

    const statusConfig = {
        paused: {
            icon: <Pause size={iconSize} />,
            label: "Paused",
            styles: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        },
        waiting: {
            icon: <Clock size={iconSize} />,
            label: "Waiting",
            styles: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        },
        ongoing: {
            icon: <PlayCircle size={iconSize} />,
            label: "Ongoing",
            styles: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        },
        "in-transit": {
            icon: <Truck size={iconSize} />,
            label: "In Transit",
            styles: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        },
        slowed: {
            icon: <ZapOff size={iconSize} />,
            label: "Power Shortage",
            styles: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        },
        stopped: {
            icon: <ZapOff size={iconSize} />,
            label: "Power Shortage",
            styles: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        },
    };

    const config = statusConfig[status];

    return (
        <span
            className={cn(
                baseStyles,
                sizeStyles[size],
                config.styles,
                className,
            )}
            aria-label={`Status: ${config.label}`}
        >
            {config.icon}
            <span>{config.label}</span>
        </span>
    );
}
