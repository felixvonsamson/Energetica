/** Button component for selecting resource filters on the map. */

import { oklchToString, RESOURCES } from "@/lib/map-resources";

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
                    ? `border-white shadow-lg scale-105 ${resource.color[0] > 0.55 ? "text-black" : "text-white"}`
                    : "bg-pine-500 text-white border-transparent hover:bg-pine-700"
            }`}
            style={{
                backgroundColor: isActive
                    ? oklchToString(resource.color)
                    : undefined,
            }}
        >
            {resource.name}
        </button>
    );
}
