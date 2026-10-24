# Loader lag limits: calibration analysis

2026-10-24. How to choose `data_sources.max_lag_days` automatically, tested
against the arrival history of every enabled nightly loader.

## What the alert measures

`lag = today − end of the period holding the loader's newest data point`
(`Loader.lagDays`). The alert fires when lag > `max_lag_days`, both in the
post-load check in `LoaderCollection.reload` and in the nightly Slack digest.

For a loader on a regular schedule, lag follows a sawtooth. It drops to the
publication delay when a release lands and climbs by one period until the
next release. For a monthly series published about 45 days after month end,
lag runs from about 45 to about 75 days and then resets.

## Data

- Local `uhero_db_dev`, which is a prod snapshot. Daily loaders all stop
  arriving on **2026-07-31**, so the analysis is "as of" 2026-08-01. Later
  arrivals are local work (the DOTAX rebuild on 10-14, weekly fixes on
  10-22). Loaders with points rewritten locally were excluded.
- 30,054 enabled nightly loaders. For each, I took the last 13 dates, and
  for each date its **arrival**: the `created_at` of its first vintage
  (`MIN(created_at)`; revisions add rows but leave this unchanged).
- A history counts as **clean** when consecutive arrivals among the last 5
  points are at least half a day apart. Bulk reloads and `clear_before_load`
  loaders fail this test.

| Nightly loaders                                  | n      |
| ------------------------------------------------ | ------ |
| last 5 points clean                              | 8,923  |
| not clean (points arrived together)              | 14,588 |
| rewritten locally after the snapshot             | 4,221  |
| fewer than 5 points                              | 1,428  |
| no points                                        | 894    |

Clean rate by loader type: api 78%, derived 69%, download 18%, file
(manual spreadsheets) 9%. Spreadsheet updates usually add several periods
at once.

## Candidate limits

With G = mean gap between the last 5 arrivals, and P = worst lag seen on
the day a new point arrived (each arrival vs. the previous point's period
end):

- **A**: G (the original proposal: the average wait between points)
- **B**: P
- **C**: 1.5 × P
- **D**: P + G
- **E**: P + G/2

**A measures a different thing than the alert.** G is the interval
*between* releases. The alert measures time since the *period ended*,
which also includes the publication delay. A monthly series published 45
days after month end has G ≈ 30 but never has lag below 45, so it would
alert permanently.

### Out-of-sample backtest

Each limit was calibrated on points 6–10 back and then replayed day by day
over the period in which the next 5 points arrived (5,427 loaders with 10
clean points). Every point in that window did eventually arrive, so each
alert there is a false alarm unless the delay was itself a problem.

| Method      | day        | week      | month        | quarter        | year           |
| ----------- | ---------- | --------- | ------------ | -------------- | -------------- |
| A: G        | 104/104    | 38/38     | 386/579      | 2683/2724      | 1922/1929      |
| B: P        | 18/104     | 4/38      | 381/579      | 1484/2724      | 1583/1929      |
| C: 1.5P     | 0/104      | 3/38      | 184/579      | 103/2724       | 7/1929         |
| **D: P+G**  | **0/104**  | **3/38**  | **116/579**  | **33/2724**    | **4/1929**     |
| E: P+G/2    | 18/104     | 3/38      | 140/579      | 335/2724       | 51/1929        |

(loaders that alerted at least once / loaders tested)

D is the best on every frequency. Its remaining alerts are mostly real
lapses, not jitter:

- They typically run a month or more past the limit (monthly: median 30
  days over, p25 30).
- Examples: `SH_*@MAU.M` / `VIS*@MAU.M` went from 2026-02 straight to
  2026-05, with Mar–Apr never loaded. `VDAY*@*.M` skipped May–Jul 2025.
  `KPPRV*@NBI.M` delivered Sep 2025 in Feb 2026. `PCOT@HON.M` stopped over
  the fall 2025 shutdown.
- By loader type, monthly alerts: api 7/86, download 2/17, file 57/243,
  derived 50/233. Quarterly and annual are near zero for every type except
  file.

E shows why the slack term has to be a full gap. With half a gap, a daily
series gets half a day of slack, so ordinary one-day jitter fires (18/104).

**Chosen: D, `ceil(P + G)`** (`Loader.suggestLagLimit`, now over up to 10
points; see below). In words: alert
once a release is a full cycle later than the latest it has been recently.
Typical limits for source loaders: daily 4 days, weekly 20, monthly 91
(p10–p90 37–138), quarterly 300, annual about 1,150.

Annual limits are loose: an annual series alerts about a year after a
missed release. That follows from one release per year. Tightening it would
reintroduce jitter alerts elsewhere, or would need a per-frequency rule.

### Firing on day one (as of 2026-08-01)

| Method D, clean loaders      | no new point > 1 year | late, < 2× limit | late, > 2× limit |
| ---------------------------- | --------------------- | ---------------- | ---------------- |
| api                          | 70                    | 4                | 17               |
| download                     | 37                    |                  |                  |
| file                         | 145                   | 129              | 22               |
| derived                      | 616                   | 152              | 13               |

- **No new point in over a year** (868 of the clean loaders that fire; 3,835 in the
  script's dry run, which covers every loader with data): discontinued
  series still reloading nightly. Most date from 2018 (`TGB*`/`TGR*` tax
  collections), plus the COVID case counts. Alerting on these every night
  is noise, so the script skips them and lists them for review (candidates
  to take off the nightly reload).
- **Late but recent**: these look like real silent failures. Examples:
  every `VDAY*@<island>.M` stuck at 2026-02 (data arrived Mar 31),
  `U1`–`U6@HI.Q` stuck at 2025 Q3, `EEDNS@US.M` (api) at April.

## Derived loaders

Derived loaders (arithmetic on other series) are 69% clean and backtest
well, but they repeat their source's alert. One stale `VDAY*` source also
lights up the `VADC*`, `VRLS*`, `VDAYUS*` and other series built on it.
Leaving them out keeps the digest to roughly one line per real problem,
but loses coverage where the source itself isn't clean or isn't on the
nightly reload.

## 5 points vs 10

The analysis above calibrates on 5 points. `Loader.suggestLagLimit` now
uses the newest run of **up to 10** points that arrived separately (a bulk
reload ends the run), still requiring at least 5.

Comparison on source loaders: calibrate on everything before the newest 5
points, then replay those 5 arrivals. An alert counts as **confirmed** when
the point that ended it came after a skipped period (e.g. Feb → May). That
is a strict lower bound, since a long delay with nothing skipped can also
be a real problem.

|      | week (n=44)  | month (n=655)            | quarter (n=527)        | year (n=293)          |
| ---- | ------------ | ------------------------ | ---------------------- | --------------------- |
| 5    | 14 fired     | 170: 85 confirmed        | 30: 26 confirmed       | 11: 4 confirmed       |
| 10   | 4 fired      | 317: **255 confirmed**   | 24: **24 confirmed**   | 11: 4 confirmed       |

(Skipped weeks weren't checked, so weekly alerts aren't classified.)

10 points catches three times as many confirmed monthly lapses, with fewer
unconfirmed alerts (62 vs 85). The reason: with 5 points, one recent
outlier (often the fall 2025 shutdown delay) sets the worst peak *and*
inflates the mean gap, which double-pads the limit. With 10 points, the
extra normal releases bring the gap back to about one period. Limits shift
slightly: monthly median 90 → 93 days, p10 36 → 66. Coverage is unchanged.

## Assignment

`scripts/set-loader-lag-limits.ts` computes the limit from whichever DB it
runs against. It is a dry run by default, assigns **source loaders only**
(`--include-derived` adds derived ones), and sets loaders that are already
behind, so they show up for review on the next run.

Dry run here, as of 2026-08-01, 10 points:

| Source loaders                    | n      |
| --------------------------------- | ------ |
| set                               | 2,099  |
| set, already late                 | 165    |
| skip: points arrived together     | 9,689  |
| skip: no new point in over a year | 2,428  |
| skip: fewer than 5 / no points    | 3,193  |
| skip: derived                     | 12,480 |

Most of the already-late loaders are DBEDT visitor statistics (`VDAY*`,
`VIS*`, `VEXP*` by island and market), all stuck at Feb 2026, which points
to one stalled source.

The prod run will give different numbers, because prod has three more
months of arrivals than this snapshot.

## Not covered

Loaders whose points arrive in batches (about 12k, mostly file and download
loaders) get no limit. A follow-up could measure cadence over distinct
arrival *events* (arrivals clustered within a day) instead of individual
points. That would cover spreadsheet loaders that add a quarter's worth of
months at once.
