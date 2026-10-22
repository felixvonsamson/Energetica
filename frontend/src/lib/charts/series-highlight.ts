/**
 * Highlighting one series of a chart, for example when the player hovers its
 * row in the table below the chart.
 */

/** The opacity of the other series while one is highlighted. */
export const FADED_SERIES_OPACITY = 0.2;

/**
 * The opacity to draw series `key` at while `highlightedKey` is highlighted.
 * Nothing fades when no series is highlighted, or when the highlighted one is
 * not among `visibleKeys`, such as a hidden facility's row.
 */
export function seriesOpacity(
    key: string,
    highlightedKey: string | null | undefined,
    visibleKeys: readonly string[],
): number {
    if (!highlightedKey || !visibleKeys.includes(highlightedKey)) return 1;
    return key === highlightedKey ? 1 : FADED_SERIES_OPACITY;
}
