/**
 * The number formats the cards' tooltips share with the Workshop's balance
 * sheet, so a figure reads the same in both.
 */

/** Groups thousands with an apostrophe: 9800 → "9'800". */
function group(value: number): string {
    return Math.round(value)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/** A volume: whole numbers with thousands grouped, one decimal below 10. */
export function formatVolume(value: number): string {
    return Math.abs(value) < 10 && value % 1 !== 0
        ? value.toFixed(1)
        : group(value);
}

/** A rate: one decimal unless it is a whole number. */
export function formatRate(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    if (rounded % 1 === 0) return group(rounded);
    const [whole = "0", decimal = "0"] = Math.abs(rounded)
        .toFixed(1)
        .split(".");
    return `${rounded < 0 ? "−" : ""}${group(Number(whole))}.${decimal}`;
}
