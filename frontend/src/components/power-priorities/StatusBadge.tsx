/**
 * Status badge component for displaying facility status with icons and colors.
 * Supports production, consumption, and renewable facility statuses.
 */

import {
    Activity,
    AlertCircle,
    CheckCircle,
    Circle,
    TrendingDown,
    TrendingUp,
    Wind,
    XCircle,
    Zap,
} from "lucide-react";

import type {
    ProductionStatus,
    ConsumptionStatus,
    RenewableStatus,
} from "./types";

type FacilityStatus = ProductionStatus | ConsumptionStatus | RenewableStatus;

interface StatusBadgeProps {
    /** The facility status */
    status: FacilityStatus | null | undefined;
}

/** Displays a colored badge with icon indicating the facility's current status. */
export function StatusBadge({ status }: StatusBadgeProps) {
    // Handle null/undefined status
    if (!status) {
        return (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <Circle className="w-3 h-3" />
                <span>—</span>
            </div>
        );
    }

    const statusConfig: Record<
        FacilityStatus,
        {
            icon: React.ReactNode;
            label: string;
            className: string;
        }
    > = {
        // Production statuses
        not_producing: {
            icon: <Circle className="w-3 h-3" />,
            label: "Idle",
            className:
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        },
        out_of_fuel: {
            icon: <AlertCircle className="w-3 h-3" />,
            label: "Out of Fuel",
            className:
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        },
        no_charge: {
            icon: <AlertCircle className="w-3 h-3" />,
            label: "No Charge",
            className:
                "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        },
        fuel_constrained: {
            icon: <AlertCircle className="w-3 h-3" />,
            label: "Fuel Constrained",
            className:
                "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        },
        ramping_down: {
            icon: <TrendingDown className="w-3 h-3" />,
            label: "Ramping Down",
            className:
                "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        },
        producing_steady: {
            icon: <Activity className="w-3 h-3" />,
            label: "Marginal",
            className:
                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        },
        ramping_up: {
            icon: <TrendingUp className="w-3 h-3" />,
            label: "Ramping Up",
            className:
                "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        },
        at_capacity: {
            icon: <Zap className="w-3 h-3" />,
            label: "At Capacity",
            className:
                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        },

        // Consumption statuses
        not_satisfied: {
            icon: <XCircle className="w-3 h-3" />,
            label: "Not Satisfied",
            className:
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        },
        partially_satisfied: {
            icon: <AlertCircle className="w-3 h-3" />,
            label: "Partial",
            className:
                "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        },
        fully_satisfied: {
            icon: <CheckCircle className="w-3 h-3" />,
            label: "Satisfied",
            className:
                "bg-brand-green/20 text-brand-green dark:bg-brand-green/10 dark:text-brand-green",
        },
        no_demand: {
            icon: <Circle className="w-3 h-3" />,
            label: "No Demand",
            className:
                "bg-gray-200/20 text-gray-600 dark:bg-gray-800/20 dark:text-gray-400",
        },

        // Renewable statuses
        high_wind_cutoff: {
            icon: <Wind className="w-3 h-3" />,
            label: "High Wind Cutoff",
            className:
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        },
        available: {
            icon: <CheckCircle className="w-3 h-3" />,
            label: "Available",
            className:
                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        },
    };

    const config = statusConfig[status];

    return (
        <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.className}`}
        >
            {config.icon}
            <span>{config.label}</span>
        </div>
    );
}
