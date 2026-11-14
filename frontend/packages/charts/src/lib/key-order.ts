/** The order of chart series. */

/** The storage facility types, in the order the storage chart shows them. */
export const STORAGE_KEYS = [
    "small_pumped_hydro",
    "large_pumped_hydro",
    "lithium_ion_batteries",
    "solid_state_batteries",
    "molten_salt",
    "hydrogen_storage",
] as const;

/**
 * Reorders object properties according to a specified key order. Keys not in
 * the order array are placed at the end in their original order.
 */
export function reorderObjectKeys(
    obj: Record<string, unknown>,
    keyOrder: readonly string[],
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // First, add keys in the specified order
    for (const key of keyOrder) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }

    // Then, add any remaining keys that weren't in the order
    for (const key of Object.keys(obj)) {
        if (!(key in result)) {
            result[key] = obj[key];
        }
    }

    return result;
}
