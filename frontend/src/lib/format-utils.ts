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
const MASS_UNITS = [" kg", " t", " kt", " Mt", " Gt", " Tt"];
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
        const unit = units[unitIndex] ?? "";
        return `0${unit[0] ?? ""} → ${value2.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${unit}`;
    } else {
        while (value1 >= 10_000 && unitIndex < units.length - 1) {
            value1 /= 1_000;
            value2 /= 1_000;
            unitIndex += 1;
        }
        const unit = units[unitIndex] ?? "";
        return `${value1.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${unit[0] ?? ""} → ${value2.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${unit}`;
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

/**
 * Format emissions/large mass values (kg, t, kt, Mt, Gt, Tt).
 *
 * Uses a threshold of 1,000 so that Gt and Tt are reachable.
 *
 * @example
 *     formatEmissions(500); // "500 kg"
 *     formatEmissions(15000); // "15 t"
 *     formatEmissions(1500000000000); // "1500 Mt"
 */
export function formatEmissions(value: number): string {
    return generalFormat(value, MASS_UNITS);
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

/**
 * Formats money with thousands separator and appropriate unit scaling. Scales:
 * $ → k$ → M$ → Md$ (millions → billions)
 */
export function formatMoney(amount: number, long: boolean = false): string {
    if (long) {
        // Long format: just add thousands separator, no scaling
        return amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    }

    // Short format: scale to appropriate unit
    const units = ["", "k", "M", "Md"]; // billions (Md = milliard in French)
    let value = amount;
    let unitIndex = 0;

    while (Math.abs(value) >= 10000 && unitIndex < units.length - 1) {
        value /= 1000;
        unitIndex += 1;
    }

    const formatted = value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return unitIndex > 0 ? `${formatted}${units[unitIndex]}` : formatted;
}

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
 * Format game time duration in seconds.
 *
 * @example
 *     formatGameTimeDuration(3600);
 *     // Returns "1h"
 *
 * @param seconds - Duration in game-time seconds
 * @returns Formatted duration string
 */
function formatGameTimeDuration(totalSeconds: number): string {
    if (totalSeconds < 1) {
        return "0s";
    }

    const years = Math.floor(totalSeconds / 6220800);
    let remaining = totalSeconds % 6220800;

    const days = Math.floor(remaining / 86400);
    remaining = remaining % 86400;

    const hours = Math.floor(remaining / 3600);
    remaining = remaining % 3600;

    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);

    const parts: string[] = [];
    if (years > 0) parts.push(`${years}y`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(" ");
}

/**
 * Format wall-clock time duration in seconds.
 *
 * @example
 *     formatWallClockDuration(3600);
 *     // Returns "1h"
 *
 * @param totalSeconds - Duration in wall-clock seconds
 * @returns Formatted duration string
 */
function formatWallClockDuration(totalSeconds: number): string {
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
 * Calculate game time seconds from ticks.
 *
 * @param ticks - Number of game ticks
 * @param config - GameEngineConfig containing timing information
 * @returns Duration in game-time seconds
 */
function ticksToGameSeconds(ticks: number, config: GameEngineConfig): number {
    return ticks * config.game_seconds_per_tick;
}

/**
 * Calculate wall-clock seconds from ticks.
 *
 * @param ticks - Number of game ticks
 * @param config - GameEngineConfig containing timing information
 * @returns Duration in wall-clock seconds
 */
function ticksToWallClockSeconds(
    ticks: number,
    config: GameEngineConfig,
): number {
    return ticks * config.wall_clock_seconds_per_tick;
}

export function formatDuration(
    ticks: number,
    config: GameEngineConfig,
    compact: boolean = false,
): string {
    const formatted = formatGameTimeDuration(
        ticksToGameSeconds(ticks, config),
    );
    if (!compact) return formatted;
    const parts = formatted.split(" ");
    return parts.slice(0, 2).join(" ");
}

/**
 * Format duration in both game-time and wall-clock for dual display.
 * Returns both representations for components showing "game-time (wall-clock)".
 */
export function formatDurationDual(
    ticks: number,
    config: GameEngineConfig,
    compact: boolean = false,
): { gameTime: string; wallClock: string } {
    const gameFormatted = formatGameTimeDuration(
        ticksToGameSeconds(ticks, config),
    );
    const wallFormatted = formatWallClockDuration(
        ticksToWallClockSeconds(ticks, config),
    );

    if (!compact) return { gameTime: gameFormatted, wallClock: wallFormatted };

    const gameParts = gameFormatted.split(" ");
    const wallParts = wallFormatted.split(" ");
    return {
        gameTime: gameParts.slice(0, 2).join(" "),
        wallClock: wallParts.slice(0, 2).join(" "),
    };
}

/**
 * Calculate ticks remaining from end tick and current tick.
 *
 * @param endTick - The tick when something completes
 * @param currentTick - The current game tick
 * @returns Number of ticks remaining
 */
export function getTicksRemaining(
    endTick: number,
    currentTick: number,
): number {
    return Math.max(0, endTick - currentTick);
}

/**
 * Format ticks remaining as human-readable time duration.
 *
 * @example
 *     formatTicksRemaining(120, config); // "2h" (if each tick is 1 minute)
 *     formatTicksRemaining(45, config); // "45m"
 *
 * @param ticksRemaining - Number of ticks remaining
 * @param config - GameEngineConfig containing timing information
 * @returns Formatted duration string
 */
export function formatTicksRemaining(
    ticksRemaining: number,
    config: GameEngineConfig,
): string {
    const seconds = ticksToWallClockSeconds(ticksRemaining, config);
    return formatWallClockDuration(seconds);
}

// === Cash Flow Formatting ===

/** Time unit constants for cash flow calculations. */
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_GAME_YEAR = 6_220_800; // 72 days

/**
 * Get the number of seconds in a time unit.
 * Uses game-time constants (hours and days are wall-clock equivalent;
 * "year" is one game year = 72 days).
 *
 * @param unit - The time unit ("h", "day", or "year")
 * @returns Number of seconds in the specified unit
 */
export function getSecondsPerUnit(unit: "h" | "day" | "year"): number {
    switch (unit) {
        case "h":
            return SECONDS_PER_HOUR;
        case "day":
            return SECONDS_PER_DAY;
        case "year":
            return SECONDS_PER_GAME_YEAR;
    }
}

/**
 * Get display suffix for a time unit.
 *
 * @param unit - The time unit ("h", "day", or "year")
 * @returns Formatted suffix string (e.g., "/h", "/day", "/year")
 */
export function getUnitSuffix(unit: "h" | "day" | "year"): string {
    switch (unit) {
        case "h":
            return "/h";
        case "day":
            return "/day";
        case "year":
            return "/year";
    }
}

/**
 * Convert cash flow from money per tick to money per time unit.
 *
 * @example
 *     const rate = amountPerTickToCashFlowRate(100, "h", gameEngine);
 *     // Returns hourly cash flow rate in game time
 *
 * @param amountPerTick - Cash flow in money per tick
 * @param unit - Target time unit ("h", "day", or "year")
 * @param config - GameEngineConfig containing timing information
 * @returns Cash flow rate in money per specified time unit
 */
export function amountPerTickToCashFlowRate(
    amountPerTick: number,
    unit: "h" | "day" | "year",
    config: GameEngineConfig,
): number {
    // Convert from money per tick to money per second (game-time)
    const amountPerSecond = amountPerTick / config.game_seconds_per_tick;

    // Convert to the desired time unit
    const secondsPerUnit = getSecondsPerUnit(unit);
    return amountPerSecond * secondsPerUnit;
}

/**
 * Format cash flow as a string with appropriate units.
 *
 * @example
 *     formatCashFlow(100, "h", gameEngine);
 *     // Returns "15k$/h" (formatted with Money scaling)
 *
 * @param amountPerTick - Cash flow in money per tick
 * @param unit - Target time unit ("h", "day", or "year")
 * @param config - GameEngineConfig containing timing information
 * @returns Formatted cash flow string with units
 */
export function formatCashFlow(
    amountPerTick: number,
    unit: "h" | "day" | "year",
    config: GameEngineConfig,
): string {
    const rate = amountPerTickToCashFlowRate(amountPerTick, unit, config);
    const suffix = getUnitSuffix(unit);
    return `${formatMoney(rate)}$${suffix}`;
}

