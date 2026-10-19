import type { Category } from "../lib/categories";

const FOOTNOTES: Record<Category["footnotes"][number], React.ReactNode> = {
  affordability: (
    <>
      Housing affordability index: see UHERO&rsquo;s{" "}
      <a
        href="https://uhero.hawaii.edu/"
        target="_blank"
        rel="noreferrer"
        className="text-(--portal-primary) underline"
      >
        real estate indicators
      </a>
      . The construction cost index is for Honolulu.
    </>
  ),
  budget: (
    <>
      Revenues and expenditures may not sum to the totals because some
      categories are omitted. County budget data currently end in fiscal year
      2020.
    </>
  ),
};

/** Notes, data sources, and credits under the dashboard. */
export function KauaiFooter({ category }: { category: Category }) {
  return (
    <footer className="text-muted-foreground mt-6 space-y-3 border-t border-neutral-300 pt-4 text-xs leading-relaxed">
      <ul className="space-y-1">
        <li>
          Changes compare each period with the same period a year earlier. For
          rates (such as the unemployment rate) the change is in percentage
          points. &ldquo;YTD chg&rdquo; compares the year to date with the same
          months of the previous year.
        </li>
        {category.footnotes.map((k) => (
          <li key={k}>{FOOTNOTES[k]}</li>
        ))}
      </ul>
      <p>
        <span className="text-foreground font-medium">Data sources: </span>
        {category.sources.map((s, i) => (
          <span key={s.href}>
            {i > 0 && ", "}
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="text-(--portal-primary) hover:underline"
            >
              {s.label}
            </a>
          </span>
        ))}
        . Compiled by the{" "}
        <a
          href="https://uhero.hawaii.edu/"
          target="_blank"
          rel="noreferrer"
          className="text-(--portal-primary) hover:underline"
        >
          University of Hawaiʻi Economic Research Organization (UHERO)
        </a>
        .
      </p>
      <p>
        Original dashboard design by Adele Balderston, Ben Trevino, Jonathan
        Page, and Diliaur Tellei.
      </p>
    </footer>
  );
}
