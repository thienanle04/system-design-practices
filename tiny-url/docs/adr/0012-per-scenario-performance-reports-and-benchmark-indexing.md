# 0012: Per-Scenario Performance Reports and Benchmark Indexing

We isolate performance benchmark artifacts and execution histories into dedicated scenario subdirectories (`tests/load/reports/<scenario>/`) and establish a root executive dashboard (`Benchmark Master Index` in `tests/load/reports/README.md`) that tracks the latest snapshot across Baseline and Emulated WAN profiles.

## Status

Accepted

## Considered Options

- **Single Consolidated Log File (`history.md` at root)**: Rejected because appending every run from every disparate scenario (Read, Write, Negative Caching, Starvation, Pipeline Stress) into one flat table created an unmaintainable, noisy file where scenario trends could not be easily tracked, and cluttered `tests/load/reports/` with hundreds of flat HTML and JSON artifacts.
- **Flat Files with Scenario Prefixes**: Rejected because while separating tables into `history-<scenario>.md` solves the multi-table problem, it still leaves all generated `.html` and `.json` artifacts mixed in a single flat directory, complicating artifact archiving, discovery, and file management.
- **Subdirectory per Scenario with Benchmark Master Index (Selected)**:
  - **Scenario Benchmark History**: Each scenario owns its dedicated directory (`tests/load/reports/<scenario>/`) containing its immutable timestamped HTML reports, JSON metric payloads, and a scenario-specific `history.md` documenting historical runs across Baseline and WAN profiles.
  - **Automated Routing in k6 Runner**: `reporter.js` generates artifact paths targeting `/reports/${scenarioName}/${baseName}.html` and `.json`. `run.mjs` and `run-wan.mjs` ensure the target scenario directory exists prior to containerized k6 execution.
  - **Benchmark Master Index (`README.md`)**: The root directory contains `README.md` as an executive dashboard. `append-history.mjs` automatically updates each scenario's history and regenerates the Master Index table, displaying the latest snapshot for both `BASELINE` and `WAN` profiles alongside SLA status and direct links.

## Consequences

- Test artifacts and historical records are strictly isolated by architectural tier and scenario, enabling clean inspection of scenario-specific regressions over time.
- The root `tests/load/reports/README.md` provides an instant executive overview of system health and performance capabilities across both Baseline and Emulated WAN profiles.
- Seamless developer experience: running any load test (`npm run test:load:*` or `npm run test:load:wan:*`) automatically maintains both the scenario history and the master dashboard without manual intervention.
