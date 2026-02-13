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
import { cn } from "@/lib/utils";
import { Fuel } from "@/types/fuel";

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
    /** Sting to add to end of name, e.g. "lvl. 4" */
    suffix?: string;
    /** Display mode: "long", "short", or "auto" (short with tooltip) */
    mode?: AssetNameMode;
    /** Additional CSS classes */
    className?: string;
    /** Custom wrapper element (default: span) */
    as?: ElementType;
}

/** Renders an asset name with flexible display options. */
export function AssetName({
    assetId,
    suffix = "",
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
                <div className="text-muted-foreground">{suffix}</div>
            </Component>
        );
    }

    return (
        <Component className={cn("flex gap-1", className)}>
            {displayText}
            <div className="text-muted-foreground">{suffix}</div>
        </Component>
    );
}

/** Props for FacilityName component. */
export interface FacilityNameProps extends Omit<AssetNameProps, "assetId"> {
    /** The facility type from the API */
    facility: string;
}

/**
 * Specialized component for facility names. Alias for AssetName with clearer
 * semantic meaning.
 */
export function FacilityName({ facility, ...props }: FacilityNameProps) {
    return <AssetName assetId={facility} {...props} />;
}

/** Props for TechnologyName component. */
export interface TechnologyNameProps extends Omit<AssetNameProps, "assetId"> {
    /** The technology type from the API */
    technology: string;
    /** Optional technology level to display */
    level: number | null;
}

/**
 * Specialized component for technology names. Alias for AssetName with clearer
 * semantic meaning. TODO: this component really can be used for more than just
 * technologies - so could be named e.g. ProjectName
 */
export function TechnologyName({
    technology,
    level,
    ...props
}: TechnologyNameProps) {
    if (level !== null) {
        return (
            <>
                <AssetName
                    assetId={technology}
                    {...props}
                    suffix={` Level ${level}`}
                />
            </>
        );
    }

    return <AssetName assetId={technology} {...props} />;
}

/** Props for ResourceName component. */
export interface ResourceNameProps extends Omit<AssetNameProps, "assetId"> {
    /** The resource type from the API */
    resource: Fuel;
}

/**
 * Specialized component for resource names. Alias for AssetName with clearer
 * semantic meaning.
 */
export function ResourceName({ resource, ...props }: ResourceNameProps) {
    return <AssetName assetId={resource} {...props} />;
}

/**
 * Utility hook to get asset display names programmatically. Useful when you
 * need the name as a string rather than a component.
 */
export function useAssetName(assetId: string) {
    return {
        long: () => getAssetLongName(assetId),
        short: () => getAssetShortName(assetId),
        get: () => getAssetName(assetId),
    };
}
