import { createFileRoute } from "@tanstack/react-router";
import { Construction, Factory, FlaskConical, Inbox, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
    DataValue,
    TypographyBrand,
    TypographyH1,
    TypographyH2,
    TypographyH3,
    TypographyH4,
    TypographyInlineCode,
    TypographyLarge,
    TypographyLead,
    TypographyMuted,
    TypographyP,
    TypographySmall,
} from "@/components/ui/typography";

export const Route = createFileRoute("/design")({
    component: DesignPage,
    staticData: {
        title: "Design System",
        routeConfig: { requiredRole: null },
    },
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Section({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="py-10 border-b border-border">
            <TypographyH2 className="text-2xl font-bold mb-6 text-foreground">
                {title}
            </TypographyH2>
            {children}
        </section>
    );
}

function SubSection({
    title,
    children,
    todo,
}: {
    title: string;
    children: React.ReactNode;
    todo?: string;
}) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {title}
                </h3>
                {todo && (
                    <span className="text-xs bg-warning/15 text-warning border border-warning/30 rounded px-2 py-0.5 font-mono">
                        TODO: {todo}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/** Renders a single color swatch from a CSS variable name. */
function Swatch({
    variable,
    label,
    small,
}: {
    variable: string;
    label?: string;
    small?: boolean;
}) {
    return (
        <div
            className={`flex flex-col items-center gap-1 ${small ? "min-w-12" : "min-w-16"}`}
        >
            <div
                className={`rounded border border-black/10 dark:border-white/10 ${small ? "w-10 h-10" : "w-14 h-14"}`}
                style={{ background: `var(${variable})` }}
                title={variable}
            />
            <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-16 break-all">
                {label ?? variable.replace(/^--color-/, "").replace(/^--/, "")}
            </span>
        </div>
    );
}

// ─── Route component ───────────────────────────────────────────────────────────

function DesignPage() {
    const navLinks = [
        { id: "colors", label: "Colors" },
        { id: "asset-colors", label: "Asset Colors" },
        { id: "typography", label: "Typography" },
        { id: "buttons", label: "Buttons" },
        { id: "inputs", label: "Inputs" },
        { id: "feedback", label: "Feedback" },
        { id: "progress", label: "Progress" },
        { id: "cards", label: "Cards" },
        { id: "data-display", label: "Data Display" },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Sticky header */}
            <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-baseline gap-3">
                        <TypographyBrand className="text-xl text-primary">
                            Energetica
                        </TypographyBrand>
                        <span className="text-muted-foreground text-sm">
                            Design System
                        </span>
                    </div>
                    <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
                        {navLinks.map((l) => (
                            <a
                                key={l.id}
                                href={`#${l.id}`}
                                className="text-xs px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground whitespace-nowrap transition-colors"
                            >
                                {l.label}
                            </a>
                        ))}
                    </nav>
                    <ThemeToggle />
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 pb-20">
                {/* ── Colors ──────────────────────────────────────────────── */}
                <Section id="colors" title="Color Tokens">
                    <SubSection title="Semantic — Layout & Surface">
                        <Row>
                            <Swatch variable="--background" />
                            <Swatch variable="--foreground" />
                            <Swatch variable="--topbar" />
                            <Swatch variable="--card" />
                            <Swatch variable="--card-foreground" />
                            <Swatch variable="--popover" />
                            <Swatch variable="--popover-foreground" />
                            <Swatch variable="--border" />
                        </Row>
                    </SubSection>

                    <SubSection title="Semantic — Interactive">
                        <Row>
                            <Swatch variable="--primary" />
                            <Swatch variable="--primary-foreground" />
                            <Swatch variable="--secondary" />
                            <Swatch variable="--secondary-foreground" />
                            <Swatch variable="--accent" />
                            <Swatch variable="--accent-foreground" />
                            <Swatch variable="--muted" />
                            <Swatch variable="--muted-foreground" />
                            <Swatch variable="--destructive" />
                            <Swatch variable="--destructive-foreground" />
                        </Row>
                    </SubSection>

                    <SubSection
                        title="Semantic — Status"
                        todo="Consider adding --success and --info as dedicated @theme tokens (like --color-success) so bg-success / text-success work without raw var() in components."
                    >
                        <Row>
                            <Swatch variable="--info" />
                            <Swatch variable="--info-foreground" />
                            <Swatch variable="--warning" />
                            <Swatch variable="--warning-foreground" />
                            <Swatch variable="--success" />
                            <Swatch variable="--success-foreground" />
                        </Row>
                    </SubSection>

                    <SubSection
                        title="Base Palette — Bone (light/warm neutrals)"
                        todo="These are private palette tokens. Components should never reference bone-* directly — always go through a semantic token."
                    >
                        <Row>
                            <Swatch variable="--color-bone-50" />
                            <Swatch variable="--color-bone-100" />
                            <Swatch variable="--color-bone-150" />
                            <Swatch variable="--color-bone-300" />
                            <Swatch variable="--color-bone-600" />
                            <Swatch variable="--color-bone-800" />
                        </Row>
                    </SubSection>

                    <SubSection
                        title="Base Palette — Pine (green brand scale)"
                        todo="Same as bone: palette names are private. Consider adding a --color-brand semantic token (= pine-500) so progress fills, active indicators, and hover borders all use bg-brand instead of bg-pine-500 or the deleted bg-brand."
                    >
                        <Row>
                            <Swatch variable="--color-pine-100" />
                            <Swatch variable="--color-pine-200" />
                            <Swatch variable="--color-pine-500" />
                            <Swatch variable="--color-pine-700" />
                            <Swatch variable="--color-pine-800" />
                            <Swatch variable="--color-pine-900" />
                        </Row>
                    </SubSection>

                    <SubSection title="Sidebar">
                        <Row>
                            <Swatch variable="--sidebar" />
                            <Swatch variable="--sidebar-foreground" />
                            <Swatch variable="--sidebar-primary" />
                            <Swatch variable="--sidebar-primary-foreground" />
                            <Swatch variable="--sidebar-accent" />
                            <Swatch variable="--sidebar-accent-foreground" />
                            <Swatch variable="--sidebar-border" />
                            <Swatch variable="--sidebar-ring" />
                        </Row>
                    </SubSection>

                    <SubSection title="Chart Colors">
                        <Row>
                            <Swatch variable="--chart-1" />
                            <Swatch variable="--chart-2" />
                            <Swatch variable="--chart-3" />
                            <Swatch variable="--chart-4" />
                            <Swatch variable="--chart-5" />
                            <Swatch variable="--chart-6" />
                        </Row>
                    </SubSection>

                    <SubSection title="Map Tile Colors">
                        <Row>
                            <Swatch
                                variable="--map-tile-current-player"
                                label="current-player"
                            />
                            <Swatch
                                variable="--map-tile-other-player"
                                label="other-player"
                            />
                            <Swatch
                                variable="--map-tile-vacant"
                                label="vacant"
                            />
                            <Swatch
                                variable="--map-selected-tile-hover"
                                label="selected-hover"
                            />
                        </Row>
                    </SubSection>
                </Section>

                {/* ── Asset Colors ────────────────────────────────────────── */}
                <Section id="asset-colors" title="Asset Colors">
                    <TypographyMuted className="mb-4">
                        These are stable domain tokens. They are intentionally
                        not semantic — they represent specific physical assets
                        and don't swap with the theme. Dark-mode overrides are
                        defined separately for legibility. Always use{" "}
                        <TypographyInlineCode>
                            --asset-color-*
                        </TypographyInlineCode>{" "}
                        CSS variables via inline styles (as FacilityGauge does).
                        Swatches below are shown on the card background since
                        that's the context they appear in inside charts.
                    </TypographyMuted>

                    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
                        <SubSection title="Power — Water">
                            <Row>
                                <Swatch
                                    variable="--asset-color-watermill"
                                    label="watermill"
                                />
                                <Swatch
                                    variable="--asset-color-small-water-dam"
                                    label="small-water-dam"
                                />
                                <Swatch
                                    variable="--asset-color-large-water-dam"
                                    label="large-water-dam"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Power — Nuclear">
                            <Row>
                                <Swatch
                                    variable="--asset-color-nuclear-reactor"
                                    label="nuclear-reactor"
                                />
                                <Swatch
                                    variable="--asset-color-nuclear-reactor-gen4"
                                    label="gen4"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Power — Fossil">
                            <Row>
                                <Swatch
                                    variable="--asset-color-steam-engine"
                                    label="steam-engine"
                                />
                                <Swatch
                                    variable="--asset-color-coal-burner"
                                    label="coal-burner"
                                />
                                <Swatch
                                    variable="--asset-color-gas-burner"
                                    label="gas-burner"
                                />
                                <Swatch
                                    variable="--asset-color-combined-cycle"
                                    label="combined-cycle"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Power — Wind">
                            <Row>
                                <Swatch
                                    variable="--asset-color-windmill"
                                    label="windmill"
                                />
                                <Swatch
                                    variable="--asset-color-onshore-wind-turbine"
                                    label="onshore-wind"
                                />
                                <Swatch
                                    variable="--asset-color-offshore-wind-turbine"
                                    label="offshore-wind"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Power — Solar">
                            <Row>
                                <Swatch
                                    variable="--asset-color-csp-solar"
                                    label="csp-solar"
                                />
                                <Swatch
                                    variable="--asset-color-pv-solar"
                                    label="pv-solar"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Storage">
                            <Row>
                                <Swatch
                                    variable="--asset-color-small-pumped-hydro"
                                    label="small-pumped-hydro"
                                />
                                <Swatch
                                    variable="--asset-color-large-pumped-hydro"
                                    label="large-pumped-hydro"
                                />
                                <Swatch
                                    variable="--asset-color-lithium-ion-batteries"
                                    label="li-ion"
                                />
                                <Swatch
                                    variable="--asset-color-solid-state-batteries"
                                    label="solid-state"
                                />
                                <Swatch
                                    variable="--asset-color-molten-salt"
                                    label="molten-salt"
                                />
                                <Swatch
                                    variable="--asset-color-hydrogen-storage"
                                    label="hydrogen"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Extraction">
                            <Row>
                                <Swatch
                                    variable="--asset-color-coal-mine"
                                    label="coal-mine"
                                />
                                <Swatch
                                    variable="--asset-color-gas-drilling-site"
                                    label="gas-drilling"
                                />
                                <Swatch
                                    variable="--asset-color-uranium-mine"
                                    label="uranium-mine"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Resources">
                            <Row>
                                <Swatch
                                    variable="--asset-color-coal"
                                    label="coal"
                                />
                                <Swatch
                                    variable="--asset-color-gas"
                                    label="gas"
                                />
                                <Swatch
                                    variable="--asset-color-uranium"
                                    label="uranium"
                                />
                                <Swatch
                                    variable="--asset-color-imports"
                                    label="imports"
                                />
                                <Swatch
                                    variable="--asset-color-exports"
                                    label="exports"
                                />
                                <Swatch
                                    variable="--asset-color-dumping"
                                    label="dumping"
                                />
                            </Row>
                        </SubSection>

                        <SubSection title="Functional">
                            <Row>
                                <Swatch
                                    variable="--asset-color-industry"
                                    label="industry"
                                />
                                <Swatch
                                    variable="--asset-color-research"
                                    label="research"
                                />
                                <Swatch
                                    variable="--asset-color-construction"
                                    label="construction"
                                />
                                <Swatch
                                    variable="--asset-color-transport"
                                    label="transport"
                                />
                                <Swatch
                                    variable="--asset-color-carbon-capture"
                                    label="carbon-capture"
                                />
                            </Row>
                        </SubSection>
                    </div>
                </Section>

                {/* ── Typography ──────────────────────────────────────────── */}
                <Section id="typography" title="Typography">
                    <SubSection title="Headings">
                        <div className="space-y-3">
                            <TypographyH1>H1 — Energetica</TypographyH1>
                            <TypographyH2>
                                H2 — Power Grid Overview
                            </TypographyH2>
                            <TypographyH3>H3 — Facility Details</TypographyH3>
                            <TypographyH4>H4 — Construction Queue</TypographyH4>
                        </div>
                    </SubSection>

                    <SubSection title="Body & Modifiers">
                        <div className="space-y-3">
                            <TypographyLead>
                                Lead — Build your energy empire one facility at
                                a time.
                            </TypographyLead>
                            <TypographyP>
                                Paragraph — Your coal burner is running at 87%
                                capacity. Consider building additional wind
                                turbines to meet projected demand during peak
                                hours.
                            </TypographyP>
                            <TypographyLarge>
                                Large — Net production: +240 MW
                            </TypographyLarge>
                            <TypographySmall>
                                Small — Last updated 3 ticks ago
                            </TypographySmall>
                            <TypographyMuted>
                                Muted — No active research projects.
                            </TypographyMuted>
                        </div>
                    </SubSection>

                    <SubSection title="Special">
                        <div className="space-y-3">
                            <div>
                                <TypographyBrand className="text-3xl text-primary">
                                    Energetica
                                </TypographyBrand>
                                <TypographyMuted>
                                    Brand font (Expletus Sans) — logo & major
                                    moments
                                </TypographyMuted>
                            </div>
                            <div>
                                <TypographyInlineCode>
                                    PV_solar
                                </TypographyInlineCode>{" "}
                                <TypographyInlineCode>
                                    coal_burner
                                </TypographyInlineCode>
                                <TypographyMuted>
                                    Inline code — asset IDs, technical values
                                </TypographyMuted>
                            </div>
                            <div>
                                <DataValue className="text-lg">
                                    1'234.56 MW
                                </DataValue>
                                <TypographyMuted>
                                    DataValue — monospace Chivo Mono for all
                                    numbers
                                </TypographyMuted>
                            </div>
                        </div>
                    </SubSection>
                </Section>

                {/* ── Buttons ─────────────────────────────────────────────── */}
                <Section id="buttons" title="Buttons">
                    <SubSection
                        title="Variants"
                        todo="'success' variant uses raw palette names bg-pine-800 / dark:bg-pine-500 — replace with semantic tokens (e.g. bg-success / dark:bg-success once a --success token is added to @theme inline)."
                    >
                        <Row>
                            <Button variant="default">Default</Button>
                            <Button variant="secondary">Secondary</Button>
                            <Button variant="outline">Outline</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Button variant="destructive">Destructive</Button>
                            <Button variant="success">Success</Button>
                            <Button variant="link">Link</Button>
                        </Row>
                    </SubSection>

                    <SubSection title="Sizes">
                        <Row>
                            <Button size="lg">Large</Button>
                            <Button size="default">Default</Button>
                            <Button size="sm">Small</Button>
                            <Button size="icon">
                                <Zap />
                            </Button>
                            <Button size="icon-sm">
                                <Zap />
                            </Button>
                            <Button size="icon-lg">
                                <Zap />
                            </Button>
                        </Row>
                    </SubSection>

                    <SubSection title="States">
                        <Row>
                            <Button disabled>Disabled</Button>
                            <Button disabled variant="outline">
                                Disabled Outline
                            </Button>
                            <Button>
                                <Spinner className="text-primary-foreground" />
                                Loading
                            </Button>
                        </Row>
                    </SubSection>
                </Section>

                {/* ── Inputs ──────────────────────────────────────────────── */}
                <Section id="inputs" title="Form Inputs">
                    <SubSection
                        title="Text Input"
                        todo="Input uses dark:bg-input/30 — verify this looks correct in both themes once the color token audit is done."
                    >
                        <div className="space-y-3 max-w-sm">
                            <div className="space-y-1">
                                <Label htmlFor="demo-input">
                                    Facility name
                                </Label>
                                <Input
                                    id="demo-input"
                                    placeholder="e.g. North Solar Farm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="demo-disabled">Disabled</Label>
                                <Input
                                    id="demo-disabled"
                                    placeholder="Cannot edit"
                                    disabled
                                />
                            </div>
                        </div>
                    </SubSection>

                    <SubSection
                        title="Switch"
                        todo="Switch uses data-[state=unchecked]:bg-gray-300 — replace with bg-input or bg-muted for theme consistency."
                    >
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Switch id="sw-on" defaultChecked />
                                <Label htmlFor="sw-on">
                                    Push notifications (on)
                                </Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch id="sw-off" />
                                <Label htmlFor="sw-off">
                                    Push notifications (off)
                                </Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch id="sw-disabled" disabled />
                                <Label htmlFor="sw-disabled">Disabled</Label>
                            </div>
                        </div>
                    </SubSection>
                </Section>

                {/* ── Feedback ────────────────────────────────────────────── */}
                <Section id="feedback" title="Feedback Components">
                    <SubSection title="Info Banners">
                        <div className="space-y-3 max-w-2xl">
                            <InfoBanner variant="info">
                                <strong>Maintenance scheduled</strong> — Server
                                restart at tick 500. All active construction
                                will be paused.
                            </InfoBanner>
                            <InfoBanner variant="warning">
                                <strong>Power shortage detected</strong> — 3
                                facilities are operating below capacity due to
                                insufficient generation.
                            </InfoBanner>
                            <InfoBanner variant="error">
                                <strong>Connection lost</strong> — Unable to
                                reach the game server. Your changes may not have
                                been saved.
                            </InfoBanner>
                        </div>
                    </SubSection>

                    <SubSection
                        title="Status Badges"
                        todo="'paused' status uses bg-gray-200 / dark:bg-gray-700 — replace with bg-muted / text-muted-foreground for theme consistency."
                    >
                        <Row>
                            <StatusBadge status="ongoing" />
                            <StatusBadge status="waiting" />
                            <StatusBadge status="in-transit" />
                            <StatusBadge status="slowed" />
                            <StatusBadge status="stopped" />
                            <StatusBadge status="paused" />
                        </Row>
                        <div className="mt-3">
                            <TypographyMuted>Small size:</TypographyMuted>
                            <Row>
                                <StatusBadge status="ongoing" size="sm" />
                                <StatusBadge status="waiting" size="sm" />
                                <StatusBadge status="in-transit" size="sm" />
                                <StatusBadge status="slowed" size="sm" />
                                <StatusBadge status="stopped" size="sm" />
                                <StatusBadge status="paused" size="sm" />
                            </Row>
                        </div>
                    </SubSection>

                    <SubSection title="Spinner">
                        <Row>
                            <Spinner />
                            <Spinner className="size-6" />
                            <Spinner className="size-8 text-accent" />
                            <Spinner className="size-8 text-destructive" />
                        </Row>
                    </SubSection>

                    <SubSection
                        title="Empty State"
                        todo="EmptyState uses text-gray-400/500/600/700 — replace with text-muted-foreground and text-foreground."
                    >
                        <div className="border border-border rounded-xl">
                            <EmptyState
                                icon={Inbox}
                                title="No incoming shipments"
                                description="Your ordered resources will appear here once suppliers confirm the order."
                                action={
                                    <Button variant="outline">
                                        Browse Market
                                    </Button>
                                }
                            />
                        </div>
                    </SubSection>
                </Section>

                {/* ── Progress ────────────────────────────────────────────── */}
                <Section id="progress" title="Progress & Gauges">
                    <SubSection
                        title="Progress Bar"
                        todo="Uses bg-gray-200/dark:bg-gray-700 for track and bg-brand (deleted token) for fill. Replace track with bg-muted, fill with bg-accent (or a new bg-brand token)."
                    >
                        <div className="space-y-4 max-w-md">
                            <ProgressBar
                                label="Solar Farm construction"
                                value={65}
                                max={100}
                            />
                            <ProgressBar
                                label="Nuclear research"
                                value={32}
                                max={100}
                            />
                            <ProgressBar
                                label="Complete"
                                value={100}
                                max={100}
                            />
                            <ProgressBar
                                label="Just started"
                                value={5}
                                max={100}
                            />
                        </div>
                    </SubSection>

                    <SubSection
                        title="Achievement Progress (inline bar)"
                        todo="achievement-card.tsx uses bg-gray-200/dark:bg-gray-700 for track and bg-brand (deleted token) for fill — same fix as ProgressBar."
                    >
                        {/* Replicates AchievementCard layout without the API dependency */}
                        <div className="space-y-2 max-w-md">
                            {(
                                [
                                    {
                                        name: "Power Baron 3",
                                        value: 7200,
                                        max: 10000,
                                        fmt: (v: number) =>
                                            `${(v / 1000).toFixed(0)}k MW`,
                                    },
                                    {
                                        name: "First Export",
                                        value: 1,
                                        max: 1,
                                        fmt: (v: number) => v.toString(),
                                    },
                                    {
                                        name: "Researcher 1",
                                        value: 4,
                                        max: 10,
                                        fmt: (v: number) => v.toString(),
                                    },
                                ] as const
                            ).map((a) => (
                                <div
                                    key={a.name}
                                    className="flex items-center gap-3"
                                >
                                    <div className="font-medium text-sm text-foreground min-w-35">
                                        {a.name}
                                    </div>
                                    {/* TODO: bg-gray-200 dark:bg-gray-700 → bg-muted */}
                                    {/* TODO: bg-brand dark:bg-brand → bg-accent (or bg-brand) */}
                                    <div className="flex-1 relative h-7 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                                        <div
                                            className="absolute inset-0 bg-brand-secondary dark:bg-brand-secondary transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, (a.value / a.max) * 100)}%`,
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground z-10 px-2">
                                            {a.fmt(a.value)} / {a.fmt(a.max)}
                                        </div>
                                    </div>
                                    <div className="font-medium text-sm text-foreground text-center min-w-15">
                                        +50 XP
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SubSection>

                    <SubSection
                        title="Facility Gauge"
                        todo="Uses bg-gray-200/dark:bg-gray-700 for track and text-gray-800/dark:text-white for label — replace with bg-muted and text-foreground."
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-xl">
                            {(
                                [
                                    "PV_solar",
                                    "onshore_wind_turbine",
                                    "coal_burner",
                                    "nuclear_reactor",
                                    "combined_cycle",
                                    "lithium_ion_batteries",
                                ] as const
                            ).map((f, i) => (
                                <div key={f} className="space-y-1">
                                    <TypographyMuted>{f}</TypographyMuted>
                                    <FacilityGauge
                                        facilityType={f}
                                        value={20 + i * 13}
                                    />
                                </div>
                            ))}
                        </div>
                    </SubSection>
                </Section>

                {/* ── Cards ───────────────────────────────────────────────── */}
                <Section id="cards" title="Cards">
                    <SubSection title="Basic Card">
                        <div className="grid md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Solar Farm Alpha</CardTitle>
                                    <CardDescription>
                                        Renewable energy · 240 MW capacity
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <TypographyP>
                                        Currently producing{" "}
                                        <DataValue>187 MW</DataValue> at 78%
                                        efficiency. Maintenance due in 48 ticks.
                                    </TypographyP>
                                </CardContent>
                                <CardFooter className="gap-2">
                                    <Button size="sm">Manage</Button>
                                    <Button size="sm" variant="outline">
                                        Details
                                    </Button>
                                </CardFooter>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Construction Queue</CardTitle>
                                    <CardDescription>
                                        2 projects in progress
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <ProgressBar
                                        label="Offshore Wind Turbine"
                                        value={73}
                                    />
                                    <ProgressBar
                                        label="Uranium Mine"
                                        value={18}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </SubSection>

                    <SubSection
                        title="Quick Link Card"
                        todo="quick-link-card.tsx uses hover:bg-tan-hover (undefined token) and hover:border-pine / dark:hover:border-brand-green (both undefined). Replace with hover:bg-muted and hover:border-accent."
                    >
                        {/* Inline replica — not using the real QuickLinkCard to avoid router dep */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-xl">
                            {(
                                [
                                    { icon: Zap, label: "Power" },
                                    { icon: Factory, label: "Facilities" },
                                    { icon: FlaskConical, label: "Research" },
                                    { icon: Construction, label: "Build" },
                                ] as const
                            ).map(({ icon: Icon, label }) => (
                                <div
                                    key={label}
                                    /* TODO: hover:bg-tan-hover → hover:bg-muted (tan-hover token doesn't exist) */
                                    /* TODO: hover:border-pine → hover:border-accent (pine token doesn't exist as Tailwind utility) */
                                    /* TODO: dark:hover:border-brand-green → hover:border-accent (brand-green was deleted) */
                                    className="bg-card hover:bg-muted p-6 rounded-lg text-center transition-colors border border-transparent hover:border-accent cursor-pointer"
                                >
                                    <Icon className="w-8 h-8 mx-auto mb-2 text-foreground" />
                                    <span className="text-sm font-semibold text-foreground">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </SubSection>
                </Section>

                {/* ── Data Display ────────────────────────────────────────── */}
                <Section id="data-display" title="Data Display">
                    <SubSection title="Money">
                        <Row>
                            <div className="space-y-1">
                                <TypographyMuted>
                                    Scaled (default)
                                </TypographyMuted>
                                <div className="text-lg">
                                    <Money amount={1500} />
                                </div>
                                <div className="text-lg">
                                    <Money amount={15000} />
                                </div>
                                <div className="text-lg">
                                    <Money amount={1500000} />
                                </div>
                            </div>
                            <Separator
                                orientation="vertical"
                                className="h-20"
                            />
                            <div className="space-y-1">
                                <TypographyMuted>
                                    Long (no scaling)
                                </TypographyMuted>
                                <div className="text-lg">
                                    <Money amount={1500} long />
                                </div>
                                <div className="text-lg">
                                    <Money amount={15000} long />
                                </div>
                            </div>
                            <Separator
                                orientation="vertical"
                                className="h-20"
                            />
                            <div className="space-y-1">
                                <TypographyMuted>
                                    In typography context
                                </TypographyMuted>
                                <TypographyH3>
                                    <Money amount={4820000} />
                                </TypographyH3>
                                <TypographyMuted>
                                    <Money amount={-1200} />
                                    <span> / tick</span>
                                </TypographyMuted>
                            </div>
                        </Row>
                    </SubSection>

                    <SubSection title="Data Values (monospace)">
                        <div className="space-y-1">
                            <DataValue className="text-2xl block">
                                487.3 MW
                            </DataValue>
                            <DataValue className="text-lg block">
                                CO₂: 12.4 t/h
                            </DataValue>
                            <DataValue className="text-sm text-muted-foreground block">
                                Efficiency: 94.2%
                            </DataValue>
                        </div>
                    </SubSection>
                </Section>
            </main>
        </div>
    );
}
