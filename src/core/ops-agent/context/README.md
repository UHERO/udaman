# Ops agent context

Everything in this folder except this README becomes the agent's system
prompt, in this order: `system.md`, then `reference/`, `playbooks/`,
`examples/` (alphabetical within each). It's rebuilt at the start of every
run, so edits here take effect on the next run. No code changes are needed.

Writing guidance:

- **Write for a capable colleague who is new to UDAMAN.** Explain why a rule
  exists, not just the rule; the agent applies reasons to cases you didn't
  foresee.
- **Keep dates, ids and other volatile values out of these files.** The
  prompt is cached across items and runs, and anything that changes per run
  breaks the cache.
- **Examples teach the most.** A short real case (the symptom, what was
  checked, the fix, and why) beats a page of rules. Replace the placeholder
  ids in `examples/` with real ones as you collect cases.
- Sections marked `TODO(economists)` are starter text that should be
  replaced by whoever owns that convention.

Size: the whole folder is sent on every model call (cached). Keep it under
roughly 20k tokens; move rarely-needed detail into the repo's `docs/` and
point the agent at it (it can `read_file` docs).
