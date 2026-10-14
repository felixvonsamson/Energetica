/**
 * A season's weather, told in the Recap (#1200): how its wind and sunshine
 * compared with a normal season's, in newspaper style. It only tells what
 * happened, never what is coming.
 */

/** A change against normal, as a share: 0.08 is 8% above normal. */
type WeatherChange = { wind: number; solar: number };

/** `change` as a whole percentage, or null if it rounds to nothing. */
function percent(change: number): string | null {
    const rounded = Math.round(change * 100);
    if (rounded === 0) return null;
    return `${Math.abs(rounded)}% ${rounded > 0 ? "above" : "below"}`;
}

/**
 * One line for a season's weather, such as "Wind 8% above normal, sunshine 3%
 * below." The second "normal" is left out when the first one says it.
 */
export function weatherLine({ wind, solar }: WeatherChange): string {
    const windChange = percent(wind);
    const solarChange = percent(solar);
    if (windChange === null && solarChange === null) {
        return "Wind and sunshine normal.";
    }
    if (windChange === null) {
        return `Wind normal, sunshine ${solarChange} normal.`;
    }
    if (solarChange === null) {
        return `Wind ${windChange} normal, sunshine normal.`;
    }
    return `Wind ${windChange} normal, sunshine ${solarChange}.`;
}
