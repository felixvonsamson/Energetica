"""Summarise an evaluate.py run: how close each method's season comes to full-season ground truth (#1164).

.venv/bin/python -B prototypes/rep_day_1164/analyse.py /tmp/e1164/run.json
"""

from __future__ import annotations

import itertools
import json
import sys

import numpy as np

rows = json.loads(open(sys.argv[1]).read())
methods = [k for k in rows[0] if isinstance(rows[0][k], dict) and k != "truth"]
players = list(rows[0]["truth"]["profit"])
seasons = ["spring", "summer", "autumn", "winter"]


def profits(method: str, season: str | None = None) -> np.ndarray:
    """Shape [season-run, player]."""
    selected = [r for r in rows if season is None or r["season"] == season]
    return np.array([[r[method]["profit"].get(p, 0.0) for p in players] for r in selected])


truth = profits("truth")
# Each player's typical season profit, to express errors as a share of it.
scale = np.abs(truth).mean(0)


def table(title: str, values: dict[str, list[float]], fmt: str) -> None:
    print(f"\n{title}")
    print(f"{'':32s}" + "".join(f"{p:>14s}" for p in players))
    for method, row in values.items():
        print(f"{method:32s}" + "".join(f"{fmt.format(v):>14s}" for v in row))


bias, rmse, spread = {}, {}, {}
for m in methods:
    est = profits(m)
    bias[m] = list((est - truth).mean(0) / scale * 100)
    rmse[m] = list(np.sqrt(((est - truth) ** 2).mean(0)) / scale * 100)
    # Season-to-season spread across seeds, within each season, as a ratio to the truth's.
    ratios = [profits(m, s).std(0) / np.maximum(profits("truth", s).std(0), 1e-9) for s in seasons]
    spread[m] = list(np.exp(np.log(np.maximum(ratios, 1e-9)).mean(0)))

table("Bias: mean(method - truth), % of the player's typical season profit", bias, "{:+.1f}%")
table("Tracking error: RMS(method - truth), % of the player's typical season profit", rmse, "{:.1f}%")
table("Season-to-season spread across seeds, ratio to the truth's (1.00 = right)", spread, "{:.2f}")


def kendall(a: np.ndarray, b: np.ndarray) -> float:
    pairs = list(itertools.combinations(range(len(a)), 2))
    return float(np.mean([np.sign(a[i] - a[j]) == np.sign(b[i] - b[j]) for i, j in pairs]))


print(f"\n{'':32s}{'pairs ranked':>14s}{'blackouts':>12s}{'wind CF err':>13s}{'PV CF err':>11s}")
truth_blackouts = np.mean([r["truth"]["blackout"] for r in rows])
print(f"{'truth':32s}{'':>14s}{truth_blackouts:>11.0%}")
for m in methods:
    est = profits(m)
    ranked = np.mean([kendall(est[k], truth[k]) for k in range(len(rows))])
    blackouts = np.mean([r[m]["blackout"] for r in rows])
    wind = np.mean([abs(r[m]["wind_cf"] / r["truth"]["wind_cf"] - 1) for r in rows])
    pv = np.mean([abs(r[m]["pv_cf"] / r["truth"]["pv_cf"] - 1) for r in rows])
    print(f"{m:32s}{ranked:>14.0%}{blackouts:>11.0%}{wind:>12.1%}{pv:>11.1%}")
print("\npairs ranked: share of player pairs whose order by season profit matches the truth's")
print("CF err: mean relative error of the simulated days' capacity factor against the season's")
