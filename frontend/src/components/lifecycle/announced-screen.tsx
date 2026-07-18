/**
 * The announced-phase waiting screen (#862, T4).
 *
 * A run's process is up from creation — the fragment is advertised and (for a
 * private run) the whitelist is being grown — but play does not begin until the
 * instance's own clock crosses `starts_at`, at which point the backend
 * self-starts the sim (`state_update`) and this screen's derived phase flips to
 * `active`, dropping the player into the game. Until then there is nothing to
 * play, so this is a full-screen takeover (no game chrome) rather than a
 * banner: a countdown and the scheduled start, so a whitelisted player who
 * arrives early knows they're in the right place and when to come back.
 *
 * The freeze/ended presentation is deliberately NOT here — that in-game
 * read-only surface is T8 (#866).
 */

import { useEffect, useState } from "react";

import { TypographyBrand } from "@/components/ui/typography";

/** A wall-clock duration split into whole days/hours/minutes/seconds. */
function splitDuration(ms: number): {
    d: number;
    h: number;
    m: number;
    s: number;
} {
    const total = Math.max(0, Math.floor(ms / 1000));
    return {
        d: Math.floor(total / 86400),
        h: Math.floor((total % 86400) / 3600),
        m: Math.floor((total % 3600) / 60),
        s: total % 60,
    };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "Monday, 15 September 2025 at 09:00" in the viewer's locale, or null if
 * unparseable.
 */
function formatStart(iso: string): string | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

export function AnnouncedScreen({ startsAt }: { startsAt: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const target = new Date(startsAt).getTime();
    const remaining = Number.isNaN(target) ? 0 : target - now;
    const { d, h, m, s } = splitDuration(remaining);
    const startLabel = formatStart(startsAt);

    return (
        <div className="flex min-h-svh w-full flex-col items-center justify-center gap-8 p-6 text-center">
            <TypographyBrand className="text-primary text-4xl">
                Energetica
            </TypographyBrand>

            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold sm:text-3xl">
                    The game hasn&apos;t started yet
                </h1>
                {startLabel && (
                    <p className="text-muted-foreground">Starts {startLabel}</p>
                )}
            </div>

            <div
                className="flex items-start gap-3 sm:gap-4"
                role="timer"
                aria-label="Time until the game starts"
            >
                {d > 0 && (
                    <CountdownUnit value={d} label={d === 1 ? "day" : "days"} />
                )}
                <CountdownUnit value={h} label="hours" pad />
                <CountdownUnit value={m} label="minutes" pad />
                <CountdownUnit value={s} label="seconds" pad />
            </div>

            <p className="text-muted-foreground max-w-md text-sm">
                Keep this page open — it&apos;ll drop you into the game the
                moment it begins. No need to refresh.
            </p>
        </div>
    );
}

function CountdownUnit({
    value,
    label,
    pad: shouldPad = false,
}: {
    value: number;
    label: string;
    pad?: boolean;
}) {
    return (
        <div className="flex min-w-14 flex-col items-center gap-1 sm:min-w-20">
            <span className="text-primary text-4xl font-bold tabular-nums sm:text-6xl">
                {shouldPad ? pad(value) : value}
            </span>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {label}
            </span>
        </div>
    );
}
