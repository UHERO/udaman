/**
 * Connection from the runner (workstation) to the ops MCP on the Next
 * server. Authenticated with the agent's service token (OPS_MCP_TOKEN).
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface OpsMcp {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
  /** Call a tool; returns its parsed JSON payload, or throws on a tool error. */
  call<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>;
  /** Call a tool for the model: raw text, plus whether it was an error. */
  callRaw(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ text: string; isError: boolean }>;
  close(): Promise<void>;
}

export async function connectOpsMcp(
  url: string,
  token: string,
): Promise<OpsMcp> {
  const client = new Client({ name: "udaman-ops-agent", version: "0.1.0" });
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
