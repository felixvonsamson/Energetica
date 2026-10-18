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
 * `--asset-color-{facility-type}` for the fill, and
 * `--asset-color-{facility-type}-fg` for the label colour over that fill.
 *
 * The label is rendered twice and clipped at the fill boundary so each side
 * gets its own foreground colour: the asset-specific FG over the filled
 * portion, and the default track FG over the unfilled portion. This keeps the
 * percentage legible regardless of fill colour or theme.
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
    const slug = facilityType.toLowerCase().replace(/_/g, "-");
    const colorVar = `--asset-color-${slug}`;
    const fgVar = `--asset-color-${slug}-fg`;
    const percentage = Math.round(value);

    return (
        <div
            className={`relative w-full min-w-30 h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}
        >
            <div
                className="h-full transition-all"
                style={{
                    width: `${value}%`,
                    backgroundColor: `var(${colorVar})`,
                }}
            />
            {/* Label over the unfilled (track) portion. */}
            <span
                className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 dark:text-white transition-all"
                style={{ clipPath: `inset(0 0 0 ${value}%)` }}
            >
                {percentage}%
            </span>
            {/* Label over the filled (asset color) portion. The two clip-paths
               must share the same transition so they stay in sync — otherwise
               an animating fill leaves a gap where neither span covers the
               centred text. */}
            <span
                className="absolute inset-0 flex items-center justify-center text-xs font-semibold transition-all"
                style={{
                    color: `var(${fgVar}, var(--foreground))`,
                    clipPath: `inset(0 ${100 - value}% 0 0)`,
                }}
                aria-hidden="true"
            >
                {percentage}%
            </span>
        </div>
    );
}
