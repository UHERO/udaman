/**
 * The runner's connections to the Next server (workstation → server),
 * all authenticated with the agent's service token:
 *
 *   two MCP servers, whose tools the model sees
 *     catalog  /api/mcp/catalog   read, test and propose changes to data
 *     ops      /api/mcp/ops       issues and the review queue
 *   the runner API, which only the harness calls
 *     /api/ops-runner/<action>    start, work, budget, log, finish
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpConnection {
  tools: McpTool[];
  /** Call a tool; returns its parsed JSON payload, or throws on a tool error. */
  call<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>;
  /** Call a tool for the model: raw text, plus whether it was an error. */
  callRaw(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ text: string; isError: boolean }>;
  close(): Promise<void>;
}

async function connectMcp(url: string, token: string): Promise<McpConnection> {
  const client = new Client({ name: "udaman-ops-agent", version: "0.2.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  const listed = await client.listTools();

  const callRaw = async (name: string, args: Record<string, unknown>) => {
    const res = await client.callTool({ name, arguments: args });
    const content = (res.content ?? []) as Array<{
      type: string;
      text?: string;
    }>;
    const text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    return { text, isError: Boolean(res.isError) };
  };

  return {
    tools: listed.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    })),
    callRaw,
    async call<T>(name: string, args: Record<string, unknown> = {}) {
      const { text, isError } = await callRaw(name, args);
      if (isError) throw new Error(`${name}: ${text}`);
      return JSON.parse(text) as T;
    },
    async close() {
      await client.close().catch(() => {});
    },
  };
}

/**
 * Both MCP servers as one tool set. Tool names are unique across the two;
 * a clash would be a server bug, so it fails loudly here.
 */
export async function connectAgentMcp(
  serverUrl: string,
  token: string,
): Promise<McpConnection> {
  const base = serverUrl.replace(/\/+$/, "");
  const servers = await Promise.all([
    connectMcp(`${base}/api/mcp/catalog`, token),
    connectMcp(`${base}/api/mcp/ops`, token),
  ]);
  const owner = new Map<string, McpConnection>();
  for (const s of servers)
    for (const t of s.tools) {
      if (owner.has(t.name))
        throw new Error(`Tool ${t.name} is on both MCP servers`);
      owner.set(t.name, s);
    }
  const route = (name: string) => {
    const s = owner.get(name);
    if (!s) throw new Error(`No such tool: ${name}`);
    return s;
  };
  return {
    tools: servers.flatMap((s) => s.tools),
    call: (name, args) => route(name).call(name, args),
    callRaw: (name, args) => route(name).callRaw(name, args),
    async close() {
      await Promise.all(servers.map((s) => s.close()));
    },
  };
}

/** The harness's own bookkeeping calls. The model never sees these. */
export interface RunnerApi {
  call<T = unknown>(
    action: "start" | "work" | "budget" | "log" | "finish",
    body?: Record<string, unknown>,
  ): Promise<T>;
}

export function runnerApi(serverUrl: string, token: string): RunnerApi {
  const base = `${serverUrl.replace(/\/+$/, "")}/api/ops-runner`;
  return {
    async call<T>(action: string, body: Record<string, unknown> = {}) {
      const res = await fetch(`${base}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      if (!res.ok)
        throw new Error(
          `runner ${action}: HTTP ${res.status} ${text.slice(0, 300)}`,
        );
      return JSON.parse(text) as T;
    },
  };
}
