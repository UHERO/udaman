import { PortalChrome } from "../../[universe]/views/portal-chrome";

/** Portal chrome for the UHERO root routes (everything except /data/graph). */
export default function UheroPortalChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalChrome>{children}</PortalChrome>;
}
