// scripts/pieCharts.js
import { appState } from './stateManager.js';

const routeScoreColors = {
  High:   "#4CAF50",
  Medium: "#ffcc00",
  Low:    "#1ee954"
};

const packageStatusColorsBinary = {
  DELIVERED: "#4CAF50",
  OTHER:     "#ff6f61"
};

const timeIntervals = [
  { label: "5–7AM",  start: 5,  end: 7 },
  { label: "7–9AM",  start: 7,  end: 9 },
  { label: "9–11AM", start: 9,  end: 11 },
  { label: "11–1PM", start: 11, end: 13 },
  { label: "1–3PM",  start: 13, end: 15 },
  { label: "3–5PM",  start: 15, end: 17 },
  { label: "5–7PM",  start: 17, end: 19 },
  { label: "7–9PM",  start: 19, end: 21 },
  { label: "9–11PM", start: 21, end: 23 },
  { label: "11–1AM", start: 23, end: 1 },
  { label: "1–3AM",  start: 1,  end: 3 },
  { label: "3–5AM",  start: 3,  end: 5 }
];

const timeIntervalColors = [
  "#FFF176", "#AED581", "#4FC3F7", "#64B5F6",
  "#BA68C8", "#9575CD", "#A1887F", "#90A4AE",
  "#FFB300", "#FF7043", "#F06292", "#4DD0E1"
];

const transitionDuration = 750;

const tooltip = d3.select("body")
  .selectAll("div.tooltip")
  .data([null])
  .join("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")

/* ───────────── aggregation helpers ───────────── */

function aggregateRouteScores(level) {
  let routes = [];
  if (level === 1)
    routes = Object.values(appState.stationData).flatMap(st => st.routes);
  else if (level === 2)
    routes = appState.filteredStationRoutes || [];
  else if (level === 3) {
    const r = appState.stationRoutes.find(r => r.route_id === appState.selectedRoute);
    if (r) routes = [r];
  }
  return routes.reduce((acc, r) => {
    const s = r.route_score || "UNKNOWN";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
}

function aggregateDepartureTimeIntervals(level) {
  let routes = [];
  if (level === 1)
    routes = Object.values(appState.stationData).flatMap(s => s.routes);
  else if (level === 2)
    routes = appState.filteredStationRoutes || [];
  else if (level === 3) {
    const r = appState.stationRoutes.find(r => r.route_id === appState.selectedRoute);
    if (r) routes = [r];
  }

  const counts = Object.fromEntries(timeIntervals.map(t => [t.label, 0]));

  routes.forEach(r => {
    if (!r.departure_time_utc) return;
    const h = +r.departure_time_utc.split(":")[0];
    for (const t of timeIntervals) {
      if (t.start < t.end ? h >= t.start && h < t.end
                          : h >= t.start || h < t.end) {
        counts[t.label]++; break;
      }
    }
  });
  return counts;
}

function aggregateDeliveredBinary(level) {
  let pkgs = [];
  if (level === 1)
    pkgs = Object.values(appState.stationData).flatMap(st => st.packages);
  else if (level === 2) {
    const st = appState.stationData[appState.selectedStation];
    const valid = new Set(appState.filteredStationRoutes.map(r => r.route_id));
    pkgs = st ? st.packages.filter(p => valid.has(p.route_id)) : [];
  } else if (level === 3)
    pkgs = appState.routePackages || [];

  const c = { DELIVERED: 0, OTHER: 0 };
  pkgs.forEach(p => p.scan_status === "DELIVERED" ? c.DELIVERED++ : c.OTHER++);
  return c;
}

function createPieData(counts, thresholdPercent = 0) {
  const total = d3.sum(Object.values(counts));
  return Object.entries(counts)
    .map(([label, value]) => ({
      score: label,
      value,
      percent: total ? (value / total) * 100 : 0
    }))
    .filter(d => d.value > 0 && d.percent >= thresholdPercent);
}

/* ───────────── rendering helpers ───────────── */

function renderPieTitle(containerId, title) {
  const container = d3.select(`#${containerId}`);
  let t = container.select(".pie-title");
  if (t.empty())
    t = container.insert("h4", ":first-child").attr("class", "pie-title")
                 .style("opacity", 0);
  t.transition().duration(transitionDuration)
   .style("opacity", title ? 1 : 0).text(title);
}

function renderPieChart(containerId, data, colorMap) {
  const container = d3.select(`#${containerId}`);

  const rect    = container.node().getBoundingClientRect();
  const width   = rect.width;
  const height  = rect.height;
  const radius  = Math.min(width, height) / 3.5;

  let svgSel = container.select("svg.pie-svg");

  /* ★ NEW: always sync width/height even if the svg already exists */
  if (!svgSel.empty()) svgSel.attr("width", width).attr("height", height);

  if (svgSel.empty()) {
    svgSel = container.append("svg")
      .attr("class", "pie-svg")
      .attr("width",  width)
      .attr("height", height)
      .append("g")
      .attr("class", "pie-group")
      .attr("transform", `translate(${width/2},${height/2 - 30})`);
  } else {
    svgSel = svgSel.select("g.pie-group")
      .attr("transform", `translate(${width/2},${height/2 - 30})`);
  }

  container.select("svg.pie-svg")
           .transition().duration(transitionDuration)
           .style("opacity", data.length ? 1 : 0.25);

  const pie     = d3.pie().value(d => d.value).sort(null);
  const arcsDat = pie(data);
  const total   = d3.sum(arcsDat, d => d.data.value);
  const arcGen  = d3.arc().outerRadius(radius).innerRadius(0);

  const arcs = svgSel.selectAll("path.arc").data(arcsDat, d => d.data.score);

  arcs.enter().append("path")
      .attr("class", "arc")
      .attr("fill", d => {
        if (Array.isArray(colorMap)) {
          const idx = timeIntervals.findIndex(t => t.label === d.data.score);
          return colorMap[idx] || "#ccc";
        }
        return colorMap[d.data.score] || "#ccc";
      })
      .each(function(d){ this._current = d; })
      .merge(arcs)
      .on("mouseover", (e,d) => {
        const pct = total ? (d.data.value/total*100).toFixed(1) : 0;
        tooltip.text(`${d.data.score}: ${d.data.value} (${pct}%)`)
               .style("left",(e.pageX+10)+"px")
               .style("top",(e.pageY+10)+"px")
               .transition().duration(200).style("opacity",1);
      })
      .on("mousemove", e =>
        tooltip.style("left",(e.pageX+10)+"px")
               .style("top",(e.pageY+10)+"px"))
      .on("mouseout", () =>
        tooltip.transition().duration(200).style("opacity",0))
      .transition().duration(transitionDuration)
      .attrTween("d", function(d){
        const i = d3.interpolate(this._current,d);
        this._current = i(0);
        return t => arcGen(i(t));
      });

  arcs.exit().remove();

  /* labels */
  const labelOffset = 15;
  const labels = svgSel.selectAll("text.label")
                       .data(arcsDat, d => d.data.score);

  labels.enter().append("text")
        .attr("class","label")
        .merge(labels)
        .attr("transform", d => {
          const [x,y] = arcGen.centroid(d);
          const ang = Math.atan2(y,x);
          const r   = radius + labelOffset;
          return `translate(${r*Math.cos(ang)},${r*Math.sin(ang)})`;
        })
        .attr("text-anchor", "start")
        .attr("alignment-baseline", "middle")
        .style("font-size", "7px")
        .style("fill", "white")
        .text(d => d.data.score);

  labels.exit().remove();
}

/* ───────────── public update function ───────────── */
export function updatePieCharts() {
  const level   = appState.currentLevel;

  renderPieChart("pieChartLevel1",
                 createPieData(aggregateRouteScores(level)),
                 routeScoreColors);
  renderPieTitle("pieChartLevel1", "Route Score");

  renderPieChart("pieChartLevel2",
                 createPieData(aggregateDepartureTimeIntervals(level), 0.5),
                 timeIntervalColors);
  renderPieTitle("pieChartLevel2", "Departure Time (UTC)");

  renderPieChart("pieChartLevel3",
                 createPieData(aggregateDeliveredBinary(level)),
                 packageStatusColorsBinary);
  renderPieTitle("pieChartLevel3", "Delivered");
}

/* initial & periodic refresh */
document.addEventListener("DOMContentLoaded", () => setTimeout(updatePieCharts,0));
setInterval(updatePieCharts, 2000);
