#!/usr/bin/env python3
"""Write the facility-card showcase's demo data from the Workshop backend (#1482).

Run from the repo root with ``bun run generate-showcase-data``. See ``energetica.workshop.showcase`` for what it writes.
"""

from pathlib import Path

from energetica.workshop.showcase import SHOWCASE_DATA_PATH, render_showcase_data

REPO_ROOT = Path(__file__).resolve().parent.parent

if __name__ == "__main__":
    path = REPO_ROOT / SHOWCASE_DATA_PATH
    path.write_text(render_showcase_data())
    print(f"✓ Wrote {SHOWCASE_DATA_PATH}")
