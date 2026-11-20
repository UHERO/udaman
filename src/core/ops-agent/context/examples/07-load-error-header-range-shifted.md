# Example: header found, but outside the row range (real case)

**Issue:** the loader for `VADMCNOLNS@HI.M` (domestic visitors staying in condos only) fails with `Cannot find header "Condo only" in handle TOUR_%b%y@hawaiitourismauthority.org`. The statement:

```
Series.load_from_download("TOUR_%b%y@hawaiitourismauthority.org", {:file_type=>"xls", :start_date=>"2016-01-01", :sheet=>"HL", :row=>"header_range:col:1:Condo only:99:154", :col=>2, :frequency=>"M"})
```

**Reading the pattern:** `header_range:col:1:Condo only:99:154` means: search column 1 (A), rows 99 through 154, for a cell equal to "Condo only" (case and surrounding whitespace ignored). The first match gives the row. A plain `header:` pattern would search the whole column. A range means the label appears more than once on the sheet and the economist wanted one particular occurrence.

**Investigation:** the label was still in the file, at two places in column A on the HL sheet: row 56 (ACCOMMODATIONS block of the top, all-visitor section) and row 169 (the same block in the domestic passengers section). The series is the domestic figure (`DM` in the name), so it wants row 169. HTA had added rows above that section and pushed it past the old end bound of 154. The label text, sheet name and column were unchanged.

**Fix (approved):** extend the end of the range so it covers the domestic row's new position. The start bound stays at 99, which keeps out the top section's row 56. `file_type` was also corrected to `xlsx` to match the current files:

```
Series.load_from_download("TOUR_%b%y@hawaiitourismauthority.org", {:file_type=>"xlsx", :start_date=>"2016-01-01", :sheet=>"HL", :row=>"header_range:col:1:Condo only:99:171", :col=>2, :frequency=>"M"})
```

Widening (instead of replacing the range with something like `165:171`) also keeps older files working, where the row sat inside 99–154. Don't drop the range and don't switch to `header:`, because the first "Condo only" in the column is the wrong section.

**What to check before proposing a fix like this:**
- Which section the series reads. Use its name and description, and never assume the first match is the right one.
- That the new range still contains only one occurrence of the label in every file layout, old and new.
- History. One statement reads every monthly file back to `start_date`. `dry_run_loader` with the new statement must show the old months unchanged. If no single range picks out the right occurrence in both layouts, propose ending the current loader where the layout changed and adding a second loader with the new range from that month on.
- That the dry run's newest values match the file's numbers for that row.

**Why this was right:** the failure was a layout shift in the source file, not a code bug or a missing release. The smallest correct change was one range bound. The dry run is what shows the range picks the right section and leaves history alone.
