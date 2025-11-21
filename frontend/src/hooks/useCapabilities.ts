/**
 * Hook for accessing player capability flags.
 *
 * Capabilities determine what features/pages a player has unlocked.
 * These are bundled with the auth response and updated when player builds facilities.
 *
 * Usage:
 * - Conditional UI rendering: {hasLaboratory && <TechnologyLink />}
 * - Route protection: <RequireCapability capability="has_warehouse">
 * - Feature gating: if (!hasStorage) return <UpgradePrompt />
 */

import { useAuth } from "@/contexts/AuthContext";

/**
 * Player capability flags that control feature access.
 * Null if user is not a settled player.
 */
export interface PlayerCapabilities {
    has_laboratory: boolean; // Can access /technology page
    has_warehouse: boolean; // Can access /resource-market
    has_storage: boolean; // Can access /storage page
    has_network: boolean; // Can access /network page
}

/**
 * Hook to access player's capability flags.
 *
 * @returns Capability flags or null if not a settled player
 *
 * @example
 * ```tsx
 * function TechnologyLink() {
 *     const capabilities = useCapabilities();
 *
 *     if (!capabilities?.has_laboratory) {
 *         return null; // Don't show link if lab not built
 *     }
 *
 *     return <Link to="/technology">Research</Link>;
 * }
 * ```
 */
export function useCapabilities(): PlayerCapabilities | null {
    const { user } = useAuth();
    return user?.capabilities ?? null;
}

/**
 * Hook to check a specific capability.
 * Returns false if not a settled player or capability not unlocked.
 *
 * @param capability - The capability to check
 * @returns true if player has the capability
 *
 * @example
 * ```tsx
 * function ShipmentsSection() {
 *     const hasWarehouse = useHasCapability("has_warehouse");
 *
 *     if (!hasWarehouse) {
 *         return <BuildWarehousePrompt />;
 *     }
 *
 *     return <ShipmentsList />;
 * }
 * ```
 */
export function useHasCapability(
    capability: keyof PlayerCapabilities,
): boolean {
    const capabilities = useCapabilities();
    return capabilities?.[capability] ?? false;
}
