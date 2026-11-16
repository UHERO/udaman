# Playbook: missing metadata (fill at the right level)

A missing-metadata issue is one measurement and one field (`source_id`, `unit_id` or `dataPortalName`; other fields only if they have been switched on): at least one series in the measurement has no value of its own and the measurement has none to fall back on. Only measurements in a data list are checked, so every one of these is visible on the portal. A measurement's missing fields arrive together as one work item.

The portal shows a series' own value first and the measurement's second. So there are two places a value can go, and choosing the right one is most of the job.

1. `get_measurement`: the measurement's own values, and every series in it with that series' values. Note which series have the field and which don't.
2. Decide the level:
   - **Every series that has a value agrees, and the empty ones are the same measure** (other geographies or frequencies of it): set the value on the **measurement** (`measurement_metadata`, `basis: "measurement_series"`). One value then covers them all, including series added later.
   - **The series legitimately differ**: seasonally adjusted and unadjusted series in one measurement, series from different agencies, a level next to a rate or share. Set values on the **individual series** that lack one (`series_metadata`), each with the value that fits it, and leave the measurement empty. Say in the evidence why they differ.
   - **The series disagree and you can't tell why**: ask. One of them may simply be wrong, and that's a person's call.
   - **No series has a value**: this is research. Use the field's playbook under `metadata-fields/`, then set it on the measurement if the series are the same measure (`basis: "research"`).
3. Never change a value that is already set, on a series or a measurement, to make things uniform. If an existing value looks wrong, say so in a question or a finding.
4. Values for `source_id`, `source_detail_id` and `unit_id` are ids of existing rows. Find them with `list_lookup`. Don't invent sources or units; if none fits, ask.
5. One proposal per kind: a `measurement_metadata` proposal can set several fields on the measurement (one target per field, each with its issue's id), and a `series_metadata` proposal can carry many series. If a measurement needs both, make the measurement proposal first.
6. The evidence names where each value came from: the series ids that already carry it, or the URLs you read.

Keep research proportionate. A field that needs more than a few searches to settle is a good candidate for a question instead.

TODO(economists): other cases where series in one measurement should differ, and measurements known to mix sources on purpose.
