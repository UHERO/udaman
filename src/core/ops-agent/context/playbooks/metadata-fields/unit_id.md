# Field: unit_id

- The source's own table usually states units (persons, thousands of persons, dollars, percent, index 1982-84=100). Scale matters: a loader with `scale` 1000 or `* 1000` in its eval changes the unit.
- Series in a measurement usually share units, but not across transformations (a growth rate isn't in the same unit as the level). A measurement that mixes them gets no unit of its own; set it per series.

TODO(economists): the units rules reviewers apply (which `units` rows to prefer, how to treat scaled series, percent vs percentage points).
