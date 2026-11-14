/**
 * PROTOTYPE — throwaway (issue #1440), variant "raster-depth".
 *
 * Tests whether the original AI banner, pixels unchanged, can get scroll
 * parallax and ambient motion without being redrawn. The banner is split
 * offline into two layers: a foreground (cooling towers with their steam
 * plumes, vent stack, reactor, gas plant, turbine masts, H2 plant, dry cooler,
 * batteries) with a soft alpha matte, and a background with those objects
 * inpainted away. A WebGL fragment shader displaces each layer down by
 * `progress * amp * (1 - depth)` using its own depth (backward mapping, a few
 * fixed-point iterations) and composites them with a depth test, so near
 * objects slide over a real background instead of stretching it. It also adds:
 * steam puffs over the cooling towers and gas chimneys, a shimmer on the dam
 * spillways and lake, slow cloud drift, and rotating rotors on all four
 * turbines (blades painted out and redrawn rotated around each hub).
 *
 * Assets in ../raster-depth/ come from the original banner and
 * ../depth/banner-depth.png (Depth Anything V2 Small, see
 * ../depth/make_depth.py). Regenerate them with:
 * ~/.cache/energetica-proto-1440/venv/bin/python raster-depth/make_maps.py
 * Turbine and steam-emitter positions are duplicated between make_maps.py and
 * raster-depth/shaders.ts.
 *
 * Prefers-reduced-motion or no WebGL: plain <img> of the original banner.
 */
import { useEffect, useRef, useState } from "react";

import type { VariantProps } from "@/components/hero-scene-prototype/hero-scene-prototype";
import bgSrc from "@/components/hero-scene-prototype/raster-depth/bg.png";
import fgSrc from "@/components/hero-scene-prototype/raster-depth/fg.png";
import layersSrc from "@/components/hero-scene-prototype/raster-depth/layers.png";
import mapsSrc from "@/components/hero-scene-prototype/raster-depth/maps.png";
import rotorSrc from "@/components/hero-scene-prototype/raster-depth/rotor.png";
import {
    BANNER_H,
    BANNER_W,
    EMITTERS,
    FRAGMENT,
    TURBINES,
    VERTEX,
} from "@/components/hero-scene-prototype/raster-depth/shaders";
import skySrc from "@/components/hero-scene-prototype/raster-depth/sky.png";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function supportsWebGL(): boolean {
    try {
        return !!document.createElement("canvas").getContext("webgl");
    } catch {
        return false;
    }
}

export function RasterDepthVariant({
    originalSrc,
    amp,
    progress,
}: VariantProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ampRef = useRef(amp);
    const [reduced, setReduced] = useState(
        () => window.matchMedia(REDUCED_MOTION).matches,
    );
    const [failed, setFailed] = useState(() => !supportsWebGL());
    const [ready, setReady] = useState(false);

    useEffect(() => {
        ampRef.current = amp;
    }, [amp]);

    useEffect(() => {
        const mq = window.matchMedia(REDUCED_MOTION);
        const onChange = () => setReduced(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    const useCanvas = !reduced && !failed;

    useEffect(() => {
        if (!useCanvas) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            depth: false,
            premultipliedAlpha: false,
        });
        if (!gl) return; // the <img> underneath stays visible (canvas never becomes ready)
        let disposed = false;
        let frame = 0;
        let visible = true;
        let draw: (() => void) | null = null;

        const loop = () => {
            frame = 0;
            if (disposed || !visible || !draw) return;
            draw();
            frame = requestAnimationFrame(loop);
        };
        const io = new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (visible && !frame) frame = requestAnimationFrame(loop);
        });
        io.observe(canvas);

        Promise.all([
            loadImage(originalSrc),
            loadImage(bgSrc),
            loadImage(fgSrc),
            loadImage(layersSrc),
            loadImage(mapsSrc),
            loadImage(rotorSrc),
            loadImage(skySrc),
        ])
            .then(([img, bg, fg, layers, maps, rotor, sky]) => {
                if (disposed) return;
                draw = setup(
                    gl,
                    canvas,
                    { img, bg, fg, layers, maps, rotor, sky },
                    () => ({
                        shift: progress.current * ampRef.current,
                        time: performance.now() / 1000,
                    }),
                );
                setReady(true);
                if (!frame) frame = requestAnimationFrame(loop);
            })
            .catch((err: unknown) => {
                console.error("raster-depth variant:", err);
                if (!disposed) setFailed(true);
            });

        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            io.disconnect();
        };
    }, [useCanvas, originalSrc, progress]);

    return (
        <div className="relative">
            <img
                src={originalSrc}
                alt="Energetica game interface showing power grid management"
                className="block w-full h-auto"
            />
            {useCanvas && (
                <canvas
                    ref={canvasRef}
                    aria-hidden
                    className="absolute inset-0 block w-full h-full"
                    style={{ opacity: ready ? 1 : 0 }}
                />
            )}
        </div>
    );
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`failed to load ${src}`));
        img.src = src;
    });
}

type Images = Record<
    "img" | "bg" | "fg" | "layers" | "maps" | "rotor" | "sky",
    HTMLImageElement
>;

/** Compiles the program, uploads textures, returns a draw function. */
function setup(
    gl: WebGLRenderingContext,
    canvas: HTMLCanvasElement,
    images: Images,
    frameState: () => { shift: number; time: number },
): () => void {
    const program = gl.createProgram();
    for (const [type, source] of [
        [gl.VERTEX_SHADER, VERTEX],
        [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(
                `shader compile failed: ${gl.getShaderInfoLog(shader)}`,
            );
        }
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
            `program link failed: ${gl.getProgramInfoLog(program)}`,
        );
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const textures: [string, HTMLImageElement, boolean][] = [
        ["u_img", images.img, true],
        ["u_bg", images.bg, true],
        ["u_fg", images.fg, true],
        ["u_layers", images.layers, false],
        ["u_maps", images.maps, false],
        ["u_rotor", images.rotor, false],
        ["u_sky", images.sky, true],
    ];
    textures.forEach(([name, image, isColour], unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.pixelStorei(
            gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
            isColour ? gl.BROWSER_DEFAULT_WEBGL : gl.NONE,
        );
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGB,
            gl.RGB,
            gl.UNSIGNED_BYTE,
            image,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(program, name), unit);
    });

    const u = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform4fv(
        u("u_turb"),
        TURBINES.flatMap((t) => [t.hub[0], t.hub[1], t.R, t.core]),
    );
    gl.uniform4fv(
        u("u_turbAnim"),
        TURBINES.flatMap((t) => [t.d, t.speed, t.phase, 0]),
    );
    gl.uniform4fv(
        u("u_emit"),
        EMITTERS.flatMap((e) => [e.at[0], e.at[1], e.half, e.d]),
    );
    gl.uniform4fv(
        u("u_emitShape"),
        EMITTERS.flatMap((e) => [e.rise, e.wind, e.r0, e.r1]),
    );
    const uRes = u("u_res");
    const uShift = u("u_shift");
    const uTime = u("u_time");

    return () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(canvas.clientWidth * dpr);
        const height = Math.round((width * BANNER_H) / BANNER_W);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const { shift, time } = frameState();
        gl.viewport(0, 0, width, height);
        gl.uniform2f(uRes, width, height);
        gl.uniform1f(uShift, shift);
        gl.uniform1f(uTime, time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
}
