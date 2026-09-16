import { ExternalLink } from "lucide-react";

import { CopyBlock, H1, H2, Lead, P } from "@/components/typography";

/** Public MCP endpoint the connector is added with. */
export const MCP_CONNECTOR_URL = "https://udaman.uhero.hawaii.edu/api/mcp";
export const MCP_CONNECTOR_NAME = "UHERO Data";

const SETUP_STEPS: React.ReactNode[] = [,];

const PUBLIC_SITES = [
  {
    label: "uhero.hawaii.edu",
    href: "https://uhero.hawaii.edu",
    description: "UHERO's main site: research, forecasts, and publications.",
  },
  {
    label: "data.uhero.hawaii.edu",
    href: "https://data.uhero.hawaii.edu",
    description: "The UHERO Data Portal: browse and download the public data.",
  },
];

/**
 * Universe homepage for `mcp-only` accounts. They have no tools here; this
 * tells them what the account is for and how to connect it in Claude.
 */
export function McpOnlyWelcome() {
  return (
    <div className="flex flex-1 flex-col p-8">
      <H1 className="text-5xl">UHERO Data Connector</H1>
      <Lead className="mt-2 max-w-lg text-xl">
        This account is only authorized to use the UHERO Data Claude MCP
        connector.
      </Lead>

      <section className="mt-8 max-w-2xl">
        <H2 className="text-xl">Set up the connector in Claude</H2>
        <ol className="mt-4 list-decimal space-y-2 pl-6">
          <li>
            Go to <strong>Settings</strong> in your Claude account.
          </li>
          <li>
            Select <strong>Connectors</strong>.
          </li>
          <li>
            Select <strong>Add</strong>.
          </li>
          <li>
            Enter the name <strong>{MCP_CONNECTOR_NAME}</strong> and the MCP URL
            below.
            <CopyBlock text={MCP_CONNECTOR_URL}>{MCP_CONNECTOR_URL}</CopyBlock>
          </li>
          <li>
            Click <strong>Add</strong>, leave the defaults on the next screen,
            then select <strong>Connect</strong>. You will be asked to sign in
            here and allow the connection.
          </li>
        </ol>
        <P className="text-muted-foreground text-sm">
          Once connected, ask Claude about Hawaii economic data and it will pull
          series from UHERO&apos;s public API on your behalf.
        </P>
      </section>

      <section className="mt-8 max-w-2xl">
        <H2>UHERO on the web</H2>
        <ul className="mt-4 space-y-3">
          {PUBLIC_SITES.map((site) => (
            <li key={site.href}>
              <a
                href={site.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
              >
                {site.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
              <p className="text-muted-foreground text-sm">
                {site.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
