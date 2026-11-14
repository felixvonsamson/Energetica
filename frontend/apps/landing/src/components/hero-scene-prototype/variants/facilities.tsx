/**
 * PROTOTYPE — facilities variant (issue #1440). Throwaway.
 *
 * The same 3D facility models as the projected hero, rendered alone with one
 * shared camera angle and sun by ../projector/gallery.py. Question: does this
 * pipeline give a consistent set of facility assets for the game, not just a
 * hero?
 *
 * Regenerate: ~/.cache/energetica-proto-1440/venv/bin/python
 * ../projector/gallery.py
 */
import type { VariantProps } from "@/components/hero-scene-prototype/hero-scene-prototype";

const svgs = import.meta.glob<string>("../projected/facilities/*.svg", {
    query: "?raw",
    import: "default",
    eager: true,
});

const LABELS: Record<string, string> = {
    nuclear: "Nuclear",
    wind: "Onshore wind",
    hydro_dam: "Hydro dam",
    gas: "Combined-cycle gas",
    hydrogen: "Hydrogen",
    solar: "Solar PV",
    battery: "Battery storage",
    dry_cooler: "Dry cooler",
    coal_mine: "Coal mine",
};

export function FacilitiesVariant(_props: VariantProps) {
    const entries = Object.entries(svgs)
        .map(
            ([path, svg]) =>
                [path.split("/").pop()!.replace(".svg", ""), svg] as const,
        )
        .sort(
            ([a], [b]) =>
                Object.keys(LABELS).indexOf(a) - Object.keys(LABELS).indexOf(b),
        );
    return (
        <div className="grid grid-cols-2 gap-3 bg-[#eef3ea] p-4 sm:grid-cols-3">
            {entries.map(([key, svg]) => (
                <figure
                    key={key}
                    className="flex flex-col rounded-2xl bg-white/70 p-2 shadow-sm"
                >
                    <div
                        className="hs-asset aspect-square"
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                    <figcaption className="pb-1 text-center text-sm font-medium text-neutral-600">
                        {LABELS[key] ?? key}
                    </figcaption>
                </figure>
            ))}
        </div>
    );
}
