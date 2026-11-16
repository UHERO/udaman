/**
 * Read-only code tools for the agent, confined to the checkout (REPO_ROOT).
 * No writes, no general shell: git runs with a fixed subcommand allowlist.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import type Anthropic from "@anthropic-ai/sdk";

const MAX_OUTPUT = 30_000;
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "src/generated",
  "data-dir",
  "logs",
  "tmp",
]);

function clip(s: string): string {
  return s.length > MAX_OUTPUT
    ? `${s.slice(0, MAX_OUTPUT)}\n…[truncated ${s.length - MAX_OUTPUT} chars]`
    : s;
}

export class LocalTools {
  readonly root: string;
  constructor(root: string) {
    this.root = realpathSync(root);
  }

  /** Resolve a model-supplied path; reject anything outside the checkout. */
  private resolve(p: string): string {
    const target = path.resolve(this.root, p);
    const real = (() => {
      try {
        return realpathSync(target);
      } catch {
        return target;
      }
    })();
    const rel = path.relative(this.root, real);
    if (rel.startsWith("..") || path.isAbsolute(rel))
      throw new Error("path escapes the repository");
    if (/(^|\/)\.env/.test(rel)) throw new Error("env files are not readable");
    return real;
  }

  definitions(): Anthropic.Tool[] {
    return [
      {
        name: "read_file",
        description:
          "Read a file in the udaman repository (the code that is deployed). Optional 1-based line range.",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Repo-relative path, e.g. src/core/catalog/utils/eval-parser.ts",
            },
            start_line: { type: "integer" },
            end_line: { type: "integer" },
          },
          required: ["path"],
        },
      },
      {
        name: "grep",
        description:
          "Search the repository for a regular expression (git grep). Returns file:line:text matches.",
        input_schema: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            path: {
              type: "string",
              description: "Optional subdirectory to limit the search",
            },
            ignore_case: { type: "boolean" },
          },
          required: ["pattern"],
        },
      },
      {
        name: "list_files",
        description:
          "List files and directories under a repo path (one level).",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "git_log",
        description:
          "Recent commits, optionally for one path and since a date. Use to answer 'did our code change since this loader last worked?'",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            since: { type: "string", description: "e.g. 2026-10-01" },
            max_count: { type: "integer" },
          },
        },
      },
      {
        name: "git_show",
        description:
          "Show one commit's message and diff (optionally limited to a path).",
        input_schema: {
          type: "object",
          properties: { commit: { type: "string" }, path: { type: "string" } },
          required: ["commit"],
        },
      },
    ];
  }

  has(name: string): boolean {
    return ["read_file", "grep", "list_files", "git_log", "git_show"].includes(
      name,
    );
  }

  run(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case "read_file": {
        const file = this.resolve(String(input.path ?? ""));
        if (statSync(file).size > 2_000_000) throw new Error("file too large");
        const lines = readFileSync(file, "utf8").split("\n");
        const start = Math.max(1, Number(input.start_line ?? 1));
        const end = Math.min(
          lines.length,
          Number(input.end_line ?? start + 399),
        );
        return clip(
          lines
            .slice(start - 1, end)
            .map((l, i) => `${start + i}\t${l}`)
            .join("\n"),
        );
      }
      case "grep": {
        const args = ["grep", "-n", "-I", "-E", "--max-count=20"];
        if (input.ignore_case) args.push("-i");
        args.push("-e", String(input.pattern ?? ""));
        if (input.path)
          args.push(
            "--",
            path.relative(this.root, this.resolve(String(input.path))) || ".",
          );
        return clip(this.git(args) || "(no matches)");
      }
      case "list_files": {
        const dir = this.resolve(String(input.path ?? "."));
        const rel = path.relative(this.root, dir);
        return readdirSync(dir, { withFileTypes: true })
          .filter(
            (e) =>
              !SKIP_DIRS.has(e.name) &&
              !SKIP_DIRS.has(path.join(rel, e.name)) &&
              !e.name.startsWith(".env"),
          )
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .join("\n");
      }
      case "git_log": {
        const args = [
          "log",
          "--date=short",
          "--pretty=format:%h %ad %an %s",
          `--max-count=${Math.min(Number(input.max_count ?? 20), 50)}`,
        ];
        if (input.since)
          args.push(`--since=${String(input.since).replace(/[^0-9-]/g, "")}`);
        if (input.path)
          args.push(
            "--",
            path.relative(this.root, this.resolve(String(input.path))),
          );
        return clip(this.git(args) || "(no commits)");
      }
      case "git_show": {
        const commit = String(input.commit ?? "").replace(/[^0-9a-fA-F]/g, "");
        if (commit.length < 6)
          throw new Error("commit must be a hex sha (6+ chars)");
        const args = ["show", "--stat", "-p", commit];
        if (input.path)
          args.push(
            "--",
            path.relative(this.root, this.resolve(String(input.path))),
          );
        return clip(this.git(args));
      }
    }
    throw new Error(`unknown local tool ${name}`);
  }

  private git(args: string[]): string {
    const r = spawnSync("git", args, {
      cwd: this.root,
      encoding: "utf8",
      maxBuffer: 10_000_000,
      timeout: 20_000,
    });
    if (r.status !== 0 && r.status !== 1)
      throw new Error(r.stderr || `git exited ${r.status}`);
    return r.stdout;
  }

  headSha(): string | null {
    try {
      return this.git(["rev-parse", "HEAD"]).trim() || null;
    } catch {
      return null;
    }
  }
}
