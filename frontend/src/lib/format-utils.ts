/**
 * Formatting utilities for displaying game values with appropriate units.
 * Migrated from energetica/static/display_functions.js
 *
 * These functions format numbers displayed on the website in a more readable format.
 * Maintains exact parity with the legacy Jinja frontend for consistent display.
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
 * formatPower(1500) // "1'500 W"
 * formatPower(15000) // "15 kW"
 */
export function formatPower(power: number, threshold: number = 10_000): string {
    return generalFormat(power, POWER_UNITS, threshold);
}

/**
 * Format power upgrade display.
 *
 * @example
 * formatUpgradePower(100, 200) // "100 W → 200 W"
 * formatUpgradePower(null, 50000) // "0 → 50 kW"
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
 * formatEnergy(5000) // "5'000 Wh"
 * formatEnergy(50000) // "50 kWh"
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
 * formatMass(500) // "500 kg"
 * formatMass(15000) // "15 t"
 */
export function formatMass(mass: number, threshold: number = 10_000): string {
    return generalFormat(mass, MASS_UNITS, threshold);
}

/**
 * Format mass upgrade display.
 *
 * @example
 * formatUpgradeMass(1000, 2000) // "1'000 kg → 2'000 kg"
 */
export function formatUpgradeMass(
    value1: number | null,
    value2: number,
): string {
    return generalUpgradeFormat(value1, value2, MASS_UNITS);
}

// === Mass Rate Formatting ===

/**
 * Format mass rate values (g/h, kg/h, t/h, kt/h).
 * NOTE: Converts from kg to g by multiplying by 1000.
 *
 * @example
 * formatMassRate(0.5) // "500 g/h" (0.5 kg = 500 g)
 * formatMassRate(15) // "15 kg/h"
 */
export function formatMassRate(
    massRate: number,
    threshold: number = 10_000,
): string {
    return generalFormat(massRate * 1_000, MASS_RATE_UNITS, threshold);
}

/**
 * Format mass rate upgrade display.
 * NOTE: Input values are in kg, converted to g for display.
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
 * formatConcentration(500) // "500 ppb"
 * formatConcentration(15000) // "15 ppm"
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
 * @param temperature - Temperature value
 * @param decimals - Number of decimal places (default: 2)
 *
 * @example
 * formatTemperature(15.5) // "15.50°C"
 * formatTemperature(20.123, 1) // "20.1°C"
 */
export function formatTemperature(
    temperature: number,
    decimals: number = 2,
): string {
    return `${temperature.toFixed(decimals)}°C`;
}

// === Duration Formatting ===

/*
 * COMMENTED OUT: Duration and time formatting functions
 *
 * These functions either:
 * 1. Return HTML strings with <span> tags (formatDuration, calculateDelivery)
 * 2. Require global game constants that aren't available yet (formatDays, formatDuration)
 * 3. Use hardcoded timezone (formatDateString)
 *
 * Uncomment and adapt when implementing construction/delivery timers.
 * Consider:
 * - Using React Context for game constants (inGameSecondsPerTick, clockTime)
 * - Creating components like <Duration ticks={100} /> instead of HTML strings
 * - Using user's timezone or making it configurable
 */

// function formatMinutes(totalMinutes: number): string {
//     if (totalMinutes < 1) {
//         return `${Math.floor(totalMinutes * 60)}s`;
//     }
//     const days = Math.floor(totalMinutes / 1440);
//     totalMinutes -= days * 1440;
//     const hours = Math.floor(totalMinutes / 60);
//     totalMinutes -= hours * 60;
//     const minutes = Math.floor(totalMinutes);
//     let duration = "";
//     if (days > 0) {
//         duration += `${days}d `;
//     }
//     if (hours > 0) {
//         duration += `${hours}h `;
//     }
//     if (minutes > 0) {
//         duration += `${minutes}m `;
//     }
//     return duration.trim();
// }

// export function formatDuration(
//     ticks: number,
//     inGameSecondsPerTick: number,
//     clockTime: number,
// ): string {
//     const inGameMinutes = (ticks * inGameSecondsPerTick) / 60;
//     const realMinutes = (ticks * clockTime) / 60;
//     const inGameTime = formatMinutes(inGameMinutes);
//     const realTime = formatMinutes(realMinutes);
//     return `${inGameTime} &ensp; <span class="transparency_txt dark">(${realTime})</span>`;
// }

// export function formatDays(
//     ticks: number,
//     inGameSecondsPerTick: number,
// ): number {
//     return Math.round((ticks * inGameSecondsPerTick) / 86_400);
// }

// export function calculateDelivery(
//     deltaQ: number,
//     deltaR: number,
//     transportSpeed: number,
//     inGameSecondsPerTick: number,
//     clockTime: number,
// ): string {
//     const dist = Math.sqrt(
//         2 * (Math.pow(deltaQ, 2) + Math.pow(deltaR, 2) + deltaQ * deltaR),
//     );
//     return formatDuration(
//         (dist * transportSpeed) / inGameSecondsPerTick,
//         inGameSecondsPerTick,
//         clockTime,
//     );
// }

// export function formatDateTime(dateTimeString: string): string {
//     const dateTime = new Date(dateTimeString);
//     const now = new Date();
//     const date = dateTime.getDate();
//     const monthIndex = dateTime.getMonth();
//     const hours = dateTime.getHours().toString().padStart(2, "0");
//     const minutes = dateTime.getMinutes().toString().padStart(2, "0");
//     const seconds = dateTime.getSeconds().toString().padStart(2, "0");
//     const months = [
//         "Jan",
//         "Feb",
//         "Mar",
//         "Apr",
//         "May",
//         "Jun",
//         "Jul",
//         "Aug",
//         "Sep",
//         "Oct",
//         "Nov",
//         "Dec",
//     ];
//
//     if (dateTime.toDateString() === now.toDateString()) {
//         return `${hours}:${minutes}:${seconds}`;
//     } else {
//         return `${date} ${months[monthIndex]} ${hours}:${minutes}:${seconds}`;
//     }
// }

// export function formatDateString(dateString: string): string {
//     const date = new Date(dateString);
//     const currentDate = new Date();
//     if (date.toDateString() === currentDate.toDateString()) {
//         return date.toLocaleTimeString(undefined, {
//             hour: "2-digit",
//             minute: "2-digit",
//             hour12: false,
//             timeZone: "Europe/Paris",
//         });
//     } else {
//         const formattedDate =
//             date.getDate() +
//             " " +
//             date.toLocaleString("default", { month: "short" }) +
//             ". " +
//             date.toLocaleTimeString(undefined, {
//                 hour: "2-digit",
//                 minute: "2-digit",
//                 hour12: false,
//                 timeZone: "Europe/Paris",
//             });
//         return formattedDate;
//     }
// }

// === Achievement-Specific Formatting ===

/**
 * Type for achievement IDs that require specific formatting.
 */
type AchievementId =
    | "power_consumption"
    | "energy_storage"
    | "mineral_extraction"
    | "network_import"
    | "network_export"
    | "trading"
    | "network";

/**
 * Format achievement values based on their type.
 * Maps achievement IDs to their appropriate formatting function.
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
