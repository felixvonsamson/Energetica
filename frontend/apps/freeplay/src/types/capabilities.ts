/**
 * Type definitions for player capabilities.
 *
 * These types correspond to backend schemas in energetica/schemas/auth.py
 */

import type { ApiSchema } from "@/types/api-helpers";

/**
 * Player capability flags that control feature access.
 *
 * Capabilities are unlocked when the player builds specific facilities or
 * completes certain milestones. These are bundled with the auth response and
 * updated when the player builds facilities. A settled player will always have
 * capability flags; unsettled players will have null capabilities.
 *
 * Example capabilities:
 *
 * - `has_laboratory`: Unlock technology research
 * - `has_warehouse`: Unlock shipment and storage features
 * - `has_power_facility`: Unlock power generation features
 */
export type PlayerCapabilities = ApiSchema<"PlayerCapabilities">;
