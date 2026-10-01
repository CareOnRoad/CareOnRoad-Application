# Recovery Phase 0 — Baseline record

## Scope

This record closes Phase 0 of `DEPENDENCY-WORKSPACE-RECOVERY-PLAN.md` only. It makes no source, dependency, lockfile, Metro, NativeWind, framework, database, seed, migration, or environment-variable change.

## Immutable code baseline

| Item | Recorded value |
|---|---|
| Repository | `D:\fpt\subject\EXE101\CareOnRoad-mobile-break` |
| Branch | `mono/mobile/break` tracking `origin/mono/mobile/break` |
| Baseline commit | `0d178c1ac444a604b622a5574047676cc828cdec` |
| Baseline subject | `backup mobile-break` |
| Baseline author date | `2026-09-16T00:44:45+07:00` |
| Node.js observed | `v24.19.0` |
| pnpm observed | `11.22.0` |
| Git observed | `2.54.0.windows.1` |

## Working-tree assessment at Phase 0 start

There are no modified or staged tracked files. The only untracked file is the user-requested analysis artifact:

- `DEPENDENCY-WORKSPACE-RECOVERY-PLAN.md`

This means the product source baseline is clean, while the Git working tree is not strictly empty because of an intentional documentation artifact. This file and the present baseline record are the only allowed Phase 0 documentation changes. They must remain visible in `git status` and be reviewed explicitly before any commit.

## Safety boundary applied

- No command was run against `D:\fpt\subject\EXE101\CareOnRoad-Application`.
- No seed, database migration, production credential, deployment, dependency install, or framework-upgrade command was run in the source repository.
- Phase 0 does not alter the baseline commit or create a branch/commit automatically.

## Gate decision

Phase 0 is complete with one documented documentation-only exception to a literally empty working tree. It is safe to continue to Phase 1 because there are no unreviewed source/configuration changes. Before merging any recovery work, review the full diff against `0d178c1` and require the Phase 1 clean-install gates defined in the recovery plan.
