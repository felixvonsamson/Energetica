/**
 * Date and time utilities for Energetica. Provides month name conversion and
 * other date-related helpers.
 */

/**
 * Month names in order (January = 1, December = 12) Used across the app for
 * consistent date display.
 */
export const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
] as const;

/**
 * Get the month name from a month number (1-12).
 *
 * @param monthNumber - Month number from 1 (January) to 12 (December)
 * @returns The month name, or "Unknown" if out of range
 */
export function getMonthName(monthNumber: number): string {
    if (monthNumber < 1 || monthNumber > 12) {
        return "Unknown";
    }
    return MONTH_NAMES[monthNumber - 1] ?? "Unknown";
}

/**
 * Get the season name based on the month number.
 *
 * @param monthNumber - Month number from 1 (January) to 12 (December)
 * @returns The season name (Winter, Spring, Summer, Fall)
 */
export function getSeasonName(monthNumber: number): string {
    if (monthNumber >= 1 && monthNumber <= 3) return "Winter";
    if (monthNumber >= 4 && monthNumber <= 6) return "Spring";
    if (monthNumber >= 7 && monthNumber <= 9) return "Summer";
    if (monthNumber >= 10 && monthNumber <= 12) return "Fall";
    return "Unknown";
}
