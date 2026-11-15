# ruff: noqa
"""PROTOTYPE (#1469): export the gallery as one self-contained HTML file, for sharing.

run (after render.py):
    ~/.cache/energetica-proto-1440/venv/bin/python export_html.py [out.html]

Every SVG is packed into one gzip blob, base64-encoded inside the page, and unpacked in the
browser with DecompressionStream (any current browser). Renders that differ only in their
internal ids are stored once. The page mirrors the dev gallery in plain HTML and JS.
"""

import base64
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
RENDERS = HERE.parent / "renders"
DEFAULT_OUT = HERE.parent / "export" / "energetica-asset-direction-1469.html"

_ID = re.compile(r'id="([^"]+)"')


def normalise_ids(svg):
    """Rename ids in order of appearance so renders that only differ by id prefix match."""
    names = {}
    for old in _ID.findall(svg):
        names.setdefault(old, f"i{len(names)}")
    if not names:
        return svg
    pat = re.compile(
        r'(id="|url\(#|href="#)(' + "|".join(re.escape(k) for k in sorted(names, key=len, reverse=True)) + r')(?=[")])'
    )
    return pat.sub(lambda m: m.group(1) + names[m.group(2)], svg)


def main(argv):
    out = Path(argv[0]) if argv else DEFAULT_OUT
    m = json.loads((RENDERS / "manifest.json").read_text())
    blobs, index = [], {}
    for r in m["renders"]:
        svg = normalise_ids((RENDERS / r["src"]).read_text())
        h = hashlib.sha1(svg.encode()).hexdigest()
        if h not in index:
            index[h] = len(blobs)
            blobs.append(svg)
        r["i"] = index[h]
        del r["src"]
    packed = base64.b64encode(gzip.compress("\x00".join(blobs).encode(), 9)).decode()
    html = TEMPLATE.replace("/*MANIFEST*/null", json.dumps(m, separators=(",", ":"))).replace("%%BLOB%%", packed)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(f"{len(m['renders'])} renders, {len(blobs)} unique -> {out} ({out.stat().st_size / 1e6:.1f} MB)")


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Energetica · facility assets: visual direction (prototype, #1469)</title>
<style>
  :root { --bg: #f4f1ea; --fg: #1f1d1a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { padding: 0 32px 120px; }
  header { max-width: 900px; padding: 40px 0 24px; }
  .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .15em; text-transform: uppercase; opacity: .6; margin: 0; }
  h1 { font-size: 30px; letter-spacing: -.01em; margin: 4px 0 12px; }
  h2 { font-size: 20px; margin: 0 0 4px; }
  h3 { font-size: 14px; margin: 0 0 12px; text-transform: capitalize; }
  p { margin: 0; opacity: .82; max-width: 820px; }
  nav { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 4px 16px; }
  nav a { color: inherit; text-underline-offset: 4px; }
  .pills { margin-top: 16px; display: flex; gap: 6px; align-items: center; font-size: 12px; }
  .pills button { font: inherit; color: inherit; background: none; border: 1px solid transparent; border-radius: 99px; padding: 1px 9px; cursor: pointer; opacity: .6; }
  .pills button.on { border-color: currentColor; font-weight: 600; opacity: 1; }
  section { border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); padding: 40px 0; }
  section > p { margin-bottom: 24px; }
  .scroll { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 24px 16px; margin-left: -24px; }
  th { text-align: left; font-size: 13px; }
  td.name { width: 112px; font-weight: 500; font-size: 13px; }
  .pair { display: flex; align-items: flex-end; gap: 12px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  figcaption { font-size: 11px; opacity: .7; text-align: center; max-width: 240px; }
  .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 32px; margin-bottom: 32px; }
  details { margin-bottom: 24px; }
  summary { cursor: pointer; font-weight: 600; font-size: 15px; text-transform: capitalize; }
  .card { border-radius: 12px; overflow: hidden; box-shadow: 0 0 0 1px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.08); }
  .card.front { background: rgba(255,255,255,.6); padding: 8px; }
  .cards { display: flex; flex-wrap: wrap; gap: 40px; }
  .cards .pair { align-items: stretch; }
  img { display: block; }
  #bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 9; display: flex; align-items: center; gap: 12px;
         background: #000; color: #fff; border-radius: 99px; padding: 8px 16px; font: 13px ui-monospace, Menlo, monospace; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
  #bar button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0 4px; }
  #loading { padding: 80px 0; opacity: .6; }
</style>
</head>
<body>
<main id="app"><div id="loading">Unpacking renders…</div></main>
<div id="bar" hidden><button id="prev" aria-label="Previous palette">←</button><span id="barlabel"></span><button id="next" aria-label="Next palette">→</button></div>
<script id="blob" type="application/octet-stream">%%BLOB%%</script>
<script>
const M = /*MANIFEST*/null;
const BG = { paper: ["#f4f1ea", "#1f1d1a"], pine: ["#a4be7b", "#1f1d1a"], dark: ["#22261f", "#f2efe8"] };
const PALETTES = Object.keys(M.palettes);
const AXES = { light: M.lights, outline: M.outlines, texture: M.textures };
const D = M.default, TILE = M.camera.tilePx, CARD = M.camera.cardPx;
let URLS = [];
const params = new URLSearchParams(location.hash.slice(1));
const state = { palette: PALETTES.includes(params.get("palette")) ? params.get("palette") : D.palette,
                bg: params.get("bg") in BG ? params.get("bg") : "paper" };

async function unpack() {
  const b64 = document.getElementById("blob").textContent.trim();
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  URLS = text.split("\u0000").map(s => URL.createObjectURL(new Blob([s], { type: "image/svg+xml" })));
}

function find(q) {
  const w = { ...D, ...q };
  return M.renders.find(r => (q.section === undefined || r.section === q.section) && (q.facility === undefined || r.facility === q.facility)
    && (q.w === undefined || r.w === q.w) && r.palette === w.palette && r.light === w.light && r.outline === w.outline && r.texture === w.texture);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function img(r, width, label) {
  if (!r) return `<div style="color:#b00;font-size:12px">missing</div>`;
  return `<figure><img src="${URLS[r.i]}" width="${width ?? r.w}" alt="${esc(label ?? "")}" draggable="false">${label ? `<figcaption>${esc(label)}</figcaption>` : ""}</figure>`;
}
function pair(q) {
  const sec = q.section === "style" ? "style" : "map";
  const t = find({ ...q, section: sec, w: TILE }) ?? find({ ...q, section: "map", w: TILE });
  const c = find({ ...q, section: sec, w: CARD }) ?? find({ ...q, section: "map", w: CARD });
  return `<div class="pair">${img(t, TILE)}${img(c, CARD)}</div>`;
}
function table(cols, rowFn) {
  return `<div class="scroll"><table><thead><tr><th></th>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`
    + M.facilities.map(f => `<tr><td class="name">${esc(f.label)}</td>${rowFn(f)}</tr>`).join("") + `</tbody></table></div>`;
}

function render() {
  const p = state.palette;
  const [bg, fg] = BG[state.bg];
  document.body.style.setProperty("--bg", bg);
  document.body.style.setProperty("--fg", fg);
  const open = new Set([...document.querySelectorAll("details[open]")].map(d => d.dataset.axis));
  const firstRender = !document.querySelector("details");
  const y = scrollY;
  document.getElementById("app").innerHTML = `
  <header>
    <p class="eyebrow">Prototype · #1469 · throwaway</p>
    <h1>Facility assets: visual direction</h1>
    <p>Every image is the same 3D model projected to flat SVG. The map camera is a parallel projection from ${M.camera.azimuth}° round and ${M.camera.elevation}° up, so a hex vertex points at the viewer. Small images are at map-tile size (${TILE} px wide), large ones at facility card size (${CARD} px). The tile-size column is the main test.</p>
    <p style="margin-top:8px">The black bar at the bottom (or the ← / → keys) switches the palette for sections 2 to 5. Section 1 always shows every palette.</p>
    <nav><a href="#palettes">1. Palettes</a><a href="#patch">2. A patch of map</a><a href="#questions">3. Open questions</a><a href="#cards">4. Card front and back</a><a href="#free">5. Free camera</a></nav>
    <div class="pills">Page background: ${Object.keys(BG).map(b => `<button data-bg="${b}" class="${b === state.bg ? "on" : ""}">${b}</button>`).join("")}</div>
  </header>
  <section id="palettes"><h2>1. Palettes on the map camera</h2><p>Same light, no lines, flat fills. Read each row at tile size first.</p>
    ${table(PALETTES.map(k => M.palettes[k]), f => PALETTES.map(k => `<td>${pair({ facility: f.key, palette: k })}</td>`).join(""))}
  </section>
  <section id="patch"><h2>2. A patch of map, at tile size (${p})</h2><p>All facilities together on hex tiles, as the map would show them. One patch per style option, so the options can be judged where it matters. Empty tiles are grass, forest or water.</p>
    <div class="row">${img(find({ section: "minimap", palette: p }), undefined, "Default: key light from the left, no lines, flat")}</div>
    ${Object.entries(AXES).map(([axis, opts]) => `<h3>${axis}</h3><div class="row">${Object.entries(opts).map(([o, l]) => img(find({ section: "minimap", palette: p, [axis]: o }), undefined, l)).join("")}</div>`).join("")}
  </section>
  <section id="questions"><h2>3. Open questions, facility by facility (${p})</h2><p>One question at a time; everything else stays at the default. Marker fill needs lines, so it comes with ink edges.</p>
    ${Object.entries(AXES).map(([axis, opts]) => `<details data-axis="${axis}" ${(firstRender ? axis === "outline" : open.has(axis)) ? "open" : ""}><summary>${axis}</summary>
      ${table(Object.values(opts), f => Object.keys(opts).map(o => `<td>${pair({ section: "style", facility: f.key, palette: p, [axis]: o })}</td>`).join(""))}</details>`).join("")}
  </section>
  <section id="cards"><h2>4. Facility card, front and back (${p})</h2><p>Front: the whole facility from the map camera. Back: a crop on one telling detail, from the same camera and model.</p>
    <div class="cards">${M.facilities.map(f => `<div><div style="font-weight:500;margin-bottom:8px">${esc(f.label)}</div><div class="pair">
      <div class="card front">${img(find({ section: "map", facility: f.key, palette: p, w: CARD }), 220)}</div>
      <div class="card">${img(find({ section: "closeup", facility: f.key, palette: p }), 220)}</div></div></div>`).join("")}</div>
  </section>
  <section id="free"><h2>5. Free camera (${p})</h2><p>A lower perspective view for previews and illustrations, not bound to the map camera. The facility still sits on its tile, like a diorama.</p>
    <div class="row">${M.facilities.map(f => img(find({ section: "free", facility: f.key, palette: p }), 480, f.label)).join("")}</div>
  </section>`;
  document.querySelectorAll("[data-bg]").forEach(b => b.onclick = () => { state.bg = b.dataset.bg; update(); });
  document.getElementById("barlabel").innerHTML = `palette: <b>${p}</b> <span style="opacity:.6">(${PALETTES.indexOf(p) + 1}/${PALETTES.length})</span>`;
  scrollTo(0, y);
}
function update() {
  history.replaceState(null, "", `#palette=${state.palette}&bg=${state.bg}`);
  render();
}
function step(d) { state.palette = PALETTES[(PALETTES.indexOf(state.palette) + d + PALETTES.length) % PALETTES.length]; update(); }

unpack().then(() => {
  document.getElementById("bar").hidden = false;
  document.getElementById("prev").onclick = () => step(-1);
  document.getElementById("next").onclick = () => step(1);
  addEventListener("keydown", e => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
  render();
}).catch(e => { document.getElementById("app").textContent = "Could not unpack the renders: " + e + ". Please open this file in a current version of Chrome, Firefox or Safari."; });
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main(sys.argv[1:])
