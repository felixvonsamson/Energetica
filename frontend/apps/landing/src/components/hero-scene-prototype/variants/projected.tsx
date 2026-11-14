/**
 * PROTOTYPE — projected variant (issue #1440). Throwaway.
 *
 * The hero as a small 3D scene of analytic shapes (boxes, surfaces of
 * revolution, planar decals, billboards, terrain curtains), projected to flat
 * SVG by ../projector/hero.py. Every object carries its real camera depth as
 * `--d`, so the shared parallax CSS moves each one by its own amount; rotors,
 * fans, steam, water and clouds use the shared animation classes.
 *
 * Regenerate: ~/.cache/energetica-proto-1440/venv/bin/python
 * ../projector/hero.py
 */
import type { VariantProps } from "@/components/hero-scene-prototype/hero-scene-prototype";
import heroSvg from "@/components/hero-scene-prototype/projected/hero.svg?raw";

export function ProjectedVariant(_props: VariantProps) {
    return (
        <div
            role="img"
            aria-label="Energetica game interface showing power grid management"
            dangerouslySetInnerHTML={{ __html: heroSvg }}
        />
    );
}
