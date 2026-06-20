# Incident Recovery

## The data integrity check

On startup, `engine.load()` (`game_engine.py:238`) compares the mtime of `instance/engine_data.pck` against the newest file in `instance/data/**/*`. If any data file is newer than the pickle, startup aborts with:

```
RuntimeError: The data has not been saved correctly, please restart form the last checkpoint.
```

This happens when the process is killed mid-save (OOM kill, SIGKILL, power loss) — some data files were written but `engine_data.pck` was never updated.

## How recovery works

`instance/actions_history.log` records every player action and every tick as a JSON line. On startup, after `engine.load()` succeeds, the engine reads this file and replays all actions recorded after the loaded tick. This means as long as the log is intact, no player actions are lost even when restoring an older checkpoint.

**Never overwrite or delete `instance/actions_history.log` during recovery.**

## Recovery procedure

```bash
ssh root@energetica-edu
cd /var/www/energetica
systemctl stop energetica
```

**Step 1 — back up the current instance folder:**

```bash
cp -r instance/ instance.bak.$(date +%Y%m%d_%H%M%S)/
```

**Step 2 — restore from checkpoint and replay:**

The `--load_checkpoint` flag handles everything: it preserves the actions log, removes the stale `instance/` folder, extracts `checkpoints/last_checkpoint.tar.gz`, puts the log back, and replays all recorded actions before resuming normal operation.

> ⚠️ **Run the replay as `www-data`, not `root`.** The systemd service runs as `www-data`. If you run the replay as `root`, every file it writes under `instance/` becomes root-owned, and the next live tick fails with `PermissionError` — putting you straight into another crash loop. Use `sudo -u www-data`:

```bash
sudo -u www-data python main.py --env prod --no-reload --load_checkpoint
```

Pass the same SSL and port flags used by the production service. Watch for rapid tick replays (`t = XXXX`). Once the ticks slow to the normal 30-second cadence, recovery is complete. Stop the process with Ctrl+C.

If you did run anything as `root` by mistake, fix ownership before starting the service:

```bash
chown -R www-data:www-data instance/ checkpoints/
```

**Step 3 — start the service:**

```bash
systemctl start energetica
journalctl -u energetica -f
```

## Verifying recovery

Check the startup logs for a line like:

```
Loaded last checkpoint
```

followed by rapid tick replays (`t = XXXX`). If the engine logs an error instead, stop the service immediately before anything is overwritten, and investigate.

## What can go wrong

**The actions log is from a different instance than the checkpoint.** This happens if you restore the wrong checkpoint. The engine asserts `uuid` consistency and will abort — safe to retry with the correct checkpoint.

**The checkpoint is very old and the actions log is huge.** Replay can take minutes. Don't interrupt it.

**The actions log itself is corrupt or truncated.** The engine will abort on the malformed line. In this case you lose actions from the truncation point forward; restore without the log or replay up to the last valid tick.

## Common causes

| Symptom | Cause |
|---|---|
| OOM kill in journalctl (`result 'oom-kill'`) | Process exceeded memory limit mid-save |
| `Deactivated successfully` just before crash loop | Process stopped cleanly mid-tick (manual stop, deploy) |
| `dictionary changed size during iteration` errors before crash | Race condition between tick thread and request threads (separate bug) |

## Checkpoints

Persistence runs at two cadences (see `utils/tick_execution.py`):

- **`engine.save()` — every 10 minutes.** Writes only `instance/engine_data.pck` (the in-memory engine state). This is what `engine.load()` reads on a normal restart, so the **loaded tick** is usually at most ~10 minutes old.
- **`save_checkpoint()` — every 6 hours.** Writes `checkpoints/last_checkpoint.tar.gz`, a tarball of the entire `instance/` directory (including a fresh `engine_data.pck` and all data files) at a consistent point in time. This is the unit of disaster recovery.

Check `ls -la checkpoints/` to see the current checkpoint's age. Because the checkpoint is only every 6 h, recovery relies on replaying the actions log forward from the checkpoint tick — which is why the log must never be truncated below a tick you might need to restore from (see `docs/adr/0001-action-log-stays-complete-fix-oom-on-read.md`).
