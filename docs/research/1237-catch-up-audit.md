# Catching every deployment up to main: audit and deploy log (Oct 17, 2026)

This is the evidence from "Catch up every deployment to main" (#1237), part of the
automated-deployment map (#889). It records what had to change to bring every deployed
component from its old commit up to `main` at `b913be2a`. It also records how the deploy went.
"Design versioned state with stacked migrations" (#1240) uses it as its evidence base.

## Starting point

| Component | Deployed commit | Behind `main` | State |
|---|---|---|---|
| landing | not stamped | unknown | live |
| lobby | `2b69b9524` (Sep 26) | 267 commits | live |
| volta | `2b69b9524` | 267 | live, public, `freeze_at` Nov 1, `ended_at` Nov 7 |
| energie-und-klima-hs2026 | `2b69b9524` | 267 | live, private, no end date |
| energy-now | `04211b45b` (Oct 9) | 118 | live, private |
| neue-energiewirtschaft-hs2026 | `2b69b9524` | 267 | **stopped and disabled since Sep 26 08:19 UTC** |

The range `2b69b9524..b913be2a` holds 70 merged PRs. About 45 of them touch only Workshop code.
energy-now's `04211b45b` already contained 34 of the 70.

## Catalogue

### Schema migrations (`accounts.db`)

None. `accounts/db.py` only moved to `identity/accounts/db.py`. The live schema matched `main`
exactly: the `accounts` table, the `instance_membership` columns (`role`, `settled_at`), and
the partial unique index.

### State migrations (freeplay save)

One, and it is automatic. The freeplay carve-out (#1055, PR #1122) moved the model classes from
`energetica.database.*` to `energetica.freeplay.database.*`. A pickle records each object's class
by its module path, so a save written by `2b69b9524` names the old paths. `main` reads them
through `freeplay/legacy_pickle.py`, whose `find_class` maps the old package to the new one. The
next save writes the new paths, so the change is one way: `2b69b9524` cannot read a save written
by `main`.

We checked this before deploying. Real saves from volta, energie-und-klima-hs2026 and energy-now
were downloaded, loaded under `main`, run for 30 to 300 ticks and saved again, all without
errors. A walk of every loaded object found no attribute that `main` expects and the save lacks.
After the deploy, the first save of each old-layout Run contained only the new paths.

The other pickles under `instance/data/` reference only `energetica.enums.*` and numpy, which did
not move.

energy-now's save already used the new paths.

### Manual config changes

- **`instance.json` needs `"run": {"mode": "freeplay"}`** (#1060, PR #1124). This applied to
  volta, energie-und-klima-hs2026 and neue-energiewirtschaft-hs2026. `main` requires the block,
  and `2b69b9524` rejects it because its model forbids unknown keys. So each Run had to be
  stopped, edited and deployed in one window. `deploy-instance.sh` checks the file before it ships
  anything.
- `instance.env`, `server.json` and the shared secret needed no change.

### Manual infra changes

- **Re-render each instance vhost** (#1055, PR #1122) for the same three Runs. The new vhost
  denies `src/energetica/freeplay/data`, where the quiz data now lives. `deploy-instance.sh`
  refuses to deploy without it.
- **Move the `energetica` user's home** from `/var/www` to `/var/cache/energetica` (#1067,
  PR #1128). This was optional: until it moved, pip ran without a download cache.
- The systemd units, the reaper and its timer, the sudoers files, and the lobby and landing vhosts
  already matched `main`.

### Player-visible changes in freeplay

No change to gameplay, balance, technology data or `config/` values. Players see these changes:

- Charts that break data down by player show you in the primary colour and everyone else in
  blue-grey (#1162).
- The power, time-series and merit-order charts were refactored (#1163). No one looked at the
  freeplay pages in a browser afterwards.
- A loading spinner appears while the app fetches `/api/v1/run`, and an error screen if that
  fails (#1141).
- The merit-order price axis is capped at 1,200 instead of 2,000 (#1228).
- Facilitator pages show a single roster list (#1139).

### Deploy order

There was no constraint. An old lobby works with new Runs and the reverse: the session cookie,
`accounts.db`, the fragment model and the error field name are unchanged across the range.

## What was done

All times are UTC, Oct 17, 2026, deploying from `b913be2a`.

1. Pushed the bootstrap scripts (`push-bootstrap.sh`).
2. Deployed the landing, then the lobby.
3. Deployed energy-now, used as the canary because its config and vhost were already migrated.
4. For volta, then energie-und-klima-hs2026: re-rendered the vhost, copied `engine_data.pck`
   and `instance.json` to `.pre-main`, stopped the service, added the `run` block, and deployed.
5. neue-energiewirtschaft-hs2026: Felix confirmed the stop was a planned break. It should have
   resumed on Oct 16 at 16:00 Swiss time but was forgotten. We chose to resume it exactly where
   it stopped. The save was at `total_t` 59184 with a 30 s clock. `start_date` was shifted forward
   by 61,865 ticks using `2b69b9524`'s copy of `scripts/shift_start_date.py`, because `main`'s copy
   imports a module the installed `2b69b9524` code lacks. Then the `run` block was added, the Run
   was deployed, and the unit was enabled again. It resumed at t=59185 with no catch-up.
6. Moved the `energetica` user's home with every service stopped, then started them again.
7. Removed leftovers from the old single-instance setup: `energetica.service`,
   `/var/www/energetica/` (the mar-27-2026 game, which is archived elsewhere), seven old vhost
   files that were not enabled, and two July `accounts.db` backups.

The `.pre-main` copies are kept as the rollback point until "Decide what a rollback restores"
(#1244) says otherwise.

## Final state

| Component | Backend | Frontend | Compared with `main` |
|---|---|---|---|
| lobby | `b913be2a1` | `b913be2a1` | up to date |
| energie-und-klima-hs2026 | `b913be2a1` | `b913be2a1` | up to date |
| energy-now | `b913be2a1` | `b913be2a1` | up to date |
| neue-energiewirtschaft-hs2026 | `b913be2a1` | `b913be2a1` | up to date |
| volta | `b913be2a1` | `b913be2a1` | up to date |

The landing was deployed from `b913be2a` but has no version stamp yet. "Stamp the deployed version
on dist-landing" (#1243) adds one.

## Surprises

- **neue-energiewirtschaft-hs2026 was down for three weeks** without anyone noticing. A deploy
  on Sep 28 stamped it with `2b69b9524` but never restarted it, so the code on disk had never run.
  Filed as a feature: a pause a facilitator controls (#1261).
- **Runs that start at the same moment crash.** `freeplay/app.py` takes a lock by binding one
  abstract socket name that every process on the host shares. Starting five services at once
  crashed three Runs 1 to 3 times each until `Restart=always` recovered them. A reboot would do
  the same. Filed as #1262.
- **Root cannot write `instance.json` in place.** The server has `fs.protected_regular = 2`, so the
  documented `printf > $CONFIG` fails even as root. Writing as `energetica` with
  `runuser -u energetica -- tee` works. `shift_start_date.py` is not shipped to the server either.
  Filed as #1263.
- **The `energetica-game` ssh alias logs in as `root`**, not `deploy`. The deploy scripts are not
  affected, because they name `deploy@` themselves.
- **The code directories are `deploy:deploy 755`**, not the intended `2750 deploy:energetica`,
  because rsync resets the mode of the directory it syncs into. This is old. Apache's deny rules
  are what protect the data.

## Lessons for CD

- A deploy always runs `systemctl restart`, which starts a stopped Run and replays every missed
  tick. CD must know when a Run is meant to be stopped.
- Config migrations that are not backward compatible, like the `run` block, force a stop, edit and
  deploy in one window. These should become mechanical migrations that the new code applies.
- A vhost change needs root and cannot ride a `deploy`-user pipeline as it stands.
- Deploying several Runs in parallel would hit the startup-lock race until #1262 is fixed.
