# Example: the bug is ours (placeholder case)

> Illustrative, based on a real past bug (a `share_using` parse problem). Replace with a current case when one comes up.

**Issue:** `share_using("A@HI.A".ts.trim, "B@HI.A".ts.trim)` loaders fail with `share_using expects 2 arguments, got 1`.

**Investigation:** the statement is valid in the Rails syntax. `read_file` on `src/core/catalog/utils/eval-parser.ts`: a paren-less method call (`.ts.trim`) consumes the following comma as part of its own argument list, so the second argument is parsed as an argument to `.trim`.

**Action:** `raise_issue` subject_type `code`: title "eval parser: paren-less call swallows the enclosing argument list's comma", body with the file:line, the minimal failing statement, and the expected parse. Then a diagnosis comment on the load-error issue linking the finding. No load-statement proposal: rewriting the economists' statements to dodge our bug would hide it.
