/**
 * PROTOTYPE (issue #1440): WebGL 1 shaders for the raster-depth hero variant.
 * All positions are in banner pixels (2167 × 725, y pointing down).
 */

export const BANNER_W = 2167;
export const BANNER_H = 725;

/**
 * Same order and numbers as TURBINES in make_maps.py (the shader assumes
 * exactly 3). d = depth at the hub (0…1, 1 = nearest). The small turbine at
 * (630, 284) stays static.
 */
export const TURBINES = [
    {
        hub: [730.5, 186.0],
        R: 100,
        core: 6.0,
        d: 44 / 255,
        speed: 1.05,
        phase: 0.0,
    },
    {
        hub: [836.0, 245.5],
        R: 72,
        core: 4.5,
        d: 35 / 255,
        speed: 1.2,
        phase: 1.3,
    },
    {
        hub: [938.0, 275.0],
        R: 36,
        core: 3.0,
        d: 19 / 255,
        speed: 1.5,
        phase: 2.1,
    },
] as const;

/**
 * Steam emitters: mouth centre, mouth half width, depth, rise, wind drift, puff
 * radius.
 */
export const EMITTERS = [
    {
        at: [1048, 174],
        half: 40,
        d: 46 / 255,
        rise: 100,
        wind: 90,
        r0: 16,
        r1: 38,
    },
    {
        at: [1372, 184],
        half: 40,
        d: 48 / 255,
        rise: 90,
        wind: 70,
        r0: 15,
        r1: 34,
    },
    {
        at: [1608, 226],
        half: 6,
        d: 53 / 255,
        rise: 95,
        wind: 55,
        r0: 5,
        r1: 20,
    },
    {
        at: [1654, 230],
        half: 6,
        d: 53 / 255,
        rise: 95,
        wind: 55,
        r0: 5,
        r1: 20,
    },
] as const;

/**
 * Turbine-area crop stored in patch.png (x0, y0, width, height); see PATCH in
 * make_maps.py.
 */
export const PATCH_RECT = [620, 75, 380, 265] as const;

export const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export const FRAGMENT = `
precision highp float;

uniform sampler2D u_img;    // original banner
uniform sampler2D u_maps;   // R depth (1 = near), G water, B sky
uniform sampler2D u_rotor;  // R blade fill, G blade alpha, B owning turbine * 60
uniform sampler2D u_patch;  // turbine area with the blades painted out
uniform sampler2D u_sky;    // cloud-free sky gradient (1/8 size)
uniform vec2 u_res;         // canvas size in device pixels
uniform float u_shift;      // progress * amp, banner pixels
uniform float u_time;       // seconds
uniform vec4 u_patchRect;
uniform vec4 u_turb[3];     // hub.xy, R, core
uniform vec4 u_turbAnim[3]; // depth, speed, phase, -
uniform vec4 u_emit[4];     // mouth.xy, half width, depth
uniform vec4 u_emitShape[4];// rise, wind, r0, r1

const vec2 SIZE = vec2(${BANNER_W}.0, ${BANNER_H}.0);
const float TAU = 6.2831853;

vec4 maps(vec2 p) { return texture2D(u_maps, p / SIZE); }

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Banner colour at q with the turbine blades painted out.
vec3 base(vec2 q) {
    vec3 c = texture2D(u_img, q / SIZE).rgb;
    vec2 pq = (q - u_patchRect.xy) / u_patchRect.zw;
    if (pq.x > 0.0 && pq.y > 0.0 && pq.x < 1.0 && pq.y < 1.0) {
        float fill = texture2D(u_rotor, q / SIZE).r;
        c = mix(c, texture2D(u_patch, pq).rgb, fill);
    }
    return c;
}

void main() {
    vec2 P = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_res * SIZE;

    // Parallax: backward map with fixed-point iterations. A pixel at depth d moves down
    // by u_shift * (1 - d); find the source q that lands on P.
    vec2 q = P;
    for (int i = 0; i < 6; i++) {
        q.y = P.y - u_shift * (1.0 - maps(q).r);
    }
    vec4 m = maps(q);
    vec3 col = base(q);

    // Clouds: move the residual (banner minus clean sky) sideways, only inside the sky.
    if (m.b > 0.0) {
        // Drift fades towards the horizon: far clouds move less, and the pale distant
        // ridges (indistinguishable from sky in the depth map) stay put.
        float dx = 22.0 * sin(TAU * u_time / 100.0) * smoothstep(270.0, 120.0, q.y);
        vec2 qc = vec2(q.x - dx, q.y);
        vec3 skyHere = texture2D(u_sky, q / SIZE).rgb;
        vec3 skyThere = texture2D(u_sky, qc / SIZE).rgb;
        // Hard threshold so the edges of towers or turbines never leak into the moved
        // layer; fade out at the left and right borders instead of smearing column 0.
        float w = smoothstep(0.75, 1.0, maps(qc).b)
                * smoothstep(0.0, 40.0, qc.x) * smoothstep(SIZE.x, SIZE.x - 40.0, qc.x);
        vec3 moved = skyHere + w * (base(qc) - skyThere);
        col = mix(col, moved, m.b);
    }

    // Water: streaks running down the spillways, glints drifting on the lake.
    if (m.g > 0.0) {
        if (q.y < 452.0) {
            float n = noise(vec2(q.x * 0.35, q.y * 0.045 - u_time * 2.0));
            float n2 = noise(vec2(q.x * 0.9, q.y * 0.11 - u_time * 3.4));
            col += m.g * ((n * 0.6 + n2 * 0.4) - 0.5) * 0.16;
        } else {
            float n = noise(vec2(q.x * 0.07 + u_time * 0.25, q.y * 0.5));
            float n2 = noise(vec2(q.x * 0.16 - u_time * 0.18, q.y * 0.9 + u_time * 0.12));
            float glint = smoothstep(0.66, 0.85, n * 0.5 + n2 * 0.5);
            col += m.g * (glint * 0.2 + (n - 0.5) * 0.04);
        }
    }

    // Rotors: drawn in screen space around the parallax-shifted hub, rotating clockwise.
    for (int i = 0; i < 3; i++) {
        vec4 T = u_turb[i];
        vec4 A = u_turbAnim[i];
        vec2 v = P - (T.xy + vec2(0.0, u_shift * (1.0 - A.x)));
        float r = length(v);
        if (r < T.z + 2.0) {
            float ang = -(u_time * A.y + A.z);
            float cs = cos(ang), sn = sin(ang);
            vec2 qb = T.xy + vec2(cs * v.x - sn * v.y, sn * v.x + cs * v.y);
            vec2 blade = texture2D(u_rotor, qb / SIZE).gb; // alpha, owner * 60
            float a = blade.x * step(abs(blade.y * 255.0 / 60.0 - float(i + 1)), 0.5);
            a *= step(m.r, A.x + 0.03); // something nearer is in front: hide the blade
            col = mix(col, texture2D(u_img, qb / SIZE).rgb, a);
            // Static spinner on top of the blade roots.
            float hubA = 1.0 - smoothstep(T.w - 1.0, T.w, r);
            col = mix(col, texture2D(u_img, (T.xy + v) / SIZE).rgb, hubA);
        }
    }

    // Steam: soft puffs rising from the cooling towers and chimneys.
    for (int i = 0; i < 4; i++) {
        vec4 E = u_emit[i];
        vec4 S = u_emitShape[i];
        vec2 mouth = E.xy + vec2(0.0, u_shift * (1.0 - E.w));
        vec2 rel = P - mouth;
        if (rel.x < -E.z - S.w || rel.x > S.y + E.z + S.w || rel.y < -S.x - S.w || rel.y > S.z) continue;
        if (m.r > E.w - 0.02) continue; // the tower itself, or anything nearer, hides the steam
        for (int k = 0; k < 7; k++) {
            float period = E.z > 20.0 ? 9.0 : 7.0;
            float t = u_time / period + float(k) / 7.0 + float(i) * 0.37;
            float ph = fract(t);
            float cyc = floor(t);
            float h1 = hash(vec2(cyc, float(k) + 17.0 * float(i)));
            float h2 = hash(vec2(float(k) * 3.1, cyc + 5.0 * float(i)));
            vec2 c = mouth + vec2((h1 * 2.0 - 1.0) * E.z * 0.75 + S.y * pow(ph, 1.6),
                                  -S.x * ph - S.z * 0.4);
            float rad = mix(S.z, S.w, sqrt(ph)) * (0.85 + 0.3 * h2);
            vec2 dv = P - c;
            float dist = length(dv) / rad + (noise(P * 0.08 + h2 * 40.0) - 0.5) * 0.25;
            float alpha = smoothstep(0.0, 0.15, ph) * (1.0 - smoothstep(0.4, 1.0, ph)) * 0.9;
            float a = alpha * (1.0 - smoothstep(0.8, 1.0, dist));
            float lit = clamp(0.6 - dv.y / rad * 0.5 - dv.x / rad * 0.15, 0.0, 1.0);
            vec3 puff = mix(vec3(0.82, 0.88, 0.92), vec3(0.98, 0.98, 0.96), lit);
            col = mix(col, puff, a);
        }
    }

    gl_FragColor = vec4(col, 1.0);
}
`;
