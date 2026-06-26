import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyLead,
    TypographyMuted,
    TypographyP,
} from "@/components/ui/typography";

export const Route = createFileRoute("/app/internal/colors")({
    component: ColorsPage,
    staticData: {
        title: "Color & Gauge Test",
        routeConfig: { requiredRole: null },
    },
});

// Fill levels to test. 47% is the worst case for the "47%" label since the
// text overlaps both the filled and unfilled portion of the gauge.
const FILL_LEVELS = [0, 25, 47, 75, 100] as const;

type Group = {
    title: string;
    note?: string;
    facilities: { type: string; label: string }[];
};

const GROUPS: Group[] = [
    {
        title: "Power — Water",
        facilities: [
            { type: "watermill", label: "watermill" },
            { type: "small_water_dam", label: "small_water_dam" },
            { type: "large_water_dam", label: "large_water_dam" },
        ],
    },
    {
        title: "Power — Nuclear",
        facilities: [
            { type: "nuclear_reactor", label: "nuclear_reactor" },
            { type: "nuclear_reactor_gen4", label: "nuclear_reactor_gen4" },
        ],
    },
    {
        title: "Power — Fossil",
        facilities: [
            { type: "steam_engine", label: "steam_engine" },
            { type: "coal_burner", label: "coal_burner" },
            { type: "gas_burner", label: "gas_burner" },
            { type: "combined_cycle", label: "combined_cycle" },
        ],
    },
    {
        title: "Power — Wind",
        facilities: [
            { type: "windmill", label: "windmill" },
            { type: "onshore_wind_turbine", label: "onshore_wind_turbine" },
            { type: "offshore_wind_turbine", label: "offshore_wind_turbine" },
        ],
    },
    {
        title: "Power — Solar",
        facilities: [
            { type: "CSP_solar", label: "CSP_solar" },
            { type: "PV_solar", label: "PV_solar" },
        ],
    },
    {
        title: "Storage",
        facilities: [
            { type: "small_pumped_hydro", label: "small_pumped_hydro" },
            { type: "large_pumped_hydro", label: "large_pumped_hydro" },
            { type: "lithium_ion_batteries", label: "lithium_ion_batteries" },
            { type: "solid_state_batteries", label: "solid_state_batteries" },
            { type: "molten_salt", label: "molten_salt" },
            { type: "hydrogen_storage", label: "hydrogen_storage" },
        ],
    },
    {
        title: "Extraction",
        facilities: [
            { type: "coal_mine", label: "coal_mine" },
            { type: "gas_drilling_site", label: "gas_drilling_site" },
            { type: "uranium_mine", label: "uranium_mine" },
        ],
    },
    {
        title: "Resources",
        facilities: [
            { type: "coal", label: "coal" },
            { type: "gas", label: "gas" },
            { type: "uranium", label: "uranium" },
            { type: "imports", label: "imports" },
            { type: "exports", label: "exports" },
            { type: "dumping", label: "dumping" },
        ],
    },
    {
        title: "Functional",
        note: "research uses pure white in light mode and near-white in dark mode — a known contrast hot-spot.",
        facilities: [
            { type: "industry", label: "industry" },
            { type: "research", label: "research" },
            { type: "construction", label: "construction" },
            { type: "transport", label: "transport" },
            { type: "carbon_capture", label: "carbon_capture" },
        ],
    },
];

// The gauges that historically have the worst contrast on the label.
const FOCUS_CASES = [
    {
        type: "coal_burner",
        why: "Pure black fill — light-mode label 'text-gray-800' disappears on the filled side.",
    },
    {
        type: "coal",
        why: "Pure black fill — same issue as coal_burner.",
    },
    {
        type: "large_water_dam",
        why: "Very dark navy in light mode — dark label is hard to read on the filled side.",
    },
    {
        type: "transport",
        why: "Saturated purple — dark label has poor contrast on the filled side in light mode.",
    },
    {
        type: "PV_solar",
        why: "Saturated yellow — white label disappears on the filled side in dark mode.",
    },
    {
        type: "research",
        why: "White fill in light mode, near-white in dark mode — label vanishes on the filled side.",
    },
    {
        type: "hydrogen_storage",
        why: "Very light cyan — white label has poor contrast on the filled side in dark mode.",
    },
    {
        type: "uranium_mine",
        why: "Bright yellow — white label disappears on the filled side in dark mode.",
    },
];

function GaugeRow({ type, label }: { type: string; label: string }) {
    return (
        <div className="grid grid-cols-[10rem_1fr] items-center gap-3">
            <code className="text-xs text-muted-foreground truncate" title={type}>
                {label}
            </code>
            <div className="grid grid-cols-5 gap-2">
                {FILL_LEVELS.map((v) => (
                    <FacilityGauge key={v} facilityType={type} value={v} />
                ))}
            </div>
        </div>
    );
}

function FillLevelHeader() {
    return (
        <div className="grid grid-cols-[10rem_1fr] items-center gap-3 mb-2">
            <span />
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                {FILL_LEVELS.map((v) => (
                    <span key={v}>{v}%</span>
                ))}
            </div>
        </div>
    );
}

function ColorsPage() {
    return (
        <AppShell>
            <div className="flex flex-col gap-10 px-6 lg:px-8 max-w-5xl mx-auto py-8">
                <section className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <TypographyH1>Color &amp; Gauge Legibility</TypographyH1>
                        <TypographyLead>
                            Visual regression sheet for asset colors as
                            rendered by{" "}
                            <code className="font-mono text-base">
                                FacilityGauge
                            </code>
                            .
                        </TypographyLead>
                        <TypographyMuted>
                            Each row shows the same gauge at 0%, 25%, 47%, 75%
                            and 100% fill. The 47% case is the worst for the
                            label since &quot;47%&quot; spans both the filled
                            and unfilled portion. Toggle the theme to verify
                            both light and dark mode.
                        </TypographyMuted>
                    </div>
                    <ThemeToggle />
                </section>

                {/* ── Focus cases ───────────────────────────────────────── */}
                <section className="flex flex-col gap-4">
                    <TypographyH2>Contrast hot-spots (regression check)</TypographyH2>
                    <TypographyP>
                        These gauges previously had legibility problems on the
                        filled side. The label is now split at the fill
                        boundary: the unfilled side uses the default track
                        foreground, the filled side uses{" "}
                        <code className="font-mono">
                            --asset-color-&#123;asset&#125;-fg
                        </code>
                        . Eyeball each one in both themes — the
                        &quot;47%&quot; column should read end-to-end.
                    </TypographyP>
                    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
                        <FillLevelHeader />
                        {FOCUS_CASES.map(({ type, why }) => (
                            <div
                                key={type}
                                className="flex flex-col gap-1.5 pb-3 border-b border-border last:border-0 last:pb-0"
                            >
                                <GaugeRow type={type} label={type} />
                                <TypographyMuted className="text-xs pl-[10.75rem]">
                                    {why}
                                </TypographyMuted>
                            </div>
                        ))}
                    </div>
                </section>

                <Separator />

                {/* ── Full matrix ───────────────────────────────────────── */}
                <section className="flex flex-col gap-6">
                    <TypographyH2>All assets</TypographyH2>
                    {GROUPS.map((group) => (
                        <div
                            key={group.title}
                            className="rounded-xl border border-border bg-card p-5"
                        >
                            <TypographyH3 className="mb-1">
                                {group.title}
                            </TypographyH3>
                            {group.note && (
                                <TypographyMuted className="text-xs mb-4">
                                    {group.note}
                                </TypographyMuted>
                            )}
                            <FillLevelHeader />
                            <div className="flex flex-col gap-3">
                                {group.facilities.map((f) => (
                                    <GaugeRow
                                        key={f.type}
                                        type={f.type}
                                        label={f.label}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </section>

                {/* ── On different surfaces ─────────────────────────────── */}
                <section className="flex flex-col gap-4">
                    <TypographyH2>On different surfaces</TypographyH2>
                    <TypographyMuted>
                        The gauge track uses{" "}
                        <code className="font-mono">
                            bg-gray-200 dark:bg-gray-700
                        </code>
                        , which doesn&apos;t adapt to the surrounding surface.
                        Same gauge rendered on background, card, and muted to
                        check that the empty portion still reads as a track.
                    </TypographyMuted>
                    <div className="grid sm:grid-cols-3 gap-3">
                        {[
                            { name: "background", className: "bg-background" },
                            { name: "card", className: "bg-card" },
                            { name: "muted", className: "bg-muted" },
                        ].map((s) => (
                            <div
                                key={s.name}
                                className={`${s.className} border border-border rounded-xl p-4 flex flex-col gap-3`}
                            >
                                <TypographyMuted className="text-xs uppercase tracking-widest">
                                    {s.name}
                                </TypographyMuted>
                                <FacilityGauge
                                    facilityType="onshore_wind_turbine"
                                    value={47}
                                />
                                <FacilityGauge
                                    facilityType="coal_burner"
                                    value={47}
                                />
                                <FacilityGauge
                                    facilityType="PV_solar"
                                    value={47}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </AppShell>
    );
}
