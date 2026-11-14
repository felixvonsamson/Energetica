/**
 * PROTOTYPE — traced variant (issue #1440). Throwaway.
 *
 * Question: does an automatically traced, colour, multi-layer vector version of
 * the AI banner keep what works (colours, flat illustrative look, recognisable
 * facilities) and lose what doesn't (excess detail, AI pixel artefacts)?
 *
 * The SVG is generated, not hand-made: the banner is flattened (bilateral
 * filter, depth-aware k-means palette), split into 16 depth bands from
 * ../depth/banner-depth.png, and each band is traced with vtracer into a `<g
 * class="px" style="--d:…">` group, so the shared parallax CSS moves it.
 * Regenerate from `../traced/` with the throwaway venv:
 * ~/.cache/energetica-proto-1440/venv/bin/python trace_banner.py
 */
import type { VariantProps } from "@/components/hero-scene-prototype/hero-scene-prototype";
import tracedSvg from "@/components/hero-scene-prototype/traced/banner-traced.svg?raw";

export function TracedVariant(_props: VariantProps) {
    return (
        <div
            role="img"
            aria-label="Energetica game interface showing power grid management"
            dangerouslySetInnerHTML={{ __html: tracedSvg }}
        />
    );
}
