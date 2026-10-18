/**
 * A short guide to getting around the Workshop (#1254), on the intro page. Each
 * step shows the control it is about, using the same component the game uses,
 * so the player knows what to look for on screen.
 *
 * The controls are only pictures here: they sit in an `inert` container, so
 * they cannot be clicked or focused and are hidden from screen readers, which
 * read the step's text instead.
 */

import type { ReactNode } from "react";

import { TypographyH3, TypographyMuted } from "@/components/ui/typography";
import { RoundViewPicker } from "@/components/workshop/round-view-switch";
import { WorkshopTimeline } from "@/components/workshop/workshop-timeline";
import {
    FacilitiesButton,
    PricesButton,
} from "@/components/workshop/workshop-top-bar";

export function WelcomeGuide() {
    return (
        <ol className="space-y-4">
            <GuideStep
                number={1}
                title="Buy facilities"
                preview={
                    <TopBarPreview>
                        <FacilitiesButton />
                    </TopBarPreview>
                }
            >
                The Facilities button in the top bar opens the facility page,
                where you buy power plants and storage during each Investment
                phase.
            </GuideStep>
            <GuideStep
                number={2}
                title="Set your prices"
                preview={
                    <TopBarPreview>
                        <PricesButton panelOpen={false} onClick={() => {}} />
                    </TopBarPreview>
                }
            >
                The Prices button opens the price panel beside the page. There
                you set the price each facility sells at. It opens by itself
                when a price-setting window starts.
            </GuideStep>
            <GuideStep
                number={3}
                title="Move through the game"
                preview={
                    <>
                        {/* A Round in its summer trading. On a phone it is
                            shrunk to fit, since the picture cannot scroll. */}
                        <div className="max-w-full overflow-hidden rounded-lg border border-border-brand max-sm:[zoom:0.65] [&>nav]:border-b-0">
                            <WorkshopTimeline
                                checkpoint={{
                                    kind: "trading_period",
                                    round: 1,
                                    season: "summer",
                                }}
                                roundCount={1}
                                blackouts={[]}
                            />
                        </div>
                        <RoundViewPicker
                            view="charts"
                            onValueChange={() => {}}
                        />
                    </>
                }
            >
                The navigation bar under the top bar shows each Round and its
                seasons. Click a Round or a season to see what happened in it,
                Scores to see the scoreboard, and Intro to come back to this
                guide. The season the session is in is shaded, and the one you
                are looking at is filled in dark green. On a Round&apos;s pages,
                the switch moves between a season&apos;s charts and the
                Round&apos;s balance sheet.
            </GuideStep>
        </ol>
    );
}

function GuideStep({
    number,
    title,
    preview,
    children,
}: {
    number: number;
    title: string;
    preview: ReactNode;
    children: ReactNode;
}) {
    return (
        <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:gap-6">
            <div className="min-w-0 space-y-1 lg:flex-1">
                <TypographyH3 className="flex items-center gap-2 text-xl">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-sm text-fg-on-brand">
                        {number}
                    </span>
                    {title}
                </TypographyH3>
                <TypographyMuted>{children}</TypographyMuted>
            </div>
            <div
                inert
                className="flex min-w-0 flex-col items-start gap-3 lg:w-3/5 lg:shrink-0 lg:items-center"
            >
                {preview}
            </div>
        </li>
    );
}

/** A strip styled like the top bar, so a control looks as it does there. */
function TopBarPreview({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-(--topbar-height) items-center rounded-lg border border-border-brand bg-topbar px-4">
            {children}
        </div>
    );
}
