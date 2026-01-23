/**
 * Status badge component for displaying facility status with icons and colors.
 * Supports production, consumption, and renewable facility statuses.
 */

import {
    Activity,
    AlertCircle,
    BatteryWarning,
    CheckCircle,
    Circle,
    CircleArrowDown,
    CircleArrowUp,
    CircleDashed,
    Fuel,
    Wind,
    XCircle,
    Zap,
} from "lucide-react";

import type {
    ProductionStatus,
    ConsumptionStatus,
    RenewableStatus,
} from "@/components/power-priorities/types";
import { cn } from "@/lib/utils";

type FacilityStatus = ProductionStatus | ConsumptionStatus | RenewableStatus;

type StatusVariant = "critical" | "warning" | "neutral" | "normal";

const variantStyles: Record<StatusVariant, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    warning:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    neutral:
        "bg-gray-100/50 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
    normal: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

interface StatusBadgeProps {
    /** The facility status */
    status: FacilityStatus | null | undefined;
    variant: "iconOnly" | "iconWithLabel";
}

/** Displays a coloured badge with icon indicating the facility's current status. */
export function StatusBadge({ status, variant }: StatusBadgeProps) {
    const statusConfig: Record<
        FacilityStatus | "",
        {
            icon: React.ReactNode;
            label: string | null;
            variant: StatusVariant;
        }
    > = {
        // Handle null/undefined status
        "": {
            icon: <Circle />,
            label: null,
            variant: "neutral",
        },

        // Production statuses
        not_producing: {
            icon: <CircleDashed />,
            label: "Idle",
            variant: "neutral",
        },
        out_of_fuel: {
            icon: <Fuel />,
            label: "Out of Fuel",
            variant: "critical",
        },
        no_charge: {
            icon: <BatteryWarning />,
            label: "No Stored Energy",
            variant: "warning",
        },
        fuel_constrained: {
            icon: <Fuel />,
            label: "Fuel Constrained",
            variant: "warning",
        },
        ramping_down: {
            icon: <CircleArrowDown />,
            label: "Ramping Down",
            variant: "normal",
        },
        producing_steady: {
            icon: <Activity />,
            label: "Marginal",
            variant: "normal",
        },
        ramping_up: {
            icon: <CircleArrowUp />,
            label: "Ramping Up",
            variant: "normal",
        },
        at_capacity: {
            icon: <Zap />,
            label: "Producing at Max Capacity",
            variant: "normal",
        },

        // Consumption statuses
        not_satisfied: {
            icon: <XCircle />,
            label: "Not Satisfied",
            variant: "critical",
        },
        partially_satisfied: {
            icon: <AlertCircle />,
            label: "Partially Satisfied",
            variant: "warning",
        },
        fully_satisfied: {
            icon: <CheckCircle />,
            label: "Fully Satisfied",
            variant: "normal",
        },
        no_demand: {
            icon: <CircleDashed />,
            label: "No Demand",
            variant: "neutral",
        },

        // Renewable statuses
        high_wind_cutoff: {
            icon: <Wind />,
            label: "High Wind Cutoff",
            variant: "critical",
        },
        available: {
            icon: <CheckCircle />,
            label: "Producing",
            variant: "normal",
        },
    };

    const config = statusConfig[status ?? ""];

    return (
        <div
            className={cn(
                "group relative inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium [&>svg]:w-5 [&>svg]:h-5",
                variant === "iconWithLabel" && "xl:w-50",
                variantStyles[config.variant],
            )}
        >
            {config.icon}
            {config.label && (
                <>
                    {variant === "iconWithLabel" && (
                        <span className="inline w-full text-center">
                            {config.label}
                        </span>
                    )}
                    {variant === "iconOnly" && (
                        <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap pointer-events-none z-10">
                            {config.label}
                            {/* Tooltip arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
