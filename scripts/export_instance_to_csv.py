"""
Export an Energetica instance snapshot to CSV files.

Usage (run from the repo root):
    python scripts/export_instance_to_csv.py <instance_dir> <output_dir>

Defaults:
    instance_dir : instance/
    output_dir   : energetica_export/

Outputs (one file per resolution: 1d, 6d, 36d, 216d):
    players_<res>.csv   – per-player time series (revenues, generation, demand, …)
    network_<res>.csv   – per-network market time series (price, generation mix, per-player flows)
    climate_<res>.csv   – global climate data (CO2, temperature)
    market_last.csv     – last-tick supply/demand bid curves for all networks
"""

import argparse
import os
import pickle
import re
import sys
from datetime import timedelta

import pandas as pd


RESOLUTIONS = [
    (0,   1,  "1d"),
    (1,   6,  "6d"),
    (2,  36,  "36d"),
    (3, 216,  "216d"),
]


def key_name(k):
    return k if isinstance(k, str) else k.value


def extract_facility_name(s):
    m = re.search(r"'([^']+)'", str(s))
    return m.group(1) if m else str(s)


def time_points(total_t, clock_time, start_date, factor):
    result = []
    for i in range(360):
        tick = total_t - (359 - i) * factor
        if tick >= 0:
            result.append((i, tick, start_date + timedelta(seconds=tick * clock_time)))
    return result


# ── Players ───────────────────────────────────────────────────────────────────

def export_players(base, out, eng, id_to_username):
    total_t    = eng["total_t"]
    clock_time = eng["clock_time"]
    start_date = eng["start_date"]
    players_db = eng["db_model_instances"]["Player"]

    for res_idx, factor, name in RESOLUTIONS:
        print(f"Building players_{name}.csv ...")
        pts = time_points(total_t, clock_time, start_date, factor)
        all_rows = []

        for pid in sorted(players_db.keys()):
            pfile = f"{base}/data/players/player_{pid}.pck"
            if not os.path.exists(pfile):
                continue
            with open(pfile, "rb") as f:
                d = pickle.load(f)

            username = id_to_username.get(pid, str(pid))

            for i, tick, ts in pts:
                row = {
                    "player_id": pid,
                    "username":  username,
                    "timestamp": ts.isoformat(),
                    "tick":      tick,
                }
                for cat, series in d["revenues"].items():
                    row[f"revenue_{cat}"] = series[res_idx][i]
                for fac, series in d["op_costs"].items():
                    row[f"op_cost_{key_name(fac)}"] = series[res_idx][i]
                for fac, series in d["generation"].items():
                    row[f"generation_{key_name(fac)}"] = series[res_idx][i]
                for fac, series in d["demand"].items():
                    row[f"demand_{key_name(fac)}"] = series[res_idx][i]
                for fac, series in d["storage"].items():
                    row[f"storage_{key_name(fac)}"] = series[res_idx][i]
                for fac, series in d["storage_soc"].items():
                    row[f"soc_storage_{key_name(fac)}"] = series[res_idx][i]
                for res, series in d["resources"].items():
                    row[f"resource_{key_name(res)}"] = series[res_idx][i]
                for res, series in d.get("resources_soc", {}).items():
                    row[f"soc_resource_{key_name(res)}"] = series[res_idx][i]
                for fac, series in d["emissions"].items():
                    row[f"emission_{key_name(fac)}"] = series[res_idx][i]
                row["balance"] = d["money"]["balance"][res_idx][i]
                all_rows.append(row)

        df = pd.DataFrame(all_rows)
        df.to_csv(f"{out}/players_{name}.csv", index=False)
        print(f"  -> {len(df)} rows, {len(df.columns)} columns")


# ── Network time series ───────────────────────────────────────────────────────

def export_networks(base, out, eng, id_to_username):
    total_t     = eng["total_t"]
    clock_time  = eng["clock_time"]
    start_date  = eng["start_date"]
    networks_db = eng["db_model_instances"]["Network"]

    for res_idx, factor, name in RESOLUTIONS:
        print(f"Building network_{name}.csv ...")
        pts = time_points(total_t, clock_time, start_date, factor)
        all_rows = []

        for net_id, net in networks_db.items():
            ts_path = f"{base}/data/networks/{net_id}/time_series.pck"
            if not os.path.exists(ts_path):
                continue
            with open(ts_path, "rb") as f:
                ts = pickle.load(f)

            net_name = net.name.strip()
            for i, tick, timestamp in pts:
                row = {
                    "network_id":      net_id,
                    "network_name":    net_name,
                    "timestamp":       timestamp.isoformat(),
                    "tick":            tick,
                    "market_price":    ts["network_data"]["price"][res_idx][i],
                    "market_quantity": ts["network_data"]["quantity"][res_idx][i],
                }
                for pid, series in ts["exports"].items():
                    row[f"export_{id_to_username.get(pid, pid)}"] = series[res_idx][i]
                for pid, series in ts["imports"].items():
                    row[f"import_{id_to_username.get(pid, pid)}"] = series[res_idx][i]
                for fac, series in ts["generation"].items():
                    row[f"generation_{key_name(fac)}"] = series[res_idx][i]
                for fac, series in ts["consumption"].items():
                    row[f"consumption_{key_name(fac)}"] = series[res_idx][i]
                all_rows.append(row)

        df = pd.DataFrame(all_rows)
        df.to_csv(f"{out}/network_{name}.csv", index=False)
        print(f"  -> {len(df)} rows, {len(df.columns)} columns")


# ── Market last tick (supply/demand curves) ───────────────────────────────────

def export_market_last(base, out, eng, id_to_username):
    print("Building market_last.csv ...")
    networks_db = eng["db_model_instances"]["Network"]
    rows = []

    for net_id in networks_db:
        charts_dir = f"{base}/data/networks/{net_id}/charts"
        if not os.path.exists(charts_dir):
            continue
        last_file = sorted(os.listdir(charts_dir))[-1]
        tick_num = int(re.search(r"market_t(\d+)", last_file).group(1))

        with open(f"{charts_dir}/{last_file}", "rb") as f:
            chart = pickle.load(f)

        for side, section in [("supply", "capacities"), ("demand", "demands")]:
            data = chart[section]
            for j in range(len(data["player_id"])):
                pid = data["player_id"][j]
                rows.append({
                    "network_id":    net_id,
                    "tick":          tick_num,
                    "side":          side,
                    "player_id":     pid,
                    "username":      id_to_username.get(pid, str(pid)),
                    "facility":      extract_facility_name(data["facility"][j]),
                    "price":         data["price"][j],
                    "capacity":      data["capacity"][j],
                    "cumul_capacity": data["cumul_capacities"][j],
                })

    df = pd.DataFrame(rows)
    df.to_csv(f"{out}/market_last.csv", index=False)
    print(f"  -> {len(df)} rows, {len(df.columns)} columns")


# ── Climate ───────────────────────────────────────────────────────────────────

def export_climate(base, out, eng):
    total_t    = eng["total_t"]
    clock_time = eng["clock_time"]
    start_date = eng["start_date"]

    with open(f"{base}/data/servers/climate_data.pck", "rb") as f:
        climate = pickle.load(f)

    for res_idx, factor, name in RESOLUTIONS:
        print(f"Building climate_{name}.csv ...")
        pts = time_points(total_t, clock_time, start_date, factor)
        rows = []
        for i, tick, timestamp in pts:
            row = {"timestamp": timestamp.isoformat(), "tick": tick}
            for gas, series in climate["emissions"].items():
                row[f"emission_{key_name(gas)}"] = series[res_idx][i]
            for field, series in climate["temperature"].items():
                row[f"temperature_{field}"] = series[res_idx][i]
            rows.append(row)

        df = pd.DataFrame(rows)
        df.to_csv(f"{out}/climate_{name}.csv", index=False)
        print(f"  -> {len(df)} rows, {len(df.columns)} columns")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("instance_dir", nargs="?", default="instance", help="Path to the instance folder")
    parser.add_argument("output_dir",   nargs="?", default="energetica_export", help="Path to the output folder")
    args = parser.parse_args()

    base = args.instance_dir
    out  = args.output_dir
    os.makedirs(out, exist_ok=True)

    engine_file = f"{base}/engine_data.pck"
    if not os.path.exists(engine_file):
        print(f"Error: {engine_file} not found.", file=sys.stderr)
        sys.exit(1)

    with open(engine_file, "rb") as f:
        eng = pickle.load(f)

    id_to_username = {
        pid: p.user.username
        for pid, p in eng["db_model_instances"]["Player"].items()
    }

    export_players(base, out, eng, id_to_username)
    export_networks(base, out, eng, id_to_username)
    export_market_last(base, out, eng, id_to_username)
    export_climate(base, out, eng)

    print(f"\nDone. Files written to {out}/")


if __name__ == "__main__":
    main()
