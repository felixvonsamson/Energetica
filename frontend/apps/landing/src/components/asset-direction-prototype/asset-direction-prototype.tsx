/**
 * PROTOTYPE (#1469), throwaway: a contact sheet of facility renders for
 * choosing the visual direction of the map assets. Not for merging.
 *
 * Plan: one page, /prototype/asset-direction. Section 1 compares the palettes
 * side by side on the map camera. The other sections (map patch per style
 * option, the open style questions, close-ups, free camera) show one palette at
 * a time, picked with the floating bar (← / →, `?palette=`).
 *
 * The SVGs come from projector/render.py; see README.md next to this file.
 */
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import manifest from "./renders/manifest.json";

type Render = {
    section: "map" | "style" | "closeup" | "free" | "minimap";
    facility: string;
    palette: string;
    light: string;
    outline: string;
    texture: string;
    w: number;
    src: string;
    kb: number;
    axis?: "light" | "outline" | "texture";
};

const urls = import.meta.glob("./renders/**/*.svg", {
    query: "?url",
    import: "default",
    eager: true,
}) as Record<string, string>;

const renders = manifest.renders as Render[];
const PALETTES = Object.keys(manifest.palettes);
const AXES = {
    light: manifest.lights,
    outline: manifest.outlines,
    texture: manifest.textures,
} as Record<string, Record<string, string>>;
const D = manifest.default as Record<string, string>;
const TILE = manifest.camera.tilePx;
const CARD = manifest.camera.cardPx;

function find(q: Partial<Render>): Render | undefined {
    const want = { ...D, ...q };
    return renders.find(
        (r) =>
            (q.section === undefined || r.section === q.section) &&
            (q.facility === undefined || r.facility === q.facility) &&
            (q.w === undefined || r.w === q.w) &&
            r.palette === want.palette &&
            r.light === want.light &&
            r.outline === want.outline &&
            r.texture === want.texture,
    );
}

function Img({
    r,
    width,
    label,
}: {
    r?: Render;
    width?: number;
    label?: string;
}) {
    if (!r) return <div className="text-xs text-red-700">missing</div>;
    return (
        <figure className="flex flex-col items-center gap-1">
            <img
                src={urls[`./renders/${r.src}`]}
                width={width ?? r.w}
                alt={label ?? r.src}
                title={`${r.src} (${r.kb} KB)`}
                draggable={false}
            />
            {label && (
                <figcaption className="text-center text-[11px] leading-tight opacity-70">
                    {label}
                </figcaption>
            )}
        </figure>
    );
}

/** A render as it would appear on the map (tile size) and on a facility card. */
function TileAndCard({ q, label }: { q: Partial<Render>; label?: string }) {
    const style = q.section === "style" ? "style" : "map";
    const tile =
        find({ ...q, section: style, w: TILE }) ??
        find({ ...q, section: "map", w: TILE });
    const card =
        find({ ...q, section: style, w: CARD }) ??
        find({ ...q, section: "map", w: CARD });
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex items-end gap-3">
                <Img r={tile} width={TILE} />
                <Img r={card} width={CARD} />
            </div>
            {label && (
                <div className="text-center text-xs font-medium">{label}</div>
            )}
        </div>
    );
}

function Section({
    id,
    title,
    children,
    note,
}: {
    id: string;
    title: string;
    note?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section id={id} className="border-t border-black/10 py-10">
            <h2 className="mb-1 text-xl font-semibold tracking-tight">
                {title}
            </h2>
            {note && (
                <p className="mb-6 max-w-3xl text-sm opacity-75">{note}</p>
            )}
            {children}
        </section>
    );
}

const BACKGROUNDS = {
    paper: "#f4f1ea",
    pine: "#a4be7b",
    dark: "#22261f",
} as const;
type Bg = keyof typeof BACKGROUNDS;

export function AssetDirectionPrototype() {
    const search = useSearch({ strict: false }) as {
        palette?: string;
        bg?: Bg;
    };
    const navigate = useNavigate();
    const palette =
        search.palette && PALETTES.includes(search.palette)
            ? search.palette
            : (D.palette ?? "brief");
    const bg: Bg = search.bg && search.bg in BACKGROUNDS ? search.bg : "paper";
    const set = (next: Partial<{ palette: string; bg: Bg }>) =>
        void navigate({
            to: ".",
            search: (s: object) => ({ ...s, ...next }),
            replace: true,
        });

    const facilities = manifest.facilities;
    const fg = bg === "dark" ? "text-stone-100" : "text-stone-900";

    return (
        <div
            className={`min-h-screen px-8 pb-32 ${fg}`}
            style={{ background: BACKGROUNDS[bg] }}
        >
            <header className="max-w-4xl pt-10 pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest opacity-60">
                    Prototype · #1469 · throwaway
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                    Facility assets: visual direction
                </h1>
                <p className="mt-3 text-sm opacity-80">
                    Every image is the same 3D model projected to flat SVG. The
                    map camera is a parallel projection from{" "}
                    {manifest.camera.azimuth}° round and{" "}
                    {manifest.camera.elevation}° up, so a hex vertex points at
                    the viewer. Small images are at map-tile size ({TILE} px
                    wide), large ones at facility card size ({CARD} px). The
                    tile-size column is the main test. Hover an image for its
                    file and size.
                </p>
                <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm underline underline-offset-4">
                    <a href="#palettes">1. Palettes</a>
                    <a href="#patch">2. A patch of map</a>
                    <a href="#questions">3. Open questions</a>
                    <a href="#cards">4. Card front and back</a>
                    <a href="#free">5. Free camera</a>
                </nav>
                <div className="mt-4 flex items-center gap-2 text-xs">
                    Page background:
                    {(Object.keys(BACKGROUNDS) as Bg[]).map((b) => (
                        <button
                            key={b}
                            onClick={() => set({ bg: b })}
                            className={`rounded-full border px-2 py-0.5 ${b === bg ? "border-current font-semibold" : "border-transparent opacity-60"}`}
                        >
                            {b}
                        </button>
                    ))}
                </div>
            </header>

            <Section
                id="palettes"
                title="1. Palettes on the map camera"
                note="Same light, no lines, flat fills. Read each row at tile size first."
            >
                <div className="overflow-x-auto">
                    <table className="border-separate border-spacing-x-6 border-spacing-y-4">
                        <thead>
                            <tr>
                                <th />
                                {PALETTES.map((p) => (
                                    <th
                                        key={p}
                                        className="text-left text-sm font-semibold"
                                    >
                                        {
                                            manifest.palettes[
                                                p as keyof typeof manifest.palettes
                                            ]
                                        }
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {facilities.map((f) => (
                                <tr key={f.key}>
                                    <td className="w-28 align-middle text-sm font-medium">
                                        {f.label}
                                    </td>
                                    {PALETTES.map((p) => (
                                        <td key={p}>
                                            <TileAndCard
                                                q={{
                                                    facility: f.key,
                                                    palette: p,
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            <Section
                id="patch"
                title={`2. A patch of map, at tile size (${palette})`}
                note="All facilities together on hex tiles, as the map would show them. One patch per style option, so options can be judged where it matters. Empty tiles are grass, forest or water."
            >
                <div className="mb-6">
                    <Img
                        r={find({ section: "minimap", palette })}
                        label="Default: key light from the left, no lines, flat"
                    />
                </div>
                {Object.entries(AXES).map(([axis, opts]) => (
                    <div key={axis} className="mb-8">
                        <h3 className="mb-3 text-sm font-semibold capitalize">
                            {axis}
                        </h3>
                        <div className="flex flex-wrap items-end gap-8">
                            {Object.entries(opts).map(([opt, label]) => (
                                <Img
                                    key={opt}
                                    r={find({
                                        section: "minimap",
                                        palette,
                                        [axis]: opt,
                                    })}
                                    label={label}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </Section>

            <Section
                id="questions"
                title={`3. Open questions, facility by facility (${palette})`}
                note="One question at a time; everything else stays at the default. Marker fill needs lines, so it comes with ink edges."
            >
                {Object.entries(AXES).map(([axis, opts]) => (
                    <details
                        key={axis}
                        className="mb-6"
                        open={axis === "outline"}
                    >
                        <summary className="cursor-pointer text-base font-semibold capitalize">
                            {axis}
                        </summary>
                        <div className="mt-4 overflow-x-auto">
                            <table className="border-separate border-spacing-x-6 border-spacing-y-4">
                                <thead>
                                    <tr>
                                        <th />
                                        {Object.values(opts).map((label) => (
                                            <th
                                                key={label}
                                                className="text-left text-sm font-semibold"
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {facilities.map((f) => (
                                        <tr key={f.key}>
                                            <td className="w-28 text-sm font-medium">
                                                {f.label}
                                            </td>
                                            {Object.keys(opts).map((opt) => (
                                                <td key={opt}>
                                                    <TileAndCard
                                                        q={{
                                                            section: "style",
                                                            facility: f.key,
                                                            palette,
                                                            [axis]: opt,
                                                        }}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                ))}
            </Section>

            <Section
                id="cards"
                title={`4. Facility card, front and back (${palette})`}
                note="Front: the whole facility from the map camera. Back: a crop on one telling detail, from the same camera and model."
            >
                <div className="flex flex-wrap gap-10">
                    {facilities.map((f) => (
                        <div key={f.key} className="flex flex-col gap-2">
                            <div className="text-sm font-medium">{f.label}</div>
                            <div className="flex gap-3">
                                <div className="overflow-hidden rounded-xl bg-white/60 p-2 shadow-sm ring-1 ring-black/10">
                                    <Img
                                        r={find({
                                            section: "map",
                                            facility: f.key,
                                            palette,
                                            w: CARD,
                                        })}
                                        width={220}
                                    />
                                </div>
                                <div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-black/10">
                                    <Img
                                        r={find({
                                            section: "closeup",
                                            facility: f.key,
                                            palette,
                                        })}
                                        width={220}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            <Section
                id="free"
                title={`5. Free camera (${palette})`}
                note="A lower perspective view for previews and illustrations, not bound to the map camera. The facility still sits on its tile, like a diorama."
            >
                <div className="flex flex-wrap gap-6">
                    {facilities.map((f) => (
                        <Img
                            key={f.key}
                            r={find({
                                section: "free",
                                facility: f.key,
                                palette,
                            })}
                            width={480}
                            label={f.label}
                        />
                    ))}
                </div>
            </Section>

            {import.meta.env.DEV && (
                <PaletteBar
                    palette={palette}
                    onChange={(p) => set({ palette: p })}
                />
            )}
        </div>
    );
}

/**
 * Floating switcher for the palette used by sections 2 to 5. Not part of the
 * design under test.
 */
function PaletteBar({
    palette,
    onChange,
}: {
    palette: string;
    onChange: (p: string) => void;
}) {
    const i = PALETTES.indexOf(palette);
    const step = (d: number) =>
        onChange(
            PALETTES[(i + d + PALETTES.length) % PALETTES.length] ?? palette,
        );
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            if (t.closest("input, textarea, [contenteditable]")) return;
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });
    return (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 font-mono text-sm text-white shadow-2xl">
            <button
                onClick={() => step(-1)}
                aria-label="Previous palette"
                className="px-1"
            >
                ←
            </button>
            <span>
                palette: <b>{palette}</b>
                <span className="opacity-60">
                    {" "}
                    ({i + 1}/{PALETTES.length})
                </span>
            </span>
            <button
                onClick={() => step(1)}
                aria-label="Next palette"
                className="px-1"
            >
                →
            </button>
        </div>
    );
}
