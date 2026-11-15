/**
 * Types for the Power Priorities UI feature.
 *
 * These types extend the API schema types with UI-specific properties.
 */

import type { ApiSchema, ApiResponse, components } from "@/types/api-helpers";

/** Bid item (consumption/demand) */
export type BidItem = ApiSchema<"BidItem">;

/** Ask item (production/supply) */
export type AskItem = ApiSchema<"AskItem">;

/** Power priority item from the API (bid or ask union type) */
export type PowerPriorityItem = BidItem | AskItem;

/** Response from GET /api/v1/power-priorities */
export type PowerPrioritiesData = ApiResponse<
    "/api/v1/power-priorities",
    "get"
>;

/** Renewable facility type */
export type RenewableFacilityType = string;

/** Interaction mode for the UI */
export type InteractionMode = "drag" | "price";

/** Side of the market (ask=production, bid=consumption) */
export type MarketSide = "ask" | "bid";

/**
 * Facility status types extracted from the generated API schema. These stay in
 * sync automatically via `npm run generate-types`.
 */
export type ProductionStatus =
    components["schemas"]["FacilityStatuses"]["production"][string];
export type ConsumptionStatus =
    components["schemas"]["FacilityStatuses"]["consumption"][string];

/**
 * Renewable status - extends backend type with UI-only "available" status.
 * Backend only sends status when there's an issue (e.g., high_wind_cutoff).
 * Frontend uses "available" to represent normal operation (no status from
 * backend).
 */
type BackendRenewableStatus =
    components["schemas"]["FacilityStatuses"]["renewables"][string];
export type RenewableStatus = BackendRenewableStatus | "available";

/** Pending changes in edit mode */
export interface PendingChanges {
    /** Modified unified priority array (drag mode) */
    priorities: PowerPriorityItem[];
    /** Modified prices keyed by `${side}-${type}` (price mode) */
    prices: Record<string, number>;
}

/** Extended priority item for UI display */
export type PriorityItemWithMeta = PowerPriorityItem & {
    /** Whether this item is a "ghost" from the opposite table */
    isGhost: boolean;
};
