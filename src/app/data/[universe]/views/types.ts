/** Resolved `searchParams` of a portal page (Next passes a Promise). */
export type PortalSearchParams = Record<string, string | string[] | undefined>;

/** Props of the shared page views (see views/*.tsx). */
export interface PortalPageProps {
  /** Canonical universe slug ("uhero" for the root routes). */
  universe: string;
  searchParams: PortalSearchParams;
}
