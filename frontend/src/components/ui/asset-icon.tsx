/**
 * React components for displaying asset icons with flexible sizing.
 *
 * These components provide a consistent way to render asset icons throughout
 * the app, with support for:
 *
 * - Type-safe asset IDs
 * - Configurable size and styling
 * - Graceful fallback for unmapped assets
 * - Semantic component variants (FacilityIcon, TechnologyIcon, etc.)
 */

import { HelpCircle } from "lucide-react";
import { createElement } from "react";

import { getAssetIcon } from "@/lib/assets/asset-icons";
import { cn } from "@/lib/classname-utils";

export interface AssetIconProps {
    /** The asset ID from the backend (e.g., "PV_solar", "coal_burner") */
    assetId: string;
    /** Additional CSS classes */
    className?: string;
    /** Icon size in pixels (default: 20) */
    size?: number;
}

/**
 * Renders an asset icon with flexible sizing and styling.
 *
 * Falls back to HelpCircle icon if the asset is not found in the registry.
 *
 * @example
 *     // Basic usage
 *     <AssetIcon assetId="PV_solar" />;
 *
 * @example
 *     // Custom size and styling
 *     <AssetIcon
 *         assetId="nuclear_reactor"
 *         size={24}
 *         className="text-green-500"
 *     />;
 *
 * @example
 *     // Will show HelpCircle as fallback
 *     <AssetIcon assetId="unknown_facility" />;
 */
export function AssetIcon({ assetId, className, size = 20 }: AssetIconProps) {
    const iconComponent = getAssetIcon(assetId);

    if (!iconComponent) {
        console.warn(`AssetIcon: No icon found for asset "${assetId}"`);
        return createElement(HelpCircle, { className: cn(className), size });
    }

    return createElement(iconComponent, { className: cn(className), size });
}

/** Props for FacilityIcon component. */
export interface FacilityIconProps extends Omit<AssetIconProps, "assetId"> {
    /** The facility type from the API */
    facility: string;
}

/**
 * Specialized component for facility icons. Alias for AssetIcon with clearer
 * semantic meaning.
 *
 * @example
 *     <FacilityIcon facility="PV_solar" size={24} />;
 */
export function FacilityIcon({ facility, ...props }: FacilityIconProps) {
    return <AssetIcon assetId={facility} {...props} />;
}

/** Props for TechnologyIcon component. */
export interface TechnologyIconProps extends Omit<AssetIconProps, "assetId"> {
    /** The technology type from the API */
    technology: string;
}

/**
 * Specialized component for technology icons. Alias for AssetIcon with clearer
 * semantic meaning.
 *
 * @example
 *     <TechnologyIcon technology="nuclear_engineering" />;
 */
export function TechnologyIcon({ technology, ...props }: TechnologyIconProps) {
    return <AssetIcon assetId={technology} {...props} />;
}

/** Props for ResourceIcon component. */
export interface ResourceIconProps extends Omit<AssetIconProps, "assetId"> {
    /** The resource type from the API */
    resource: string;
}

/**
 * Specialized component for resource icons. Alias for AssetIcon with clearer
 * semantic meaning.
 *
 * @example
 *     <ResourceIcon resource="uranium" className="text-green-500" />;
 */
export function ResourceIcon({ resource, ...props }: ResourceIconProps) {
    return <AssetIcon assetId={resource} {...props} />;
}
