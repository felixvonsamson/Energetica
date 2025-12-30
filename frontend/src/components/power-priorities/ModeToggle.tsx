/**
 * ModeToggle component - Toggle between drag and price modes. Allows users to
 * switch between drag-and-drop reordering and price-based reordering for power
 * priorities.
 */

import type { InteractionMode } from "./types";

interface ModeToggleProps {
    /** Current interaction mode */
    mode: InteractionMode;
    /** Callback when mode changes */
    onChange: (mode: InteractionMode) => void;
    /** Whether the toggle is disabled (during edit mode) */
    disabled?: boolean;
}

/**
 * Toggle between drag and price interaction modes. Displays as a button group
 * with the active mode highlighted.
 */
export function ModeToggle({
    mode,
    onChange,
    disabled = false,
}: ModeToggleProps) {
    return (
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
                onClick={() => onChange("drag")}
                disabled={disabled}
                className={[
                    "px-4 py-2 text-sm font-medium transition-colors",
                    mode === "drag"
                        ? "bg-brand-green text-white"
                        : "bg-white dark:bg-dark-bg-secondary text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700",
                    disabled && "opacity-50 cursor-not-allowed",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                Drag
            </button>
            <button
                onClick={() => onChange("price")}
                disabled={disabled}
                className={[
                    "px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600",
                    mode === "price"
                        ? "bg-brand-green text-white"
                        : "bg-white dark:bg-dark-bg-secondary text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700",
                    disabled && "opacity-50 cursor-not-allowed",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                Price
            </button>
        </div>
    );
}
