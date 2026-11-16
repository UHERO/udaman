# Playbook: failed reload jobs

A reload job is a person's request on the investigations page to reload a set of series; `reload_job_failed` means one failed in the last 7 days and no later job reloaded the same series successfully.

- The job error is often a summary. The loaders' own errors (`get_loader` per series loader, or the `load_error` issues for the same loaders) usually say more; if those exist, the reload job is a symptom, and fixing the loaders fixes it.
- `get_app_logs` with category `worker` shows the job's result and error text (first 500 characters).
- A job that failed because of the worker (lock timeout, restart, out of memory) rather than any loader is temporary: say so in a diagnosis; a person can re-run it from the investigations page. You can't re-run reload jobs.
