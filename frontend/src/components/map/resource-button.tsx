/** Button component for selecting resource filters on the map. */

import { RESOURCES } from "@/lib/map-resources";

interface ResourceButtonProps {
    resource: (typeof RESOURCES)[number];
    isActive: boolean;
    onClick: () => void;
}

export function ResourceButton({
    resource,
    isActive,
    onClick,
}: ResourceButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-3 rounded transition-all border-2 flex-1 font-medium ${
                isActive
                    ? "border-white dark:border-white shadow-lg scale-105 text-white dark:text-white"
                    : "text-gray-800 dark:text-gray-200 border-transparent hover:border-gray-400 dark:hover:border-gray-500 bg-bone dark:bg-stone-700 hover:bg-tan-hover dark:hover:bg-stone-600"
            }`}
            style={{
                backgroundColor: isActive
                    ? `hsl(${resource.color}, 55%, 50%)`
                    : undefined,
            }}
        >
            {resource.name}
        </button>
    );
}
