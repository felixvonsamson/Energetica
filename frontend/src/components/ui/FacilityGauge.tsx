/**
 * Inline gauge component for displaying facility usage/capacity metrics.
 *
 * Shows a horizontal bar filled according to a percentage value, using
 * facility-specific colors from CSS variables.
 */

interface FacilityGaugeProps {
    /** The facility type (e.g., "coal_burner", "PV_solar") */
    facilityType: string;
    /** The percentage value to display (0-100) */
    value: number;
    /** Optional className for the outer container */
    className?: string;
}

/**
 * Displays a coloured gauge bar with percentage overlay.
 *
 * The gauge uses CSS variables for facility-specific colors:
 * `--asset-color-{facility-type}` where underscores are replaced with hyphens.
 *
 * @example
 *     <FacilityGauge facilityType="coal_burner" value={75.5} />;
 *     // Renders a gauge 75.5% filled with coal_burner's color
 */
export function FacilityGauge({
    facilityType,
    value,
    className = "",
}: FacilityGaugeProps) {
    const colorVar = `--asset-color-${facilityType.toLowerCase().replace(/_/g, "-")}`;
    const percentage = Math.round(value);

    return (
        <div
            className={`relative w-full min-w-[120px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}
        >
            <div
                className="h-full transition-all"
                style={{
                    width: `${value}%`,
                    backgroundColor: `var(${colorVar})`,
                }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white">
                {percentage}%
            </span>
        </div>
    );
}
