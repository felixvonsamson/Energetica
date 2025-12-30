/**
 * Toggle component for showing/hiding ghost items from the opposite table. When
 * enabled, shows where items from the other table fall in the unified priority
 * list.
 */

interface ViewAllToggleProps {
    /** Whether View All mode is enabled */
    enabled: boolean;
    /** Callback when toggle state changes */
    onChange: (enabled: boolean) => void;
    /** Whether the toggle is disabled (e.g., not in edit mode) */
    disabled?: boolean;
}

/**
 * Toggle switch for View All mode. Shows ghost items from opposite table to
 * provide context about unified priority order.
 */
export function ViewAllToggle({
    enabled,
    onChange,
    disabled = false,
}: ViewAllToggleProps) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-green dark:peer-focus:ring-brand-green rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-green peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </div>
            <span
                className={`text-sm ${
                    disabled
                        ? "text-gray-400 dark:text-gray-600"
                        : "text-gray-700 dark:text-gray-300"
                }`}
            >
                View All: Show opposite table items
            </span>
        </label>
    );
}
