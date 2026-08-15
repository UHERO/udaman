1. run migrations, To-do on your side: run the two migrations (2026-08-14-drop-accessory-structures.sql, 2026-08-14-dead-column-fixes.sql) on local and remote, and the planned full re-parse will backfill everything (Kauai especially: usage, non-taxable, alt addresses, historical tax).

2. `qpub parcel-list --execute --add-new` and `repair --execute` reported real work but wrote nothing.

Confirmed **same server, same database** — canoes and my session both reach `srv=UHEROnas`, `db=hawaii_housing_database`, 600,380 rows. So it is not two databases. The table is untouched: `in_parcel_list` stamped on 0 rows, `parcel_list_version` null, no `repair:`/`enqueued:` strings in `error`, `max(no_results_at)` still 2026-08-13 08:37:54. Not a lock artifact — InnoDB readers don't block on writers. `rawQuery` has no read-only guard and rethrows, so a failed write would have thrown rather than silently no-op'd.

One difference stands out: canoes connects as **`hhdb`**, my session as **`uhero`**. `uhero` has `SELECT, INSERT, UPDATE, DELETE ON hawaii_housing_database.*`. If `hhdb` is SELECT-only, every write in both commands raised error 1142 and the CLI died right after printing its report block — which is exactly where the pasted output stops, since the report prints *before* the `if (!execute)` branch and before any write.

Two things to run on canoes:

```bash
# a) what can the hhdb user actually do? SHOW GRANTS only reports the connected user.
bun -e '
const { rawQuery } = await import("./src/lib/mysql/hhdb");
console.log(await rawQuery("SHOW GRANTS"));
process.exit(0);'
```

```bash
# b) re-run and keep stderr — the stack trace is the answer if privileges are fine
bun qpub parcel-list --execute --add-new > /tmp/pl.out 2> /tmp/pl.err; echo "exit=$?"; tail -30 /tmp/pl.err
```

Expect the run to end with `Parcel list 2026-8: N marked in-list, ...`. If that line never prints, the process died mid-write and `/tmp/pl.err` says why.

Settle this before `condo-units --execute` — it writes through the same path and would fail the same way.
