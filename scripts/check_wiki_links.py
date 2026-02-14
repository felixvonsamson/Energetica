#!/usr/bin/env python3
"""
Wiki link checker and connection visualizer.

Usage: python scripts/check_wiki_links.py [port=5173]

Checks all links in wiki MDX files for 2XX responses, then outputs
Mermaid flowchart and mindmap of inter-wiki connections.
"""

import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
BASE_URL = f"http://localhost:{PORT}"
ROOT = Path(__file__).parent.parent
WIKI_DIR = ROOT / "frontend/src/content/wiki"
ROUTES_DIR = ROOT / "frontend/src/routes"

OUT_FILE = ROOT / "wiki-links.md"

GREEN, RED, RESET, BOLD, DIM = "\033[92m", "\033[91m", "\033[0m", "\033[1m", "\033[2m"


def extract_hrefs(content: str) -> list[str]:
    hrefs = re.findall(r"\[[^\]]*\]\(([^)]+)\)", content)  # [text](href)
    hrefs += re.findall(r'href="([^"]+)"', content)  # href="..."
    return hrefs


def build_route_patterns(routes_dir: Path) -> list[re.Pattern]:
    """Build regex patterns from TanStack Router file-based route files."""
    patterns = []
    for tsx in routes_dir.rglob("*.tsx"):
        rel = tsx.relative_to(routes_dir)
        parts = list(rel.with_suffix("").parts)
        if parts[0].startswith("__"):  # __root.tsx
            continue
        if parts[-1] == "index":
            parts = parts[:-1]
        if not parts:
            continue
        segment_patterns = []
        for part in parts:
            segment_patterns.append("[^/]+" if part.startswith("$") else re.escape(part))
        patterns.append(re.compile("^/" + "/".join(segment_patterns) + "$"))
    return patterns


def check_app_route(path: str, patterns: list[re.Pattern]) -> bool:
    base = path.split("#")[0]
    return any(p.match(base) for p in patterns)


def check_url(url: str) -> int | str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "wiki-checker/1.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"ERR: {e}"


def validate(href: str, route_patterns: list[re.Pattern]) -> tuple[bool, str]:
    """Returns (ok, status_label) for a given href."""
    base = href.split("#")[0]
    if base.startswith("./") and base.endswith(".mdx"):
        exists = (WIKI_DIR / base[2:]).exists()
        return exists, "file" if exists else "missing"
    if base.startswith("/app/"):
        ok = check_app_route(base, route_patterns)
        return ok, "route" if ok else "no route"
    if base.startswith("/") or base.startswith("http"):
        url = f"{BASE_URL}{base}" if base.startswith("/") else base
        status = check_url(url)
        ok = isinstance(status, int) and 200 <= status < 300
        return ok, str(status)
    return True, "skip"


def slug_id(slug: str) -> str:
    return slug.replace("-", "_")


def slug_label(slug: str) -> str:
    return slug.replace("-", " ").title()


def main():
    mdx_files = sorted(WIKI_DIR.glob("*.mdx"))
    route_patterns = build_route_patterns(ROUTES_DIR)

    wiki_connections: dict[str, list[str]] = {}
    href_sources: dict[str, list[str]] = {}  # href -> [source_slugs]

    for path in mdx_files:
        slug = path.stem
        hrefs = extract_hrefs(path.read_text())
        seen_targets: set[str] = set()
        wiki_connections[slug] = []
        for href in hrefs:
            base = href.split("#")[0]
            if base.startswith("./") and base.endswith(".mdx"):
                target = base[2:-4]
                if target not in seen_targets:
                    wiki_connections[slug].append(target)
                    seen_targets.add(target)
            href_sources.setdefault(href, []).append(slug)

    # ── Link check ────────────────────────────────────────────────
    # Deduplicate by base path (strip hash) for HTTP checks, keep full href for display
    seen_bases: set[str] = set()
    unique_hrefs: list[str] = []
    for href in href_sources:
        base = href.split("#")[0]
        if base not in seen_bases:
            seen_bases.add(base)
            unique_hrefs.append(href)

    print(f"{BOLD}Checking {len(unique_hrefs)} unique links...{RESET}\n")
    results: dict[str, tuple[bool, str]] = {}
    check_lines: list[str] = []
    for href in unique_hrefs:
        ok, label = validate(href, route_patterns)
        results[href] = (ok, label)
        color = GREEN if ok else RED
        sources = ", ".join(dict.fromkeys(href_sources[href]))
        print(f"  {'✓' if ok else '✗'} {color}{label:10}{RESET}  {DIM}{href}{RESET}")
        check_lines.append(f"| {'✓' if ok else '✗'} | `{label}` | {href} | {sources} |")

    failures = {h: (ok, lbl) for h, (ok, lbl) in results.items() if not ok}
    if failures:
        print(f"\n{RED}{BOLD}FAILURES:{RESET}")
        for href, (_, label) in failures.items():
            sources = ", ".join(dict.fromkeys(href_sources[href]))
            print(f"  ✗ {label:10}  {href}  (from: {sources})")
    else:
        print(f"\n{GREEN}{BOLD}All {len(results)} links OK ✓{RESET}")

    # ── Build flowchart lines ─────────────────────────────────────
    fc_lines = ["flowchart LR"]
    for slug in wiki_connections:
        fc_lines.append(f'    {slug_id(slug)}["{slug_label(slug)}"]')
    fc_lines.append("")
    for src, targets in wiki_connections.items():
        for tgt in targets:
            fc_lines.append(f"    {slug_id(src)} --> {slug_id(tgt)}")

    # ── Build mindmap lines ───────────────────────────────────────
    mm_lines = ["mindmap", "  root((Wiki))"]
    for slug, targets in wiki_connections.items():
        mm_lines.append(f"    {slug_label(slug)}")
        for tgt in targets:
            mm_lines.append(f"      {slug_label(tgt)}")

    # ── Write markdown file ───────────────────────────────────────
    summary = f"All {len(results)} links OK ✓" if not failures else f"{len(failures)} failure(s)"
    md = f"""# Wiki Link Check

**Server:** {BASE_URL}
**Result:** {summary}

## Link Check

| | Status | Link | Source |
|---|---|---|---|
{chr(10).join(check_lines)}

## Flowchart

```mermaid
{chr(10).join(fc_lines)}
```

## Mindmap

```mermaid
{chr(10).join(mm_lines)}
```
"""
    OUT_FILE.write_text(md)
    print(f"\n{BOLD}Written to {OUT_FILE}{RESET}")


if __name__ == "__main__":
    main()
