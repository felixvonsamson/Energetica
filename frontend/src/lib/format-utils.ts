/**
 * Formatting utilities for displaying game values with appropriate units.
 * Migrated from energetica/static/display_functions.js
 *
 * These functions format numbers displayed on the website in a more readable
 * format. Maintains exact parity with the legacy Jinja frontend for consistent
 * display.
 */

// Unit definitions
const POWER_UNITS = [" W", " kW", " MW", " GW", " TW"];
const ENERGY_UNITS = [" Wh", " kWh", " MWh", " GWh", " TWh"];
const MASS_UNITS = [" kg", " t", " kt", " Mt"];
const MASS_RATE_UNITS = [" g/h", " kg/h", " t/h", " kt/h"]; // Starts at g/h
const CONCENTRATION_UNITS = [" ppb", " ppm", " ‰"];

/**
 * General format function that scales values with appropriate unit prefixes.
 * Inserts thousands separator (') and the right unit.
 *
 * @param value - The numeric value to format
 * @param units - Array of unit strings to use
 * @param threshold - Threshold for scaling to next unit (default: 10,000)
 * @returns Formatted string with thousands separator and unit
 */
function generalFormat(
    value: number,
    units: string[],
    threshold: number = 10_000,
): string {
    let unitIndex = 0;
    while (Math.abs(value) >= threshold && unitIndex < units.length - 1) {
        value /= 1_000;
        unitIndex += 1;
    }
    // Add thousands separator and append unit
    return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unitIndex]}`;
}

/**
 * Format two values with the right unit for upgrade display (before → after).
 *
 * @param value1 - Original value (null if starting from 0)
 * @param value2 - New value
 * @param units - Array of unit strings
 * @returns Formatted string like "100 kW → 200 kW" or "0 → 100 kW"
 */
function generalUpgradeFormat(
    value1: number | null,
    value2: number,
    units: string[],
): string {
    let unitIndex = 0;
    if (value1 == null) {
        while (value2 >= 10_000 && unitIndex < units.length - 1) {
            value2 /= 1_000;
            unitIndex += 1;
        }
        return `0${units[unitIndex][0]} → ${value2.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unitIndex]}`;
    } else {
        while (value1 >= 10_000 && unitIndex < units.length - 1) {
            value1 /= 1_000;
            value2 /= 1_000;
            unitIndex += 1;
        }
        return `${value1.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unitIndex][0]} → ${value2.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unitIndex]}`;
    }
}

// === Power Formatting ===

/**
 * Format power values (W, kW, MW, GW, TW).
 *
 * @example
 *     formatPower(1500); // "1'500 W"
 *     formatPower(15000); // "15 kW"
 */
export function formatPower(power: number, threshold: number = 10_000): string {
    return generalFormat(power, POWER_UNITS, threshold);
}

/**
 * Format power upgrade display.
 *
 * @example
 *     formatUpgradePower(100, 200); // "100 W → 200 W"
 *     formatUpgradePower(null, 50000); // "0 → 50 kW"
 */
export function formatUpgradePower(
    value1: number | null,
    value2: number,
): string {
    return generalUpgradeFormat(value1, value2, POWER_UNITS);
}

// === Energy Formatting ===

/**
 * Format energy values (Wh, kWh, MWh, GWh, TWh).
 *
 * @example
 *     formatEnergy(5000); // "5'000 Wh"
 *     formatEnergy(50000); // "50 kWh"
 */
export function formatEnergy(
    energy: number,
    threshold: number = 10_000,
): string {
    return generalFormat(energy, ENERGY_UNITS, threshold);
}

// === Mass Formatting ===

/**
 * Format mass values (kg, t, kt, Mt).
 *
 * @example
 *     formatMass(500); // "500 kg"
 *     formatMass(15000); // "15 t"
 *     formatMass(1500, 10_000, "of coal in the ground"); // "1'500 kg of coal in the ground"
 */
export function formatMass(
    mass: number,
    threshold: number = 10_000,
    label?: string,
): string {
    const formatted = generalFormat(mass, MASS_UNITS, threshold);
    return label ? `${formatted} ${label}` : formatted;
}

/**
 * Format mass upgrade display.
 *
 * @example
 *     formatUpgradeMass(1000, 2000); // "1'000 kg → 2'000 kg"
 */
export function formatUpgradeMass(
    value1: number | null,
    value2: number,
): string {
    return generalUpgradeFormat(value1, value2, MASS_UNITS);
}

// === Mass Rate Formatting ===

/**
 * Format mass rate values (g/h, kg/h, t/h, kt/h). NOTE: Converts from kg to g
 * by multiplying by 1000.
 *
 * @example
 *     formatMassRate(0.5); // "500 g/h" (0.5 kg = 500 g)
 *     formatMassRate(15); // "15 kg/h"
 */
export function formatMassRate(
    massRate: number,
    threshold: number = 10_000,
): string {
    return generalFormat(massRate * 1_000, MASS_RATE_UNITS, threshold);
}

/**
 * Format mass rate upgrade display. NOTE: Input values are in kg, converted to
 * g for display.
 */
export function formatUpgradeMassRate(
    value1: number | null,
    value2: number,
): string {
    const scaledValue1 = value1 != null ? value1 * 1_000 : null;
    const scaledValue2 = value2 * 1_000;
    return generalUpgradeFormat(scaledValue1, scaledValue2, MASS_RATE_UNITS);
}

// === Concentration Formatting ===

/**
 * Format concentration values (ppb, ppm, ‰).
 *
 * @example
 *     formatConcentration(500); // "500 ppb"
 *     formatConcentration(15000); // "15 ppm"
 */
export function formatConcentration(
    concentration: number,
    threshold: number = 10_000,
): string {
    return generalFormat(concentration, CONCENTRATION_UNITS, threshold);
}

// === Money/Currency Formatting ===

/*
 * COMMENTED OUT: Money formatting with HTML coin icons
 *
 * These functions return HTML strings with <img> tags for coin icons.
 * This approach works for the legacy Jinja templates but should be revisited
 * for React - likely better as components that can handle the icon properly.
 *
 * Uncomment and adapt when implementing money display in the React frontend.
 * Consider creating a <Money amount={value} /> component instead.
 */

// export function formatMoney(
//     price: number,
//     coinIcon: string = "<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>",
// ): string {
//     const units = [coinIcon, "k" + coinIcon, "M" + coinIcon, "Md" + coinIcon];
//     return generalFormat(price, units);
// }

// export function formatMoneyLong(price: number): string {
//     return (
//         price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'") +
//         "<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>"
//     );
// }

// export function formatUpgradeMoney(
//     value1: number | null,
//     value2: number,
// ): string {
//     const coinIcon =
//         "<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>";
//     const moneyUnits = [
//         " " + coinIcon + "/h",
//         "k " + coinIcon + "/h",
//         "M " + coinIcon + "/h",
//     ];
//     return generalUpgradeFormat(value1, value2, moneyUnits);
// }

// === Temperature Formatting ===

/**
 * Format temperature in Celsius.
 *
 * @example
 *     formatTemperature(15.5); // "15.50°C"
 *     formatTemperature(20.123, 1); // "20.1°C"
 *
 * @param temperature - Temperature value
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatTemperature(
    temperature: number,
    decimals: number = 2,
): string {
    return `${temperature.toFixed(decimals)}°C`;
}

// === Timestamp Formatting ===

/**
 * Format a timestamp string to a readable date and time string.
 *
 * @example
 *     formatTimestamp("2024-11-24T15:30:00Z"); // "11/24/2024, 3:30:00 PM"
 *
 * @param timestamp - ISO 8601 timestamp string
 * @returns Formatted date and time string using locale defaults
 */
export function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
}

// === Duration Formatting ===

/**
 * Game engine configuration for duration calculations. Comes from
 * GameEngineConfig type.
 */
interface GameEngineConfig {
    wall_clock_seconds_per_tick: number;
    game_seconds_per_tick: number;
}

/**
 * Format seconds into a human-readable duration string (e.g., "2d 3h 45m").
 * Works for both wall-clock and game time.
 *
 * @example
 *     formatDuration(125); // "2m 5s"
 *     formatDuration(3661); // "1h 1m 1s"
 *     formatDuration(90061); // "1d 1h 1m 1s"
 *
 * @param totalSeconds - Total seconds to format
 * @returns Formatted duration string
 */
export function formatDuration(totalSeconds: number): string {
    if (totalSeconds < 1) {
        return "0s";
    }

    const days = Math.floor(totalSeconds / 86400);
    let remaining = totalSeconds % 86400;

    const hours = Math.floor(remaining / 3600);
    remaining = remaining % 3600;

    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(" ");
}

/**
 * Format game time duration in seconds.
 *
 * @example
 *     formatGameTimeDuration(3600);
 *     // Returns "1h"
 *
 * @param seconds - Duration in game-time seconds
 * @returns Formatted duration string
 */
export function formatGameTimeDuration(seconds: number): string {
    return formatDuration(seconds);
}

/**
 * Format wall-clock time duration in seconds.
 *
 * @example
 *     formatWallClockDuration(3600);
 *     // Returns "1h"
 *
 * @param seconds - Duration in wall-clock seconds
 * @returns Formatted duration string
 */
export function formatWallClockDuration(seconds: number): string {
    return formatDuration(seconds);
}

/**
 * Calculate game time seconds from ticks.
 *
 * @param ticks - Number of game ticks
 * @param config - GameEngineConfig containing timing information
 * @returns Duration in game-time seconds
 */
export function ticksToGameSeconds(
    ticks: number,
    config: GameEngineConfig,
): number {
    return ticks * config.game_seconds_per_tick;
}

/**
 * Calculate wall-clock seconds from ticks.
 *
 * @param ticks - Number of game ticks
 * @param config - GameEngineConfig containing timing information
 * @returns Duration in wall-clock seconds
 */
export function ticksToWallClockSeconds(
    ticks: number,
    config: GameEngineConfig,
): number {
    return ticks * config.wall_clock_seconds_per_tick;
}

// === Achievement-Specific Formatting ===

/** Type for achievement IDs that require specific formatting. */
type AchievementId =
    | "power_consumption"
    | "energy_storage"
    | "mineral_extraction"
    | "network_import"
    | "network_export"
    | "trading"
    | "network";

/**
 * Format achievement values based on their type. Maps achievement IDs to their
 * appropriate formatting function.
 *
 * @param value - The numeric value
 * @param achievementId - The achievement identifier
 * @returns Formatted string with appropriate units
 */
export function formatAchievementValue(
    value: number,
    achievementId: string,
): string {
    const formattingMap: Record<AchievementId, (v: number) => string> = {
        power_consumption: formatPower,
        energy_storage: formatEnergy,
        mineral_extraction: formatMass,
        network_import: formatEnergy,
        network_export: formatEnergy,
        trading: formatMass,
        network: formatPower,
    };

    const formatter = formattingMap[achievementId as AchievementId];
    return formatter ? formatter(value) : value.toString();
}
