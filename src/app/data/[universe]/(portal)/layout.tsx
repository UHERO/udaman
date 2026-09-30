import { PortalChrome } from "../views/portal-chrome";

/** Portal chrome for /data/<universe>/… (UHERO: src/app/data/(uhero)). */
export default function PortalChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalChrome>{children}</PortalChrome>;
}
