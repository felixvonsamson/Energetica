/**
 * PROTOTYPE — wipe me. Recap variant A, "Gazette": the Round told as a printed
 * newspaper. A white page with a drop shadow and serif type, which looks
 * nothing like the rest of the UI on purpose, so it reads as the year's news.
 *
 * The page has two sections:
 *
 * - "The Year in Review" tells what happened in the Round just closed: the
 *   blackout, the events that fired by season, and the room's numbers.
 * - "The Year Ahead" tells what changes next Round. Round-wide news (price
 *   shocks, demand shifts) states its effect. Seasonal events already picked
 *   for next Round are only hinted at, with no figures. Each new technology
 *   gets an article with a black-and-white photo.
 *
 * Each story has its event name as the title and its headline as the body,
 * followed by a plain-numbers line.
 */

import { useEffect } from "react";

import { assetImages } from "@/lib/assets/asset-images";
import { formatEmissions, formatEnergy, formatPower } from "@/lib/format-utils";
import { SEASON_LABELS, SEASONS } from "@/lib/workshop-timeline";

import {
    demandChange,
    formatPercent,
    type RecapForecast,
    type RecapScenario,
    type RecapStory,
    type RecapUnlock,
} from "./prototype-data";

const FONTS_URL =
    "https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap";

const MASTHEAD = "font-['UnifrakturMaguntia',serif]";
const HEADLINE = "font-['Playfair_Display',serif]";
const BODY = "font-['Libre_Caslon_Text',Georgia,serif]";
const COLUMNS = "gap-8 md:columns-2 md:[column-rule:1px_solid_#a3a3a3]";

/** Loads the newspaper fonts once. */
function useNewspaperFonts() {
    useEffect(() => {
        if (document.getElementById("gazette-fonts")) return;
        const link = document.createElement("link");
        link.id = "gazette-fonts";
        link.rel = "stylesheet";
        link.href = FONTS_URL;
        document.head.appendChild(link);
    }, []);
}

export function VariantGazette({ scenario }: { scenario: RecapScenario }) {
    useNewspaperFonts();
    const isLast = scenario.round === scenario.roundCount;
    const [lead, ...rest] = scenario.happened;

    return (
        <article
            className={`mx-auto max-w-6xl bg-white p-5 text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_16px_48px_rgba(0,0,0,0.3)] md:p-10 ${BODY}`}
        >
            <Masthead scenario={scenario} isLast={isLast} />
            <Breaking scenario={scenario} />

            <SectionBanner
                title="The Year in Review"
                note={`Round ${scenario.round}`}
            />
            <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
                <div>
                    {lead ? (
                        <>
                            <Article story={lead} lead />
                            {rest.length > 0 && (
                                <div
                                    className={`border-t border-neutral-900 pt-5 ${COLUMNS}`}
                                >
                                    {rest.map((story) => (
                                        <Article key={story.id} story={story} />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="py-10 text-center text-2xl italic">
                            {scenario.blackout
                                ? "Apart from the blackout, the year passed without incident."
                                : "A quiet year. Nothing out of the ordinary to report."}
                        </p>
                    )}
                </div>
                <aside className="lg:border-l lg:border-neutral-900 lg:pl-6">
                    <ByTheNumbers scenario={scenario} />
                </aside>
            </div>

            {isLast ? (
                <>
                    <SectionBanner title="Final Edition" />
                    <p className="text-center text-xl italic">
                        This was the last year. The final scores follow.
                    </p>
                </>
            ) : (
                <YearAhead scenario={scenario} />
            )}
        </article>
    );
}

function YearAhead({ scenario }: { scenario: RecapScenario }) {
    const next = scenario.round + 1;
    const nothing =
        scenario.coming.length === 0 &&
        scenario.forecasts.length === 0 &&
        scenario.unlocks.length === 0;

    return (
        <>
            <SectionBanner title="The Year Ahead" note={`Round ${next}`} />
            <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
                <div className="space-y-6">
                    {scenario.unlocks.map((unlock, i) => (
                        <UnlockArticle
                            key={unlock.id}
                            unlock={unlock}
                            round={next}
                            flip={i % 2 === 1}
                        />
                    ))}
                    {scenario.coming.length > 0 && (
                        <div
                            className={`border-t border-neutral-900 pt-5 ${COLUMNS}`}
                        >
                            {scenario.coming.map((story) => (
                                <Article key={story.id} story={story} />
                            ))}
                        </div>
                    )}
                    {nothing && (
                        <p className="py-6 text-center text-lg italic">
                            Analysts expect a year much like the last.
                        </p>
                    )}
                </div>
                <aside className="space-y-6 lg:border-l lg:border-neutral-900 lg:pl-6">
                    <DemandForecast scenario={scenario} />
                    <SeasonalOutlook forecasts={scenario.forecasts} />
                </aside>
            </div>
        </>
    );
}

function Masthead({
    scenario,
    isLast,
}: {
    scenario: RecapScenario;
    isLast: boolean;
}) {
    return (
        <header className="text-center">
            <div className="flex items-end justify-between border-b border-neutral-900 pb-1 text-[0.7rem] tracking-wide uppercase">
                <span>Vol. I · No. {scenario.round}</span>
                <span className="hidden sm:inline">
                    All the energy news that's fit to print
                </span>
                <span>Price: 1 coin</span>
            </div>
            <h1
                className={`py-2 text-5xl leading-none md:text-7xl ${MASTHEAD}`}
            >
                The Megawatt Times
            </h1>
            <div className="flex items-center justify-between border-y-[3px] border-double border-neutral-900 py-1 text-xs tracking-wide uppercase">
                <span>
                    End of Round {scenario.round} of {scenario.roundCount}
                </span>
                <span className="italic normal-case">
                    {isLast
                        ? "Final edition"
                        : `The year in review · The outlook for Round ${scenario.round + 1}`}
                </span>
            </div>
        </header>
    );
}

function Breaking({ scenario }: { scenario: RecapScenario }) {
    if (!scenario.blackout) return null;
    return (
        <section className="mt-5 border-4 border-neutral-900 p-4 text-center">
            <p className="text-xs font-bold tracking-[0.4em] uppercase">
                Special report
            </p>
            <h2
                className={`mt-1 text-4xl leading-none font-black uppercase md:text-6xl ${HEADLINE}`}
            >
                Lights out in{" "}
                {SEASON_LABELS[scenario.blackout.season].toLowerCase()}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg italic">
                The grid could not cover the demand that must always be served,
                and went down. The rest of the year was called off, and every
                company's cash was reset to the same amount.
            </p>
        </section>
    );
}

/** A section banner, like a newspaper's "World" or "Business" heading. */
function SectionBanner({ title, note }: { title: string; note?: string }) {
    return (
        <div className="mt-8 mb-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-neutral-900" />
            <h2
                className={`text-2xl font-black tracking-wide uppercase md:text-3xl ${HEADLINE}`}
            >
                {title}
            </h2>
            {note && (
                <span className="text-sm text-neutral-600 italic">{note}</span>
            )}
            <span className="h-px flex-1 bg-neutral-900" />
        </div>
    );
}

function Kicker({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[0.7rem] font-bold tracking-[0.2em] text-neutral-600 uppercase">
            {children}
        </p>
    );
}

/** A story: the event's name as the title, its headline as the body. */
function Article({ story, lead }: { story: RecapStory; lead?: boolean }) {
    return (
        <section className="mb-6 break-inside-avoid">
            <Kicker>
                {story.season ? SEASON_LABELS[story.season] : "All year"}
                {story.severity && ` · ${story.severity}`}
            </Kicker>
            <h3
                className={`mt-1 leading-[1.05] font-black ${HEADLINE} ${lead ? "text-4xl md:text-6xl" : "text-2xl"}`}
            >
                {story.name}
            </h3>
            <p
                className={`mt-2 text-justify leading-relaxed hyphens-auto ${lead ? "text-xl" : ""}`}
            >
                {story.headline}
            </p>
            <p className="mt-2 border-l-2 border-neutral-900 pl-2 text-sm font-bold">
                {story.effect}
            </p>
        </section>
    );
}

/** A new technology, announced with a black-and-white photo. */
function UnlockArticle({
    unlock,
    round,
    flip,
}: {
    unlock: RecapUnlock;
    round: number;
    flip: boolean;
}) {
    return (
        <section
            className={`flex flex-col gap-4 border-t border-neutral-900 pt-5 first:border-t-0 first:pt-0 sm:items-start ${flip ? "sm:flex-row-reverse" : "sm:flex-row"}`}
        >
            <figure className="shrink-0 sm:w-64">
                <img
                    src={assetImages[unlock.id]}
                    alt={unlock.facility}
                    className="aspect-[4/3] w-full border border-neutral-900 object-cover contrast-125 grayscale"
                />
                <figcaption className="mt-1 text-xs italic">
                    Pictured: {unlock.facility.toLowerCase()}.
                </figcaption>
            </figure>
            <div>
                <Kicker>New technology · from Round {round}</Kicker>
                <h3
                    className={`mt-1 text-3xl leading-[1.05] font-black ${HEADLINE}`}
                >
                    {unlock.facility} reaches the market
                </h3>
                <p className="mt-2 text-justify leading-relaxed">
                    {unlock.from
                        ? `After a year of heavy buying of ${unlock.from.toLowerCase()}, manufacturers have brought its successor to market.`
                        : "Engineers have finished the first commercial designs, and builders are taking orders."}{" "}
                    Companies can buy it in the next Investment phase.
                </p>
                <p className="mt-2 border-l-2 border-neutral-900 pl-2 text-sm font-bold">
                    {unlock.facility} is on sale from Round {round}
                </p>
            </div>
        </section>
    );
}

/**
 * Seasonal events already picked for next Round. Only hinted at: what experts
 * expect, with no figures, so it might not even come true for a player who
 * reads it as a promise.
 */
function SeasonalOutlook({ forecasts }: { forecasts: RecapForecast[] }) {
    if (forecasts.length === 0) return null;
    const ordered = [...forecasts].sort(
        (a, b) => SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season),
    );
    return (
        <section className="break-inside-avoid">
            <p className="border-b-2 border-neutral-900 text-[0.7rem] font-bold tracking-[0.2em] uppercase">
                Seasonal outlook
            </p>
            {ordered.map((forecast) => (
                <div
                    key={forecast.id}
                    className="border-b border-dotted border-neutral-400 py-2"
                >
                    <p className={`text-lg font-bold italic ${HEADLINE}`}>
                        {SEASON_LABELS[forecast.season]}
                    </p>
                    <p className="text-sm leading-snug">{forecast.text}</p>
                </div>
            ))}
        </section>
    );
}

function DemandForecast({ scenario }: { scenario: RecapScenario }) {
    const change = demandChange(scenario);
    if (change === null || !scenario.demand) return null;
    return (
        <section className="break-inside-avoid border-2 border-neutral-900 p-4 text-center">
            <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase">
                Demand forecast · Round {scenario.round + 1}
            </p>
            <p className={`text-6xl font-black ${HEADLINE}`}>
                {change === 0 ? "Steady" : formatPercent(change)}
            </p>
            <p className="text-sm italic">
                Peak demand {formatPower(scenario.demand.thisRound)} →{" "}
                {formatPower(scenario.demand.nextRound)}
            </p>
        </section>
    );
}

function ByTheNumbers({ scenario }: { scenario: RecapScenario }) {
    const rows: [string, string][] = [
        ["CO₂ this year", formatEmissions(scenario.room.emissionsRound)],
        ["CO₂ since Round 1", formatEmissions(scenario.room.emissionsTotal)],
        ["Capacity built", formatPower(scenario.room.builtCapacity)],
        ["Energy sold", formatEnergy(scenario.room.energySold)],
        ["Average price", `${scenario.room.averagePrice.toFixed(0)} /MWh`],
        [
            "From renewables",
            `${(scenario.room.renewableShare * 100).toFixed(0)}%`,
        ],
    ];
    return (
        <section className="break-inside-avoid">
            <p className="border-b-2 border-neutral-900 text-[0.7rem] font-bold tracking-[0.2em] uppercase">
                The year by the numbers
            </p>
            <table className="w-full text-sm">
                <tbody>
                    {rows.map(([label, value]) => (
                        <tr
                            key={label}
                            className="border-b border-dotted border-neutral-400"
                        >
                            <td className="py-1">{label}</td>
                            <td className="py-1 text-right font-bold tabular-nums">
                                {value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
