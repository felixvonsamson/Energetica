/**
 * The Recap between two Rounds (#1013), printed as a newspaper: The Megawatt
 * Times. A white page with a drop shadow and serif type, which looks nothing
 * like the rest of the UI on purpose, so it reads as a report on the year.
 *
 * It has two sections, kept strictly apart:
 *
 * - "The Year in Review" tells what happened in the Round just closed: a "Lights
 *   out" report if the grid went down, an article on the opening of the market
 *   in Round 1, every event that fired as an article ending in a line of plain
 *   numbers, and the room's figures.
 * - "The Year Ahead" tells what the next Round holds: how much demand grows
 *   (#1226), each facility that unlocks, with a black-and-white photo, a carbon
 *   tax vote if the Round holds one (#1014), the switch to buying fuel by hand
 *   if the Round makes it, the Round's events with their exact effect, the
 *   change in peak demand, and a seasonal outlook that only hints at the
 *   seasonal events, with no figures. After the last Round, a "Final Edition"
 *   banner takes its place.
 *
 * Players and the facilitator read the same page. A note, such as a player's
 * loan payment, can be stuck on the page's top corner as a post-it.
 */

import { type ReactNode, useEffect } from "react";

import { workshopFacilityImages } from "@/lib/workshop-facilities";
import { SEASON_LABELS } from "@/lib/workshop-timeline";
import { taxPerTonne } from "@/lib/workshop-vote";
// Kept for the hidden weather section below.
// import { weatherLine } from "@/lib/workshop-weather";
import type { ApiSchema } from "@/types/api-helpers";
import {
    formatEmissions,
    formatEnergy,
    formatMoney,
    formatPower,
} from "@energetica/core/format-utils";

type WorkshopRecap = ApiSchema<"WorkshopRecap">;
type RecapStory = ApiSchema<"RecapStory">;
type RecapUnlock = ApiSchema<"RecapUnlock">;
type YearAhead = ApiSchema<"YearAhead">;
type RecapVote = ApiSchema<"RecapVote">;

const FONTS_ID = "recap-newspaper-fonts";
const FONTS_URL =
    "https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap";

const MASTHEAD = "font-['UnifrakturMaguntia',serif]";
const HEADLINE = "font-['Playfair_Display',serif]";
const BODY = "font-['Libre_Caslon_Text',Georgia,serif]";
const COLUMNS = "gap-8 md:columns-2 md:[column-rule:1px_solid_#a3a3a3]";

/** Loads the newspaper's fonts, once, the first time a Recap is shown. */
function useNewspaperFonts() {
    useEffect(() => {
        if (document.getElementById(FONTS_ID)) return;
        const link = document.createElement("link");
        link.id = FONTS_ID;
        link.rel = "stylesheet";
        link.href = FONTS_URL;
        document.head.appendChild(link);
    }, []);
}

export function RecapNewspaper({
    recap,
    note,
}: {
    recap: WorkshopRecap;
    note?: ReactNode;
}) {
    useNewspaperFonts();
    const [lead, ...rest] = recap.stories;

    return (
        <article
            className={`relative mx-auto max-w-6xl bg-white p-5 text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_16px_48px_rgba(0,0,0,0.3)] md:p-10 ${BODY}`}
        >
            {note && (
                <div className="absolute -top-3 -right-2 z-10 md:-right-4">
                    {note}
                </div>
            )}
            <Masthead recap={recap} />
            <LightsOut recap={recap} />

            <SectionBanner
                title="The Year in Review"
                note={`Round ${recap.round}`}
            />
            <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
                <div>
                    {recap.round === 1 && <OpeningArticle />}
                    {lead ? (
                        <>
                            <Article story={lead} lead />
                            {rest.length > 0 && (
                                <div
                                    className={`border-t border-neutral-900 pt-5 ${COLUMNS}`}
                                >
                                    {rest.map((story) => (
                                        <Article
                                            key={`${story.event}-${story.season}`}
                                            story={story}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="py-10 text-center text-2xl italic">
                            {recap.blackout
                                ? "Apart from the blackout, the year passed without incident."
                                : "A quiet year. Nothing out of the ordinary to report."}
                        </p>
                    )}
                </div>
                <aside className="space-y-6 lg:border-l lg:border-neutral-900 lg:pl-6">
                    <ByTheNumbers recap={recap} />
                    {/* Hidden, see Weather below. */}
                    {/* <Weather recap={recap} /> */}
                </aside>
            </div>

            {recap.year_ahead ? (
                <YearAheadSection yearAhead={recap.year_ahead} />
            ) : (
                <>
                    <SectionBanner title="Final Edition" />
                    <p className="text-center text-xl italic">
                        This was the last year.
                    </p>
                </>
            )}
        </article>
    );
}

function YearAheadSection({ yearAhead }: { yearAhead: YearAhead }) {
    return (
        <>
            <SectionBanner
                title="The Year Ahead"
                note={`Round ${yearAhead.round}`}
            />
            <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
                <div className="space-y-6">
                    <GrowthArticle
                        growth={yearAhead.demand_growth}
                        round={yearAhead.round}
                    />
                    {yearAhead.unlocks.map((unlock, i) => (
                        <UnlockArticle
                            key={unlock.facility}
                            unlock={unlock}
                            round={yearAhead.round}
                            flip={i % 2 === 1}
                        />
                    ))}
                    {yearAhead.carbon_tax_vote && (
                        <VoteArticle
                            vote={yearAhead.carbon_tax_vote}
                            round={yearAhead.round}
                        />
                    )}
                    {yearAhead.manual_fuel_procurement_starts && (
                        <FuelArticle round={yearAhead.round} />
                    )}
                    {yearAhead.stories.length > 0 && (
                        <div
                            className={`border-t border-neutral-900 pt-5 ${COLUMNS}`}
                        >
                            {yearAhead.stories.map((story) => (
                                <Article key={story.event} story={story} />
                            ))}
                        </div>
                    )}
                </div>
                <aside className="space-y-6 lg:border-l lg:border-neutral-900 lg:pl-6">
                    <DemandForecast yearAhead={yearAhead} />
                    <SeasonalOutlook yearAhead={yearAhead} />
                </aside>
            </div>
        </>
    );
}

function Masthead({ recap }: { recap: WorkshopRecap }) {
    return (
        <header className="text-center">
            <div className="flex items-end justify-between border-b border-neutral-900 pb-1 text-[0.7rem] tracking-wide uppercase">
                <span>Vol. I · No. {recap.round}</span>
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
                    End of Round {recap.round} of {recap.round_count}
                </span>
                <span className="italic normal-case">
                    {recap.year_ahead
                        ? `The year in review · The outlook for Round ${recap.year_ahead.round}`
                        : "Final edition"}
                </span>
            </div>
        </header>
    );
}

function LightsOut({ recap }: { recap: WorkshopRecap }) {
    if (!recap.blackout) return null;
    return (
        <section className="mt-5 border-4 border-neutral-900 p-4 text-center">
            <p className="text-xs font-bold tracking-[0.4em] uppercase">
                Special report
            </p>
            <h2
                className={`mt-1 text-4xl leading-none font-black uppercase md:text-6xl ${HEADLINE}`}
            >
                Lights out in {SEASON_LABELS[recap.blackout].toLowerCase()}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg italic">
                The grid could not cover the demand that must always be served,
                and went down.
                {recap.blackout !== "winter" &&
                    " The rest of the year was called off."}
                {recap.year_ahead &&
                    " Every producer starts next year with its cash restored to the original budget."}
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

/** An event: its name as the title, its headline as the body. */
function Article({ story, lead }: { story: RecapStory; lead?: boolean }) {
    return (
        <section className="mb-6 break-inside-avoid">
            <Kicker>
                {story.season ? SEASON_LABELS[story.season] : "All year"}
                {story.severity !== "base" && ` · ${story.severity}`}
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

/**
 * The start of the game, told in Round 1's Recap: the new energy companies that
 * have started supplying the country's electricity.
 */
function OpeningArticle() {
    return (
        <section className="mb-6 border-b border-neutral-900 pb-6">
            <Kicker>Business · Special</Kicker>
            <h3
                className={`mt-1 text-3xl leading-[1.05] font-black md:text-4xl ${HEADLINE}`}
            >
                New energy companies take over the grid
            </h3>
            <p className="mt-2 text-justify leading-relaxed hyphens-auto">
                The country's electricity market has opened to competition. A
                handful of new energy companies, each with fresh capital and big
                ambitions, have started building power plants and selling their
                electricity on the market. Every season they name their price,
                and the cheapest offers keep the lights on. Investors and
                households alike are watching: who will build wisely, who will
                overspend, and what the new market will cost the planet in CO₂.
            </p>
        </section>
    );
}

/** Why a facility reached the market, as the first lines of its article. */
function unlockStory(unlock: RecapUnlock): string {
    switch (unlock.trigger) {
        case "investment_threshold":
            return `After a year of heavy buying of ${unlock.base_name ?? "its predecessor"}, manufacturers have brought its successor to market.`;
        case "round_gate":
            return "Engineers have finished the first commercial designs, and builders are taking orders.";
        case "format_lever":
            return "With the grid now planned season by season, storage that holds energy for months is worth building, and builders are taking orders.";
        default:
            throw unlock.trigger satisfies never;
    }
}

/** A facility that unlocks, announced with a black-and-white photo. */
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
                    src={workshopFacilityImages[unlock.facility]}
                    alt={unlock.name}
                    className="aspect-[4/3] w-full border border-neutral-900 object-cover contrast-125 grayscale"
                />
                <figcaption className="mt-1 text-xs italic">
                    Pictured: {unlock.name}.
                </figcaption>
            </figure>
            <div>
                <Kicker>New technology · from Round {round}</Kicker>
                <h3
                    className={`mt-1 text-3xl leading-[1.05] font-black ${HEADLINE}`}
                >
                    {unlock.name} reaches the market
                </h3>
                <p className="mt-2 text-justify leading-relaxed">
                    {unlockStory(unlock)} Companies can buy it in the next
                    Investment phase.
                </p>
                <p className="mt-2 border-l-2 border-neutral-900 pl-2 text-sm font-bold">
                    {unlock.name} is on sale from Round {round}
                </p>
            </div>
        </section>
    );
}

/**
 * How much demand grows into the next Round, before any event (#1226). Told
 * without the formula behind it.
 */
function GrowthArticle({ growth, round }: { growth: number; round: number }) {
    const percent = Math.round((growth - 1) * 100);
    return (
        <section className="border-t border-neutral-900 pt-5 first:border-t-0 first:pt-0">
            <Kicker>Economy · Round {round}</Kicker>
            <h3
                className={`mt-1 text-3xl leading-[1.05] font-black ${HEADLINE}`}
            >
                {percent === 0
                    ? "Demand is expected to hold steady next year"
                    : `Demand is expected to ${percent > 0 ? "grow" : "fall"} ${Math.abs(percent)}% next year`}
            </h3>
            <p className="mt-2 text-justify leading-relaxed">
                As the economy changes, so does the country's appetite for
                electricity. Analysts have revised their forecasts for the year
                ahead. Any events of the year come on top.
            </p>
        </section>
    );
}

/** A carbon tax vote the next Round holds in its Investment phase (#1014). */
function VoteArticle({ vote, round }: { vote: RecapVote; round: number }) {
    const perTonne = formatMoney(taxPerTonne(vote.tax_rate));
    return (
        <section className="border-t border-neutral-900 pt-5 first:border-t-0 first:pt-0">
            <Kicker>Politics · Round {round}</Kicker>
            <h3
                className={`mt-1 text-3xl leading-[1.05] font-black ${HEADLINE}`}
            >
                Carbon tax goes to the vote
            </h3>
            <p className="mt-2 text-justify leading-relaxed">
                Companies will vote on a carbon tax during the next Investment
                phase. If more of them vote for it than against, every company
                pays a tax on the CO₂ its facilities emit, and the money is
                shared equally among all of them. Once passed, the tax stays for
                good.
            </p>
            <p className="mt-2 border-l-2 border-neutral-900 pl-2 text-sm font-bold">
                Proposed tax: {perTonne} coins per tonne of CO₂
            </p>
        </section>
    );
}

/** The next Round switches fuel procurement from automatic to manual. */
function FuelArticle({ round }: { round: number }) {
    return (
        <section className="border-t border-neutral-900 pt-5 first:border-t-0 first:pt-0">
            <Kicker>Markets · Round {round}</Kicker>
            <h3
                className={`mt-1 text-3xl leading-[1.05] font-black ${HEADLINE}`}
            >
                Companies to buy their own fuel
            </h3>
            <p className="mt-2 text-justify leading-relaxed">
                Until now, fuel was delivered as it was burned. From next year,
                companies buy it themselves: each season, next to their prices,
                they choose how much of each fuel their facilities burn to buy.
                Fuel left over carries over to the next season, but a facility
                that runs out of fuel cannot produce.
            </p>
            <p className="mt-2 border-l-2 border-neutral-900 pl-2 text-sm font-bold">
                Fuel is bought by hand from Round {round}
            </p>
        </section>
    );
}

/**
 * The next Round's seasonal events, only hinted at: what experts expect, with
 * no figures.
 */
function SeasonalOutlook({ yearAhead }: { yearAhead: YearAhead }) {
    if (yearAhead.forecasts.length === 0) return null;
    return (
        <section className="break-inside-avoid">
            <p className="border-b-2 border-neutral-900 text-[0.7rem] font-bold tracking-[0.2em] uppercase">
                Seasonal outlook
            </p>
            {/* A season can hold a climate event and a fuel shock, so the
                text tells two of its forecasts apart. */}
            {yearAhead.forecasts.map((forecast) => (
                <div
                    key={`${forecast.season}-${forecast.text}`}
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

/** The change in peak demand from this Round to the next, as a percentage. */
function demandChangeLabel(thisRound: number, nextRound: number): string {
    const change = Math.round((nextRound / thisRound - 1) * 100);
    if (change === 0) return "Steady";
    return `${change > 0 ? "+" : "−"}${Math.abs(change)}%`;
}

function DemandForecast({ yearAhead }: { yearAhead: YearAhead }) {
    const demand = yearAhead.demand;
    if (!demand) return null;
    return (
        <section className="break-inside-avoid border-2 border-neutral-900 p-4 text-center">
            <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase">
                Demand forecast · Round {yearAhead.round}
            </p>
            <p className={`text-6xl font-black ${HEADLINE}`}>
                {demandChangeLabel(
                    demand.peak_this_round,
                    demand.peak_next_round,
                )}
            </p>
            <p className="text-sm italic">
                Peak demand {formatPower(demand.peak_this_round)} →{" "}
                {formatPower(demand.peak_next_round)}
            </p>
        </section>
    );
}

function ByTheNumbers({ recap }: { recap: WorkshopRecap }) {
    const figures = recap.figures;
    const rows: [string, string][] = [
        ["CO₂ this year", formatEmissions(figures.emissions_round)],
        ["CO₂ since Round 1", formatEmissions(figures.emissions_total)],
        ["Capacity built", formatPower(figures.capacity_built)],
        ["Energy sold", formatEnergy(figures.energy_sold)],
        [
            "Average price",
            figures.average_price === null
                ? "—"
                : `${formatMoney(figures.average_price)} coins/MWh`,
        ],
        [
            "From renewables",
            figures.renewable_share === null
                ? "—"
                : `${Math.round(figures.renewable_share * 100)}%`,
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

/*
 * Hidden from the Recap: the section was long and told players little they
 * could act on. Kept, as a short text version may come back. To show it again,
 * uncomment this, its import and its use in the Year in Review.
 *
 * How each season's wind and sunshine compared with a normal season's. Hydro
 * follows a fixed table, so it is left out.
 *
function Weather({ recap }: { recap: WorkshopRecap }) {
    if (recap.weather.length === 0) return null;
    return (
        <section className="break-inside-avoid">
            <p className="border-b-2 border-neutral-900 text-[0.7rem] font-bold tracking-[0.2em] uppercase">
                Weather
            </p>
            {recap.weather.map((report) => (
                <div
                    key={report.season}
                    className="border-b border-dotted border-neutral-400 py-2"
                >
                    <p className={`text-lg font-bold italic ${HEADLINE}`}>
                        {SEASON_LABELS[report.season]}
                    </p>
                    <p className="text-sm leading-snug">
                        {weatherLine(report)}
                    </p>
                </div>
            ))}
        </section>
    );
}
*/
