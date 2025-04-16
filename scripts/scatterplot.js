// scripts/scatterPlot.js

function formatTime(seconds) {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimeShort(seconds) {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

function renderScatterPlot() {
  const container = d3.select("#scatterPlot");
  container.selectAll("svg").remove();

  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const allRoutes = Object.values(appState.stationData).flatMap(st => st.routes);
  const routeSet = appState.filteredRouteIDs ?? new Set(allRoutes.map(r => r.route_id));
  const routePoints = allRoutes
    .filter(r => routeSet.has(r.route_id))
    .filter(r => r.total_service_time_sec != null && r.total_transit_time_sec != null);

  if (routePoints.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("No data available to display.");
    return;
  }

  const xScale = d3.scaleLinear()
    .domain(d3.extent(routePoints, d => d.total_transit_time_sec))
    .nice()
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain(d3.extent(routePoints, d => d.total_service_time_sec))
    .nice()
    .range([height, 0]);

  const xMin = Math.floor(xScale.domain()[0] / 1800) * 1800;
  const xMax = Math.ceil(xScale.domain()[1] / 1800) * 1800;
  const yMin = Math.floor(yScale.domain()[0] / 1800) * 1800;
  const yMax = Math.ceil(yScale.domain()[1] / 1800) * 1800;
  const xTicks = d3.range(xMin, xMax + 1, 1800);
  const yTicks = d3.range(yMin, yMax + 1, 1800);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale).tickValues(xTicks).tickFormat(formatTimeShort));

  svg.append("g")
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickFormat(formatTimeShort));

  // Labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Total Transit Time");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Total Service Time");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text("Transit vs. Service Time per Route");

  // Plot dots
  svg.selectAll("circle.route-dot")
    .data(routePoints)
    .enter()
    .append("circle")
    .attr("class", "route-dot")
    .attr("cx", d => xScale(d.total_transit_time_sec))
    .attr("cy", d => yScale(d.total_service_time_sec))
    .attr("r", 2)
    .attr("fill", "red")
    .attr("opacity", 0.8);
}

// Expose globally
window.renderScatterPlot = renderScatterPlot;
