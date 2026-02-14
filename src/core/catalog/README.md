# Catalog

Name pending. This represents the core management features of udaman. Other features like Data scraping, Uploads, Exports, will be moved to other packages.

## Collections

Handles db interactions, queries, and instantiating models.

```js
const results = SeriesCollection.search(term);
const simpleSeries = SeriesCollection.find(id);
const bigSeries = SeriesCollection.findWithRelations(id);
```

## Controllers

Behaviors, actions, or workflows used by other modules or server actions. Consumes Collection and Model code, handles regular logging, and telemetry. The barrier between core logic and frontend or workers.

```js
const res = createSeries(payload);
const res = deleteSeries(payload);
```

## Models

Actions and properties related to a given database entity or table record.

```js
const freq = series.frequency;
const { name, geo } = series.nameParts;
const sum = seriesA.sum(seriesB); // just an idea
```

## Types

For TS definitions shared relating to udaman catalog entities and features.

## Utils

For general purpose catalog functions that don't belong to any given model, and aren't used outside this module.

# Structure

## xseries

Claude's explanation of how series and xseries interact. I've renamed xseries to TimeSeries, because xseries is a very unhelpful name.

xseries is the parent. Multiple series rows can belong to one xseries. The structure is:

xseries (1)
├── series A ← primary (xseries.primary_series_id = A.id)
├── series B ← alias  
 └── series C ← alias

- xseries holds the data-level metadata: frequency, seasonal adjustment, base year, factors, restricted/quarantined flags. It also owns the data_points (has_many :data_points). All series sharing an xseries share the same underlying data.
- series holds the catalog/presentation metadata: name, universe, geography, unit, source, description, decimals. Every series has exactly one xseries_id FK.
- Primary series: The one series row that the xseries points back to via xseries.primary_series_id. A series is primary when xseries.primary_series_id === self.id. There's exactly one primary per xseries.
- Aliases: Any non-primary series under the same xseries. They're created via create_alias — same xseries (same data), but different universe/geography/name. This is how the same economic data appears in multiple universes (e.g. UHERO and DBEDT) without duplicating data points.
- Constraint: @@unique([universe, xseries_id]) — each xseries can have at most one series per universe.

So in practice, a typical xseries has 1 primary series and 0-3 aliases in other universes, all sharing the same data_points rows (joined via xseries_id). The delegate_missing_to :xseries in the Rails model means that series transparently exposes xseries properties (frequency, seasonal_adjustment, etc.)
as if they were its own.

    ---

How Series and TimeSeries relate in practice

┌─────────────────────────────────────┐  
 │ TimeSeries (xseries) │ Owns: data_points, frequency,  
 │ id: 5001 │ SA, base_year, factors, etc.
│ frequency: "month" │  
 │ seasonal_adjustment: "not_sa" │
│ primary_series_id: 42 |  
 └──────────┬──────────────────────────┘  
 │ has many
┌──────┴──────────────┐
│ │
┌───┴────┐ ┌────┴───┐
│Series │ │Series │ Aliases: same data,
│id: 42 │ primary │id: 99 │ different universe/geo
│UHERO │ │DBEDT │
│E_NF@HI │ │E_NF@HI │
└────────┘ └────────┘

The query direction is almost always: start from Series, join TimeSeries.

Work with Series / SeriesCollection. The Series model already has all the TimeSeries properties (frequency, SA, etc.) flattened onto it. TimeSeriesCollection is the escape hatch for when you need to read or write the underlying xseries record directly — mostly during create, delete, and metadata updates.
