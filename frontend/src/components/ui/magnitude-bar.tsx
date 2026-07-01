/**
 * Inline data bar for a table's magnitude column.
 *
 * Sibling to {@link FacilityGauge}. Where the gauge shows how full a _bounded_
 * quantity is (state of charge, capacity factor — always a pill with a `%`
 * label), the magnitude bar shows how large a row is _relative to the largest
 * row in the same table_. Width = `|value| / max`, filled with the row's
 * asset/series color, so a table sorted by size reads as a horizontal ranked
 * micro-chart that mirrors the stacked chart above it.
 *
 * The softer `rounded-md` (vs the gauge's `rounded-full`) is the quiet cue that
 * these two bars mean different things while staying the same family.
 */
import { readableTextColor } from "@/lib/charts/color-utils";

interface MagnitudeBarProps {
    /** This row's magnitude. Only its absolute value drives the bar width. */
    value: number;
    /** Largest `|value|` among sibling rows; normalises the fill (0 → empty). */
    max: number;
    /** Resolved fill color: `rgb()`/`#hex`, or a `var(--…)` reference. */
    color: string;
    /** Preformatted value label, e.g. `"12.4 GWh"` or `"$1.2M"`. */
    label: string;
    /** Dim the bar (e.g. when the series is hidden from the chart). */
    dimmed?: boolean;
    className?: string;
}

/**
 * @example
 *     <MagnitudeBar
 *         value={840}
 *         max={2100}
 *         color="rgb(0,119,182)"
 *         label="840 MWh"
 *     />;
 */
export function MagnitudeBar({
    value,
    max,
    color,
    label,
    dimmed = false,
    className = "",
}: MagnitudeBarProps) {
    const fraction = max > 0 ? Math.min(Math.abs(value) / max, 1) : 0;
    const pct = fraction * 100;
    const fg = readableTextColor(color);

    return (
        <div
            className={`relative w-full min-w-30 h-8 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden transition-opacity ${dimmed ? "opacity-40" : ""} ${className}`}
        >
            <div
                className="absolute inset-y-0 left-0 transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
            />
            {/* Label over the unfilled (track) portion — uses default fg. */}
            <span
                className="absolute inset-0 flex items-center justify-end pr-3 text-xs font-semibold font-mono text-gray-800 dark:text-white transition-all"
                style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
            >
                {label}
            </span>
            {/* Label over the filled portion — uses a luminance-picked color.
               Both spans share the transition so the split tracks the fill. */}
            <span
                className="absolute inset-0 flex items-center justify-end pr-3 text-xs font-semibold font-mono transition-all"
                style={{ color: fg, clipPath: `inset(0 ${100 - pct}% 0 0)` }}
                aria-hidden="true"
            >
                {label}
            </span>
        </div>
    );
}
