# Udaman

Next.js application for managing, ingesting, and transforming economic time series data. Serves three subdomains from one deployment: `udaman` (admin/editorial tool), `data` (public data portal), and `analytics`. The `[universe]` route segment (UHERO, DBEDT, FC, NTA, COH, CCOM) provides multi-tenant data isolation.

## Architecture

```
Page (RSC) → Server Action (src/actions/) → Controller → Collection → MySQL
                                                ↑
                                          Model (instantiated
                                          by Collection, holds
                                          business logic)
```

- **Server Actions** (`src/actions/`): `"use server"` functions. Thin wrappers that call controllers & serialize data. These are what Next.js pages and components invoke.
- **Controllers** (`src/core/catalog/controllers/`): Orchestrate use cases by calling one or more collections, add logging. No direct DB access.
- **Collections** (`src/core/catalog/collections/`): Static classes that own all database queries. Use Bun's tagged template SQL (`mysql\`SELECT ...\``). Return model instances.
- **Models** (`src/core/catalog/models/`): Plain TypeScript classes. Accept snake_case DB row attrs in constructor, expose camelCase properties. Hold business logic (validation, parsing, computed properties). Models never call the DB.
- **Types** (`src/core/catalog/types/`): Shared TypeScript types. `shared.ts` has core types like `Universe`, `Frequency`, `SeriesMetadata`, `SourceMapNode`.

### Key path aliases (tsconfig)

- `@/` → `src/`
- `@catalog/` → `src/core/catalog/`
- `@database/mysql` → `src/lib/mysql/db.ts`

### Database

MySQL/MariaDB accessed via **Bun SQL** (not Prisma for queries). Prisma is used only for schema introspection and db migrations. The schema lives at `src/lib/prisma/schema.prisma`.

Helper `buildUpdateObject` in `src/lib/mysql/helpers.ts` converts camelCase keys to snake_case columns and booleans to 0/1.

## Porting from Rails

The original app is a Rails application. Reference Rails code (models, controllers, helpers, jobs, workers) lives in `tmp/`. We are porting this logic into the TypeScript codebase following the Model/Collection/Controller pattern.

### Process for porting a Rails model

1. **Read the Rails model** in `tmp/models/` to understand columns, validations, callbacks, and business logic methods.
2. **Create the Model** (`src/core/catalog/models/<name>.ts`):
   - Define a `<Name>Attrs` type mapping 1:1 to DB columns (snake_case, all optional except `id`).
   - Create a class that accepts `Attrs` in the constructor and exposes camelCase properties.
   - Move business logic (computed properties, parsing, validation) into instance methods or static helpers.
   - Include `toString()` and `toJSON()` methods.
3. **Create the Collection** (`src/core/catalog/collections/<name>-collection.ts`):
   - Static class with CRUD methods: `list()`, `getById()`, `create()`, `update()`, `delete()`.
   - All methods return model instances (not raw rows).
   - Define `Create<Name>Payload` and `Update<Name>Payload` types here or in types/.
   - Use `buildUpdateObject` for updates.
4. **Create/update the Controller** (`src/core/catalog/controllers/<name>.ts`): Wire up the collection calls with logging.
5. **Create/update Server Actions** (`src/actions/<name>.ts`): `"use server"` wrappers around controllers.

### Naming conventions

- Rails `data_sources` table → TypeScript `Loader` model + `LoaderCollection` (renamed to avoid confusion with `Source`/`SourceDetail`)
- DB table names stay as-is (snake_case in SQL queries)
- Model class names are singular PascalCase: `Measurement`, `Loader`, `Series`
- Collection class names: `MeasurementCollection`, `LoaderCollection`
- File names are kebab-case: `loader-collection.ts`, `source-detail.ts`

### Porting status

Ported models (have both model + collection): `category`, `data-list`, `geography`, `loader` (was `data_source`), `measurement`, `series`, `source`, `source-detail`, `unit`, `universe`

Not yet ported (exist in Rails `tmp/models/` but not yet in TS): `data_point` (partial — has a model but no collection), `data_source_action`, `data_source_download`, `download`, `export`, `forecast_snapshot`, `geo_tree`, `reload_job`, `user`, `xseries`, and others.

## UI Stack

- shadcn/ui components in `src/components/ui/`
- Tailwind CSS v4
- TanStack Table for data tables
- React Hook Form + Zod for forms
- Recharts for charts
- Lucide icons
