/**
 * PROTOTYPE — projected variant (issue #1440). Throwaway.
 *
 * The hero as a small 3D scene of analytic shapes (boxes, surfaces of
 * revolution, planar decals, billboards, terrain curtains), projected to flat
 * SVG by ../projector/hero.py. Rotors, fans, steam, water and clouds use the
 * shared animation classes.
 *
 * Parallax: the scene is split into depth layers, one <svg> each, stacked as
 * separate compositor layers (`.hs-layer`, will-change: transform), and each
 * frame only the layers' own `transform` is written. Driving it through an
 * inherited CSS variable, or transforming groups inside one big SVG, made the
 * browser restyle and repaint the whole scene on every scroll frame.
 *
 * Regenerate: ~/.cache/energetica-proto-1440/venv/bin/python
 * ../projector/hero.py
 */
import { useEffect, useRef } from "react";

import type { VariantProps } from "@/components/hero-scene-prototype/hero-scene-prototype";
import hero from "@/components/hero-scene-prototype/projected/hero.json";

const viewBox = hero.viewBox.join(" ");
const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;

export function ProjectedVariant({ amp, progress }: VariantProps) {
    const layers = useRef<(HTMLDivElement | null)[]>([]);
    const ampRef = useRef(amp);
    useEffect(() => {
        ampRef.current = amp;
    }, [amp]);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            return;
        let frame = 0;
        let last = -1;
        const tick = () => {
            const shift = progress.current * ampRef.current;
            if (shift !== last) {
                last = shift;
                hero.layers.forEach((layer, i) => {
                    const el = layers.current[i];
                    // % of the layer's own height = banner units / 725
                    if (el)
                        el.style.transform = `translate3d(0, ${((shift * layer.d) / hero.viewBox[3]!) * 100}%, 0)`;
                });
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [progress]);

    return (
        <div
            role="img"
            aria-label="Energetica game interface showing power grid management"
            className="hs-stack"
            style={{
                aspectRatio: `${hero.viewBox[2]} / ${hero.viewBox[3]}`,
            }}
        >
            {/* shared gradients and clip paths; must not be display:none or they stop resolving */}
            <div
                className="hs-defs"
                dangerouslySetInnerHTML={{
                    __html: svg(`<defs>${hero.defs}</defs>`),
                }}
            />
            {hero.layers.map((layer, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        layers.current[i] = el;
                    }}
                    className="hs-layer"
                    dangerouslySetInnerHTML={{ __html: svg(layer.svg) }}
                />
            ))}
        </div>
    );
}
