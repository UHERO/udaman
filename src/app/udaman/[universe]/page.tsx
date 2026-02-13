import { H1 } from "@/components/typography";

const universeInfo: Record<
  string,
  { name: string; description: string; portalUrl: string | null }
> = {
  UHERO: {
    name: "Preview UHERO Data Portal",
    description:
      "This universe holds series related to the UHERO Data Portal and other of internal projects. Preview the data portal below.",
    portalUrl: "https://data.uhero.hawaii.edu",
  },
  NTA: {
    name: "National Transfer Accounts",
    description:
      "This universe holds series used by the NTA dashboard, data.uhero.hawaii.edu/nta. Andrew Mason is the primary point of contact for this project. Preview the data portal below.",
    portalUrl: "https://data.uhero.hawaii.edu/nta",
  },
  CCOM: {
    name: "Chamber of Commerce",
    description:
      "This universe holds series related to the Hawaii Chamber of Commerce. Preview the data portal below.",
    portalUrl: "https://data.uhero.hawaii.edu/ccom",
  },
  DBEDT: {
    name: "Department of Business, Economic Development & Tourism",
    description:
      "This Universe holds series generated via the DBEDT & DVW upload process. Series are derived from monthly uploads made by Paul at DBEDT. Preview the data portal below.",
    portalUrl: "https://data.uhero.hawaii.edu/dbedt",
  },
  FC: {
    name: "Forecast",
    description:
      "This Universe holds series related to the Forecast team, it appear to have been abandoned. Discuss with Peter.",
    portalUrl: null,
  },
  COH: {
    name: "County of Hawaii",
    description:
      "Contract with the County of Hawaii has been terminated. Universe marked for obliteration.",
    portalUrl: null,
  },
};

export default async function UniversePage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const key = universe.toUpperCase();
  const info = universeInfo[key] ?? {
    name: universe,
    description: "",
    portalUrl: null,
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="p-8">
        <H1>{universe}</H1>
        <p className="text-foreground text-lg">{info.description}</p>
      </div>
      {info.portalUrl ? (
        <div className="h-full w-full p-4">
          <div className="bg-muted h-full w-full flex-1 rounded p-6">
            <iframe
              src={info.portalUrl}
              className="h-full w-full border-1 shadow"
              title={`${universe} Data Portal`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
