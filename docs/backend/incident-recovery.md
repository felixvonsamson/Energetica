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
ssh energetica-game
cd /var/www/energetica-{slug}
sudo systemctl stop energetica-{slug}
```

**Step 1 — back up the current instance folder:**

```bash
cp -r instance/ instance.bak.$(date +%Y%m%d_%H%M%S)/
```

**Step 2 — restore from checkpoint and replay:**

The `--load_checkpoint` flag handles everything: it preserves the actions log, removes the stale `instance/` folder, extracts `checkpoints/last_checkpoint.tar.gz`, puts the log back, and replays all recorded actions before resuming normal operation.

> ⚠️ **Run the replay as `energetica`, not as yourself or `root`.** The systemd unit runs as `User=energetica` (`scripts/infra/energetica.service`). If you run the replay as a different user, every file it writes under `instance/` gets that user's ownership, and the next live tick fails with `PermissionError` — putting you straight into another crash loop. Use `sudo -u energetica`:

> ⚠️ **Carry over the unit's `Environment=` variables.** The unit sets `ENERGETICA_INSTANCE_SLUG`, `ENERGETICA_INSTANCE_CONFIG_DIR`, `ENERGETICA_LANDING_DIR`, and `ENERGETICA_ACCOUNTS_DB_PATH` (`scripts/infra/energetica.service`); a plain SSH shell doesn't have them. Without `ENERGETICA_INSTANCE_SLUG` in particular, the instance starts thinking it's public and skips reading its own `instance.json`. Pull them straight from the unit instead of retyping them:

```bash
sudo -u energetica env $(systemctl show energetica-{slug} --property=Environment --value) \
    .venv/bin/python main.py --env prod --no-reload --load_checkpoint
```

Pass the same SSL and port flags used by the production service. Watch for rapid tick replays (`t = XXXX`). Once the ticks slow to the normal 30-second cadence, recovery is complete. Stop the process with Ctrl+C.

If you did run anything as the wrong user by mistake, fix ownership before starting the service:

```bash
sudo chown -R energetica:energetica instance/ checkpoints/
```

**Step 3 — start the service:**

```bash
sudo systemctl start energetica-{slug}
sudo journalctl -u energetica-{slug} -f
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

**The checkpoint predates the `User`→`Player` migration (ADR-0004) and `--load_checkpoint` fails to unpickle.** `energetica/database/user.py` was deleted when `Player` absorbed `username`/`pwhash`/`account_id` directly, so a checkpoint taken before that change still pickles `User` instances — `pickle.load` needs the class importable at its original path to reconstruct them, and fails with an error naming `energetica.database.user`. Step 2 extracts `checkpoints/last_checkpoint.tar.gz` into `instance/` before you'd see this, so after extracting (and before starting the replay) run the one-time compatibility migration on the restored pickle:

```bash
sudo -u energetica .venv/bin/python scripts/migrate-drop-user.py --pickle instance/engine_data.pck
```

Idempotent and a no-op on a checkpoint that's already past the migration, so it's safe to run on every restore as a precaution.

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

## Pausing an instance without simulating downtime

There's no built-in pause/resume: `announced → active → freeze → ended` is one-directional, and `freeze` mints the recap rather than allowing a resumable pause. If an instance needs to stop for a real-world break (e.g. a holiday) and resume afterwards without simulating that gap as elapsed game time, shift the persisted epoch forward by the downtime instead (issue #1024):

```bash
cd /var/www/energetica-{slug}
sudo systemctl stop energetica-{slug}
sudo -u energetica .venv/bin/python scripts/shift_start_date.py --pickle instance/engine_data.pck --days <N>
sudo systemctl start energetica-{slug}
```

`<N>` is the real downtime in whole days (or any other whole multiple of the instance's `clock_time` — every supported `clock_time` divides a day evenly, so whole days are always safe). The script refuses to run against an instance it can still see running, backs up the pickle before writing, and prints the old/new `start_date`; pass `--dry-run` first to check the math. Editing `start_date` in the instance's config file does **not** work here — it's read only by `init_instance()`, never by `engine.load()`, which is the path a restart of an already-running instance always takes.
