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