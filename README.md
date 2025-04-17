# Amazon Last‑Mile Delivery Dashboard

<https://scou7.github.io/D3‑Amazon‑delivery‑dashboard/>

---

### 1 · Project Type  
Interactive data‑visualization dashboard (static, front‑end only).

### 2 · Purpose  
Provides rapid visual insight into the **2021 Amazon Last‑Mile Routing Research Challenge** data set ‑– 6 112 routes, 50 000+ stops and 1 M+ packages across 17 U.S. delivery stations.

### 3 · Tech Stack  
Plain **HTML + CSS + ES‑module JavaScript** using **D3 v7**.  
No back‑end; all data (~2.62 GB) is served directly from GitHub Pages. A fresh `git clone` takes <30 s on a typical broadband connection.

### 4 · Data Set in Brief  
A *route* originates at a **Station**, drives to the first drop‑off, then proceeds stop‑to‑stop delivering packages. Each route is unique by *(station code ⊕ date ⊕ departure time)*. Stations span four metropolitan areas (Dallas, Denver, Chicago, Seattle).

### 5 · Sample User Tasks (three examples)

| # | Business Question | Dashboard How‑To |
|---|-------------------|------------------|
| 1 | **Which routes are scored “Low” and why?** | In *Level 2* (Station View) toggle **Filter ▸ Route Score ▸ Low**, click **Apply**. Examine scatter‑plot clustering and map traces. Red map links mark segments with high traffic ratio—often the culprit behind low scores. |
| 2 | **What departure windows lead to prolonged *service* time?** | In *Level 1* switch scatter‑plot axes if needed (**Transit ⇄ Service**). Hover the **Departure‑Time** pie: slices update dynamically. Note which time‑of‑day sectors dominate the upper‑right scatter quadrant. |
| 3 | **Are certain delivery *zones* chronically delayed?** | Drill to a station, open the **Zone ID** multi‑select, choose suspicious zones, and apply. Routes and pies re‑aggregate; long red links or deep‑green nodes (long service) signal recurring issues. |

### 6 · Suggested Exploration Path

1. **Welcome screen** → click **Discover** when data shows *Ready*.  
2. **Nation View** (Level 1)  
   * Pies reveal national patterns (score mix, departure windows, delivery success ≥ 99 %).  
   * Hover scatter dots to see which station a route belongs to – matching mint station circles illuminate.  
3. **Station View** (Level 2)  
   * Click a station circle or scatter dot → zooms to that station.  
   * Yellow links = long “first‑leg” drive from station to first stop.  
   * Use the right‑hand **Filter** (score / date / zone) to focus the analysis; pies, scatter and map update in unison.  
4. **Route View** (Level 3)  
   * Select an interesting route.  
   * **Red route segments** denote legs with a high *traffic‑to‑distance ratio* (≥ 600 s / km) – likely congestion or circuitous routing.  
   * Node fill shade encodes average *planned service time* at the stop.  
5. Iterate, hypothesise, and uncover operational insights.

---

## In‑Depth Technical Reference  *(for developers & data scientists)*

### Contents
1. [Quick Start](#quick-start)  
2. [Repository Layout](#repository-layout)  
3. [Data Preparation Pipeline](#data-preparation-pipeline)  
4. [Runtime Architecture](#runtime-architecture)  
5. [State Management](#state-management)  
6. [Visual Layers](#visual-layers)  
7. [Interactivity & Event Flow](#interactivity--event-flow)  
8. [Performance Notes](#performance-notes)  
9. [Styling System](#styling-system)  
10. [Extending the Dashboard](#extending-the-dashboard)  
11. [Contributing](#contributing)  
12. [License](#license)

---

### Quick Start

```bash
# 1 · Clone (shallow for speed)
git clone --depth=1 https://github.com/scou7/D3-Amazon-delivery-dashboard.git
cd D3-Amazon-delivery-dashboard

# 2 · Serve locally (Python 3.x)
python -m http.server 8000
# open http://localhost:8000 in your browser
```

> **Tip:** All paths are relative; any static HTTP server works.

---

### Repository Layout

```
.
├── processed_data/              # Pre‑curated CSV & GeoJSON (2.6 GB, not tracked by Git LFS)
│   └── <STATION>/               # 17 stations × {routes,stops,packages,travel_times}
├── scripts/
│   ├── main.js                  # App boot‑strapper
│   ├── stateManager.js          # Centralised reactive store & level routing
│   ├── dataLoader.js            # Lazy + bulk loaders, metrics join
│   ├── pieCharts.js             # Three linked pies
│   ├── scatterPlot.js           # Fixed‑axis scatter with hover/selection
│   ├── mapManager.js            # Level‑aware map (D3 Geo + Zoom + Grid)
│   └── filterManager.js         # Right sidebar UI, declarative filters
├── styles.css                   # Single‑source design system
└── index.html                   # Minimal spa shell
```

---

### Data‑Preparation Pipeline

| Stage | Script / Notebook | Output | Purpose |
|-------|-------------------|--------|---------|
| **1. Raw CSV merge** | `prep/merge_raw.py` | `stage1_routes_full.csv` | Collate 6 112 route manifests from challenge zip bundles. |
| **2. Service / Transit metrics** | `prep/compute_times.py` | `route_time_metrics.csv` | Vectorised NumPy pass calculating `total_service_time_sec` and `total_transit_time_sec`; joined during client load. |
| **3. Geo Boundary simplification** | `prep/simplify_borders.py` (TopoJSON) | `borders.json` | 1:5 000 county borders simplified to 1:20 000, preserving topology for smooth zoom. |
| **4. Packaging** | Bash | `processed_data/*` | Station‑partitioned folders—Browser requests remain < 5 MB per station. |

All preprocessing is reproducible; see `/prep/README.md` for exact commands and SHA‑256 checksums.

---

### Runtime Architecture

```
index.html
  └─▶ main.js
        ├─ preloadAllData()  ← (Promise.all station fetches, joins metrics)
        ├─ stateManager.js   ← global reactive store
        ├─ initMap()         ← mapManager.js (Level‑aware)
        ├─ renderScatterPlot()
        └─ updatePieCharts()

Event bus: DOM events → stateManager.setLevel() → individual modules re‑render.
```

* **Levels**:  
  *L1 Nation* → *L2 Station* → *L3 Route* (forward) / *Back* (inverse).  
  Each transition is pure: no mutations outside the `appState` reducer.

---

### State Management

| Key                        | Type / Example                        | Mutated by                         |
|----------------------------|---------------------------------------|------------------------------------|
| `currentLevel`            | `1 | 2 | 3`                           | `setLevel()`                       |
| `stations`                | `[ {station_code, lat, lng, …} ]`     | `preloadAllData()`                 |
| `filters`                 | `{ routeScores, dateRange, … }`       | `filterManager.applyFilters()`     |
| `scatterAxes`             | `{ x, y }`                            | *Switch Axes* button               |
| `routeTravelTimes`        | `{ stopA: {stopB: sec,…}, … }`        | `loadRouteTravelTimes()`           |

All UI modules read from—never write to—`appState` (unidirectional flow).

---

### Visual Layers

1. **Pie Charts** (`pieCharts.js`)  
   * D3 *enter‑update‑exit* with a 750 ms tween; titles fade when empty.  
2. **Scatter Plot** (`scatterPlot.js`)  
   * Fixed axes (linear) with half‑hour ticks; points bind tooltip + map highlight callbacks.  
3. **Map** (`mapManager.js`)  
   * Projection switches: *mercator (nation)* or `fitExtent()` (station / route).  
   * Grid lines redraw on every `zoom` transform; county borders in a static background `g`.  
   * Level‑specific draw routines ensuring minimal DOM churn: SVG groups created once per level and discarded on `initMap()`.

---

### Interactivity & Event Flow

| Interaction | From | To | Result |
|-------------|------|----|--------|
| Hover scatter dot (L1) | `.route-dot` | `.station-circle` | Station pulse highlight. |
| Click station circle | `.station-circle` | `stateManager.setLevel(2)` | Drill‑down to Station View. |
| Change filter | Sidebar widgets | `applyFilters()` | Pies, scatter, map all re‑query derived data and animate diff. |
| Click route segment | `.route-group path` | `handleRouteClick()` | Loads travel‑time CSV ➜ Route View. |

All hover → map monitor messages rendered via `buildMonitorRows()` for consistent styling.

---

### Performance Notes

* **Data laziness**   Route‑level travel‑time matrices (~200 kB each) load **on‑demand** at Route View only.  
* **DOM footprint**   SVG elements are scoped to `<g class="zoom‑group">`; clearing the SVG between levels prevents orphan nodes.  
* **Zoom**            `d3.zoom().scaleExtent([0.1, 30])` with inverse‑transform math for grid tick generation—keeps grid crisp at any scale.  
* **CSS strictness**  Heavy use of `will‑change: transform` avoided; GPU overdraw negligible (< 2 % on a 4‑K monitor).

---

### Styling System

* Centralised **CSS variables** (`:root`) for palette; dark UI adheres to WCAG AA contrast.  
* Re‑usable *card* pattern for tooltips and map monitor; soft shadows at 35 % opacity.  
* Interactive elements (routes, nodes) animate via pure CSS `transition`, avoiding JS layout thrashing.

---

### Extending the Dashboard

| Goal | Where to Start |
|------|----------------|
| Add line‑haul CO₂ estimates | Append `co2_est_kg` to `route_time_metrics.csv`; update pie #1 aggregation helper. |
| Swap map projection (e.g., *Albers USA*) | `mapManager.js ▸ choose projection` block. |
| Plug‑in new filters (vehicle type) | `filterManager.js ▸ initializeFilters()` then extend `applyFilters()` predicate. |
| Localise UI text | Extract literals to `/i18n/en.json`; wrap renders with a tiny lookup helper. |

---

### Contributing

1. **Fork / feature branch / PR**; commit messages in *conventional‑commits* style.  
2. Run `npm run lint` (ESLint + Prettier) before pushing.  
3. Large data additions → use Git LFS and update `/prep` docs.

---

### License

MIT — see [`LICENSE`](LICENSE) for details. Amazon challenge data licensed as per original competition terms (non‑commercial research & educational use only).

---

*Crafted with meticulous care and a touch of operational curiosity.*