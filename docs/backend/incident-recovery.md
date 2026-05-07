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
ssh deploy@energetica-edu
cd /var/www/energetica
sudo systemctl stop energetica
```

**Step 1 — back up the current instance folder:**

```bash
sudo -u www-data cp -r instance/ instance.bak.$(date +%Y%m%d_%H%M%S)/
```

**Step 2 — preserve the actions log:**

```bash
sudo -u www-data cp instance/actions_history.log /tmp/actions_history.log.bak
```

**Step 3 — restore the checkpoint** (this overwrites `instance/` with a consistent snapshot):

```bash
sudo -u www-data tar -xzf checkpoints/last_checkpoint.tar.gz
```

**Step 4 — put the actions log back** (so the engine can replay all actions since the checkpoint):

```bash
sudo -u www-data cp /tmp/actions_history.log.bak instance/actions_history.log
```

**Step 5 — start the service:**

```bash
sudo systemctl start energetica
sudo journalctl -u energetica -f
```

Watch the logs. You should see the engine replaying ticks rapidly until it catches up to the present, then resume normal 30-second ticks.

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

Checkpoints are saved to `checkpoints/last_checkpoint.tar.gz` by `save_checkpoint()` in `game_engine.py`. They are a tarball of the entire `instance/` directory including `engine_data.pck` and all data files at a consistent point in time.

The checkpoint on `energetica-edu` is saved roughly every hour (check `ls -la checkpoints/` to see its age).
