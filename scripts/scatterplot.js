// scripts/scatterPlot.js
import { appState } from './stateManager.js';
export { renderScatterPlot };

function getHalfHourTicks([min, max]) {
  const start = Math.ceil(min / 1800) * 1800;
  const end = Math.floor(max / 1800) * 1800;
  const ticks = [];
  for (let t = start; t <= end; t += 1800) {
    ticks.push(t);
  }
  return ticks;
}

function formatTime(seconds) {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimeTiny(seconds) {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
}

// Append a tooltip element (only once).
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip");

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

  let routePoints = [];
  const level = appState.currentLevel;
  if (level === 1) {
    routePoints = Object.values(appState.stationData).flatMap(st => st.routes);
  } else if (level === 2) {
    routePoints = appState.filteredStationRoutes || [];
  } else if (level === 3) {
    const route = appState.stationRoutes.find(r => r.route_id === appState.selectedRoute);
    routePoints = route ? [route] : [];
  }

  const { x: xField, y: yField } = appState.scatterAxes;
  routePoints = routePoints.filter(r => r[xField] != null && r[yField] != null);

  if (routePoints.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("class", "axis-label")
      .text("No data available to display.");
    return;
  }

  const xScale = d3.scaleLinear()
    .domain(d3.extent(routePoints, d => d[xField]))
    .nice()
    .range([0, width]);
  const yScale = d3.scaleLinear()
    .domain(d3.extent(routePoints, d => d[yField]))
    .nice()
    .range([height, 0]);

  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale)
    .tickValues(getHalfHourTicks(xScale.domain()))
    .tickFormat(formatTimeTiny));

  svg.append("g")
    .call(d3.axisLeft(yScale).tickFormat(formatTimeTiny));

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text(xField.includes("transit") ? "Transit Time" : "Service Time");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text(yField.includes("service") ? "Service Time" : "Transit Time");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("class", "plot-title")
    .text("Transit vs. Service Time per Route");

  const dots = svg.selectAll("circle.route-dot")
    .data(routePoints, d => d.route_id);

  dots.enter()
    .append("circle")
    .attr("class", "route-dot")
    .attr("cx", d => xScale(d[xField]))
    .attr("cy", d => yScale(d[yField]))
    .attr("r", 0)
    .on("mouseover", (event, d) => {
      tooltip.html(`
        <strong>Route ID:</strong> ${d.route_id}<br/>
        <strong>Station:</strong> ${d.station_code || "N/A"}<br/>
        <strong>Departure:</strong> ${d.departure_time_utc}<br/>
        <strong>Score:</strong> ${d.route_score}<br/>
        <strong>Transit Time:</strong> ${formatTime(d.total_transit_time_sec)}<br/>
        <strong>Service Time:</strong> ${formatTime(d.total_service_time_sec)}
      `)
      .style("opacity", 1);

      if (appState.currentLevel === 1) {
        d3.select(`circle.station-circle[data-station='${d.station_code}']`)
          .classed("station-highlight", true);
      } else if (appState.currentLevel === 2) {
        d3.selectAll("g.route-group").classed("dimmed", true);
        d3.select(`g.route-group[data-route-id='${d.route_id}']`)
          .classed("dimmed", false)
          .classed("route-highlight", true);
      }
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY + 10) + "px");
    })
    .on("mouseout", (event, d) => {
      tooltip.style("opacity", 0);
      if (appState.currentLevel === 1) {
        d3.select(`circle.station-circle[data-station='${d.station_code}']`)
          .classed("station-highlight", false);
      } else if (appState.currentLevel === 2) {
        d3.selectAll("g.route-group").classed("dimmed", false).classed("route-highlight", false);
      }
    })
    .transition()
    .duration(1000)
    .attr("r", 4);

  dots.transition()
    .duration(1000)
    .attr("cx", d => xScale(d[xField]))
    .attr("cy", d => yScale(d[yField]));

  dots.exit()
    .transition()
    .duration(1000)
    .attr("r", 0)
    .remove();
}
