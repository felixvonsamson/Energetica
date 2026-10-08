/**
 * Player colors for charts that break data down by player.
 *
 * The current player gets one reserved color. Every other player gets a shade
 * between two theme colors, so the others read as one group and the current
 * player stands out. A moderator, who has no player, sees only the shades.
 *
 * Shades are handed out by each player's position among all players sorted by
 * id, not by which players a chart happens to show, so a player keeps the same
 * shade across charts and settlement points. Positions step through the range
 * by the golden ratio, so players next to each other get shades far apart.
 */

/** A color in the OKLCH space: lightness 0–1, chroma, hue in degrees. */
interface Oklch {
    l: number;
    c: number;
    h: number;
}

const OKLCH_PATTERN =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/[^)]*)?\)$/i;

/** Read an `oklch(L C H)` color, or `null` if it is written any other way. */
export function parseOklch(color: string): Oklch | null {
    const match = color.trim().match(OKLCH_PATTERN);
    if (!match) return null;
    const [, l = "", percent, c = "", h = ""] = match;
    const lightness = parseFloat(l);
    return {
        l: percent ? lightness / 100 : lightness,
        c: parseFloat(c),
        h: parseFloat(h),
    };
}

/** The golden ratio's fractional part: stepping by it spreads points evenly. */
const GOLDEN_STEP = (Math.sqrt(5) - 1) / 2;

/** Where the `index`-th other player falls between the two shade ends, 0–1. */
export function shadePosition(index: number): number {
    return (index * GOLDEN_STEP) % 1;
}

function mix(from: Oklch, to: Oklch, t: number): string {
    const l = from.l + (to.l - from.l) * t;
    const c = from.c + (to.c - from.c) * t;
    const h = from.h + (to.h - from.h) * t;
    return `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;
}

export interface PlayerPalette {
    /** The current player's color. */
    self: string;
    /** One end of the other players' shades, as `oklch(L C H)`. */
    othersFrom: string;
    /** The other end of the other players' shades, as `oklch(L C H)`. */
    othersTo: string;
}

/**
 * Make a function that gives each player's chart color.
 *
 * `playerIds` should list every player in the game, so that shades stay put
 * whichever players a chart shows. A player missing from it, such as one who
 * joined after the list was fetched, gets a position past the listed players
 * worked out from its id alone, so every getter made from the same list gives
 * it the same shade, whatever order they are called in. `currentPlayerId` is
 * `null` for a viewer with no player, who sees every player as an other.
 */
export function playerColorGetter(
    palette: PlayerPalette,
    currentPlayerId: number | null,
    playerIds: Iterable<number>,
): (playerId: number) => string {
    const from = parseOklch(palette.othersFrom);
    const to = parseOklch(palette.othersTo);
    const others = [...new Set(playerIds)]
        .filter((id) => id !== currentPlayerId)
        .sort((a, b) => a - b);
    const positions = new Map(others.map((id, index) => [id, index]));

    return (playerId: number) => {
        if (playerId === currentPlayerId) return palette.self;
        if (!from || !to) return palette.othersFrom;
        const index = positions.get(playerId) ?? others.length + playerId;
        return mix(from, to, shadePosition(index));
    };
}
