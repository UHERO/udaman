export default function AboutText() {
  return (
    <div className="pb-10 text-gray-700">
      <h5 className="text-center text-2xl font-semibold uppercase text-dvw">
        {peripheralTxt.title}
      </h5>
      <p>{peripheralTxt.header}</p>
      {Object.entries(defMap).map(([key, val], i) => (
        <div className="my-2" key={`map-${i}`}>
          <span className="font-bold text-gray-700">{key}: </span>
          <span className="text-gray-600">{val}</span>
        </div>
      ))}
      <p>{peripheralTxt.footer}</p>
    </div>
  );
}

const defMap: Record<string, string> = {
  "Visitor Trends":
    "this section provides data on the number of visitors, days, expenditure, length of stay, daily census, and per person per day spending by market and by island for monthly, quarterly, and annually. Data availability varies by indicator, market and island.",
  "Visitor Characteristics":
    "section gives a basic profile of Hawaii’s visitors. The profile is available by group defined by where they came from, which island they visited, accommodation choice, purpose and type of their visit, and if they’ve visited Hawaii before. The dataset allows data users to compare the profile of a certain group of visitors with other groups of visitors.",
  "Air Seats to Hawaii":
    "this section shows the count of air seats to Hawaii’s commercial airports on Oahu, Hawaii Island, Maui, and Kauai. Data are available for monthly, quarterly, and annually for scheduled flights and charter flights by departing region or country.",
  "Expenditure Patterns":
    "this section shows the count of air seats to Hawaii’s commercial airports on Oahu, Hawaii Island, Maui, and Kauai. Data are available for monthly, quarterly, and annually for scheduled flights and charter flights by departing region or country.",
  "Hotel Performance":
    "this section tracks hotel occupancy, the average daily rate, and revenue per available room. Where available, data can be viewed by island area or hotel type.",
};

export const peripheralTxt = {
  main_title: "Tourism Data Warehouse",
  title: "About Tourism Data Warehouse",
  subtitle: "Browse data by the following categories",
  header:
    "The Tourism Data Warehouse lets you customize and download datasets about Hawaii’s tourism industry, with many of them updated monthly.",
  footer: (
    <>
      We invite your input on this tool. Please email your feedback to{" "}
      <a
        href="mailto:dbedt.research@hawaii.gov"
        className="text-blue-600 underline"
      >
        dbedt.research@hawaii.gov
      </a>{" "}
      or call (808) 586-2473.
    </>
  ),
};
