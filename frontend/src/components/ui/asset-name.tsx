/**
 * React components for displaying asset names with flexible formatting.
 *
 * TODO: add 'import' name and colours
 *
 * These components provide a consistent way to render asset names throughout
 * the app, with support for:
 *
 * - Long vs short display forms
 * - Tooltips showing full names when abbreviated
 * - Type-safe asset IDs
 * - Future i18n support
 */

import { ElementType } from "react";

import {
    getAssetName,
    getAssetLongName,
    getAssetShortName,
} from "@/lib/assets/asset-names";

/**
 * Display mode for asset names.
 *
 * - "long": Full name (e.g., "Photovoltaics")
 * - "short": Abbreviated name (e.g., "PV Solar")
 * - "auto": Short name with tooltip showing long name
 */
export type AssetNameMode = "long" | "short" | "auto";

export interface AssetNameProps {
    /** The asset ID from the backend (e.g., "PV_solar", "coal_burner") */
    assetId: string;
    /** Display mode: "long", "short", or "auto" (short with tooltip) */
    mode?: AssetNameMode;
    /** Additional CSS classes */
    className?: string;
    /** Custom wrapper element (default: span) */
    as?: ElementType;
}

/**
 * Renders an asset name with flexible display options.
 *
 * @example
 *     // Full name
 *     <AssetName assetId="PV_solar" mode="long" />;
 *     // Output: "Photovoltaics"
 *
 * @example
 *     // Short name
 *     <AssetName assetId="PV_solar" mode="short" />;
 *     // Output: "PV Solar"
 *
 * @example
 *     // Auto mode: short name with tooltip
 *     <AssetName assetId="PV_solar" mode="auto" />;
 *     // Output: "PV Solar" with tooltip showing "Photovoltaics"
 *
 * @example
 *     // Custom element and styling
 *     <AssetName
 *         assetId="nuclear_reactor_gen4"
 *         mode="short"
 *         as="strong"
 *         className="text-brand-green"
 *     />;
 */
export function AssetName({
    assetId,
    mode = "long",
    className,
    as: Component = "span",
}: AssetNameProps) {
    const assetName = getAssetName(assetId);

    if (!assetName) {
        // Fallback: if asset not found in registry, display the ID
        console.warn(`AssetName: No display name found for asset "${assetId}"`);
        return <Component className={className}>{assetId}</Component>;
    }

    const displayText = mode === "long" ? assetName.long : assetName.short;

    // Auto mode: show short name with tooltip containing long name
    if (mode === "auto" && assetName.long !== assetName.short) {
        return (
            <Component className={className} title={assetName.long}>
                {assetName.short}
            </Component>
        );
    }

    return <Component className={className}>{displayText}</Component>;
}

/** Props for FacilityName component. */
export interface FacilityNameProps extends Omit<AssetNameProps, "assetId"> {
    /** The facility type from the API */
    facility: string;
}

/**
 * Specialized component for facility names. Alias for AssetName with clearer
 * semantic meaning.
 *
 * @example
 *     <FacilityName facility="PV_solar" mode="short" />;
 */
export function FacilityName({ facility, ...props }: FacilityNameProps) {
    return <AssetName assetId={facility} {...props} />;
}

/** Props for TechnologyName component. */
export interface TechnologyNameProps extends Omit<AssetNameProps, "assetId"> {
    /** The technology type from the API */
    technology: string;
    /** Optional technology level to display */
    level?: number;
}

/**
 * Specialized component for technology names. Alias for AssetName with clearer
 * semantic meaning.
 *
 * @example
 *     <TechnologyName technology="nuclear_engineering" mode="auto" />;
 *
 * @example
 *     // With level display
 *     <TechnologyName
 *         technology="nuclear_engineering"
 *         level={3}
 *         mode="auto"
 *     />;
 */
export function TechnologyName({
    technology,
    level,
    ...props
}: TechnologyNameProps) {
    if (level !== undefined) {
        return (
            <>
                <AssetName assetId={technology} {...props} />
                <span> lvl. {level}</span>
            </>
        );
    }

    return <AssetName assetId={technology} {...props} />;
}

/** Props for ResourceName component. */
export interface ResourceNameProps extends Omit<AssetNameProps, "assetId"> {
    /** The resource type from the API */
    resource: string;
}

/**
 * Specialized component for resource names. Alias for AssetName with clearer
 * semantic meaning.
 *
 * @example
 *     <ResourceName resource="uranium" mode="short" />;
 */
export function ResourceName({ resource, ...props }: ResourceNameProps) {
    return <AssetName assetId={resource} {...props} />;
}

/**
 * Utility hook to get asset display names programmatically. Useful when you
 * need the name as a string rather than a component.
 *
 * @example
 *     const name = useAssetName("PV_solar");
 *     console.log(name.long()); // "Photovoltaics"
 *     console.log(name.short()); // "PV Solar"
 *
 * @param assetId - The asset identifier
 * @returns Object with long and short name getters
 */
export function useAssetName(assetId: string) {
    return {
        long: () => getAssetLongName(assetId),
        short: () => getAssetShortName(assetId),
        get: () => getAssetName(assetId),
    };
}
