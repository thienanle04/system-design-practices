# 0008: Recharts for Real-Time and Historical Analytics Visualization

We adopt **Recharts** as the declarative charting library in `@tiny-url/web` for both continuous real-time telemetry (Click Velocity) and historical time-series analytics (Daily Click Events), coupled with ranked progress indicators for categorical distributions (Browsers, Operating Systems, Devices).

## Status

Accepted

## Considered Options

- **Pure Hand-Crafted SVG / HTML Divs**: Hand-calculating Bezier curves, tick coordinates, and responsive viewports in React state. While zero-dependency, this approach creates brittle math code, complicates tooltip hit-testing, and results in crude progress-bar visualizations for analytical reports.
- **Canvas / WebGL-Based Frameworks (Chart.js / ECharts)**: High performance for tens of thousands of data points, but non-declarative imperative APIs that fight React state management, require custom responsive canvas lifecycles, and complicate Tailwind dark-theme synchronization.
- **Declarative React SVG with Recharts**: Native React component composability (`<ResponsiveContainer>`, `<AreaChart>`, `<BarChart>`, `<XAxis>`, `<Tooltip>`), rendering standard DOM SVG elements styled directly via Tailwind color palettes.

## Consequences

- **Real-Time 1Hz Sliding Window**: For the 60-second Click Velocity monitor receiving SSE events every second, animation transitions are disabled (`isAnimationActive={false}`). This guarantees immediate rendering at 1Hz without animation frame stacking or visual jitter.
- **Historical Analytics Interactivity**: Daily Click Events render as vertical bars with Cartesian grids and interactive hover tooltips displaying exact timestamps and event counts.
- **Categorical Breakdown Structure**: Low-cardinality categories (Browsers, OS, Devices) use structured ranked progress bars with rank indicators (`#1`, `#2`, `#3`) and iconography rather than small cramped circular charts, maximizing legibility within multi-column card layouts.
- **Bundle Footprint**: Adds ~45 KB gzipped to the frontend bundle, justified by component reusability, accessibility, and interactive data exploration capabilities.
