# Newcastle EPC Building Explorer

A city-scale platform for exploring Energy Performance Certificate (EPC) data
for Newcastle upon Tyne, built in partnership with Newcastle City Council.
The platform ingests live data from the UK government's Energy Certificate
Data API, matches each record to real building geometry, and presents it
through an interactive 3D map — a public viewer for residents and
researchers, and an administrative console for data validation.

Developed by Northumbria University.

## Demo

<!--
  Replace this block once you have a recording. Two ways to add one:

  1. GitHub-hosted (recommended, plays inline): open this file in the
     GitHub web editor and drag your video file directly into the edit
     box. GitHub uploads it and inserts a working
     https://github.com/<org>/<repo>/assets/... link automatically —
     paste that link in place of the placeholder below.

  2. External host (YouTube/Loom/etc.): use a clickable thumbnail image
     linking to the video, e.g.:
     [![Watch the demo](docs/demo-thumbnail.png)](https://youtu.be/VIDEO_ID)

  A good demo covers, in order: (1) the public viewer's 3D map with
  buildings coloured by EPC band, (2) using the filters — band chips,
  property type, floor area, issued-within date, (3) clicking a coloured
  building to open its detail panel, (4) asking EPC buddy a question
  about that building, (5) the admin console: the map coloured by
  validation status, and verifying/flagging a building from the review
  panel.
-->



https://github.com/user-attachments/assets/db58084d-f1ae-4120-851c-13780c13b662





## Architecture

- **Frontend**: React + Vite, with CesiumJS (OpenStreetMap Buildings via
  OGC 3D Tiles) for 3D visualisation
- **Backend**: Express + TypeScript REST API
- **Database**: PostgreSQL + PostGIS
- **ETL**: a scheduled pipeline pulling from the UK government's EPC
  register, matching each record to real building geometry via a two-tier
  process (UPRN tag match, falling back to geocoded nearest-neighbour
  matching), and an AI assistant (Claude) scoped to a single selected
  building's own data

See `api/src/etl/` for the data pipeline and `api/README.md` for setup
details specific to obtaining EPC API access.

## Running locally

```bash
cp api/.env.example api/.env   # fill in ANTHROPIC_API_KEY, JWT_SECRET, EPC_API_KEY
cp web/.env.example web/.env   # fill in VITE_CESIUM_ION_TOKEN
docker compose up --build
```

In a second terminal, once containers are up, create an admin account:

```bash
docker compose exec api npx tsx src/etl/createAdminUser.ts you@example.com yourpassword administrator
```

- Public viewer: http://localhost:5173
- Admin console: http://localhost:5173/admin/login

To load real data, run the ETL pipeline once the containers are running:

```bash
docker compose exec api npm run etl
```

This defaults to a 10-year pull (matching EPC validity). For a quick,
bounded test run instead:

```bash
docker compose exec api sh -c "ETL_LOOKBACK_DAYS=14 npm run etl"
```

## Tests

```bash
cd api && npm install && npm test   # requires a real PostGIS test database
cd web && npm install && npm test
```

See `api/vitest.config.ts` for the expected `TEST_DATABASE_URL`.

## License

MIT — see `LICENSE`.
