/**
 * Hook for accessing player capability flags.
 *
 * Capabilities determine what features/pages a player has unlocked. These are
 * bundled with the auth response and updated when player builds facilities.
 *
 * Usage:
 *
 * - Conditional UI rendering: {hasLaboratory && <TechnologyLink />}
 * - Route protection: <RequireCapability capability="has_warehouse">
 * - Feature gating: if (!hasStorage) return <UpgradePrompt />
 */

import { useAuth } from "@/hooks/useAuth";
import type { PlayerCapabilities } from "@/types/capabilities";

// Re-export for convenience (types should come from @/types/capabilities)
export type { PlayerCapabilities };

/**
 * Hook to access player's capability flags.
 *
 * @example
 *     ```tsx
 *     function TechnologyLink() {
 *         const capabilities = useCapabilities();
 *
 *         if (!capabilities?.has_laboratory) {
 *             return null; // Don't show link if lab not built
 *         }
 *
 *         return <Link to="/technology">Research</Link>;
 *     }
 *     ```;
 *
 * @returns Capability flags or null if not a settled player
 */
export function useCapabilities(): PlayerCapabilities | undefined | null {
    const { user } = useAuth();
    if (user === null) return null;
    return user.capabilities;
}

/**
 * Hook to check a specific capability. Returns false if not a settled player or
 * capability not unlocked.
 *
 * @example
 *     ```tsx
 *     function ShipmentsSection() {
 *         const hasWarehouse = useHasCapability("has_warehouse");
 *
 *         if (!hasWarehouse) {
 *             return <BuildWarehousePrompt />;
 *         }
 *
 *         return <ShipmentsList />;
 *     }
 *     ```;
 *
 * @param capability - The capability to check
 * @returns True if player has the capability
 */
export function useHasCapability(
    capability: keyof PlayerCapabilities,
): boolean {
    const capabilities = useCapabilities();
    return capabilities?.[capability] ?? false;
}
