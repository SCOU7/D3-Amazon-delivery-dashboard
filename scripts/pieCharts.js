// scripts/pieCharts.js

(function() {
  // Define color mapping for route_score categories.
  const routeScoreColors = {
    High: "#d73027",
    Medium: "#fc8d59",
    Low: "#91bfdb"
  };

  // Duration for transitions (in milliseconds).
  const transitionDuration = 750;

  // Define the tooltip once so that it persists between updates.
  const tooltip = d3.select("body")
    .selectAll("div.tooltip")
    .data([null])
    .join("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("opacity", 0);

  // --- Faster Aggregation Functions ---

  // National aggregation using flatMap and reduce.
  function aggregateNationalRoutes() {
    const allRoutes = Object.values(appState.stationData).flatMap(s => s.routes);
    return allRoutes.reduce((acc, route) => {
      const score = route.route_score;
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, { High: 0, Medium: 0, Low: 0 });
  }

  // Station aggregation using reduce.
  function aggregateStationRoutes() {
    return (appState.filteredStationRoutes || []).reduce((acc, route) => {
      const score = route.route_score;
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, { High: 0, Medium: 0, Low: 0 });
  }

  // Zone aggregation: precompute a mapping from route_id to zones from appState.stationStops.
  function aggregateRoutesInSameZone() {
    const counts = { High: 0, Medium: 0, Low: 0 };
    const selectedRoute = appState.selectedRoute;
    if (!selectedRoute) return counts;
    
    // Precompute a map: route_id => Set of zone_ids.
    const routeZoneMap = appState.stationStops.reduce((map, stop) => {
      if (!map[stop.route_id]) {
        map[stop.route_id] = new Set();
      }
      map[stop.route_id].add(stop.zone_id);
      return map;
    }, {});
    
    // Determine target zone from the first stop of the selected route.
    const targetZones = routeZoneMap[selectedRoute];
    if (!targetZones || targetZones.size === 0) return counts;
    const targetZone = Array.from(targetZones)[0];
    
    // Count stationRoutes whose corresponding stop set contains the targetZone.
    appState.stationRoutes.forEach(route => {
      const zones = routeZoneMap[route.route_id];
      if (zones && zones.has(targetZone)) {
        const score = route.route_score;
        counts[score] = (counts[score] || 0) + 1;
      }
    });
    return counts;
  }

  // Convert counts object into an array format for d3.pie, filtering out zero values.
  function createPieData(counts) {
    return Object.entries(counts)
      .map(([score, value]) => ({ score, value }))
      .filter(d => d.value > 0);
  }

  // --- Title Rendering --- 
  // Renders a title (an <h4> element) at the top of the container.
  function renderPieTitle(containerId, title) {
    const container = d3.select(`#${containerId}`);
    let titleSelection = container.select(".pie-title");
    if (titleSelection.empty()) {
      titleSelection = container.insert("h4", ":first-child")
        .attr("class", "pie-title")
        .style("opacity", 0);
    }
    titleSelection.transition()
      .duration(transitionDuration)
      .style("opacity", title ? 1 : 0)
      .text(title);
  }

  // --- Pie Chart Rendering Function ---
  // Creates or updates a pie chart in the given container.
  function renderPieChart(containerId, data) {
    const container = d3.select(`#${containerId}`);
    const rect = container.node().getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    // Adjust the radius by modifying the subtraction value here.
    const radius = Math.min(width, height) / 3.5;

    // Create or select the main SVG element and group.
    let svgSelection = container.select("svg.pie-svg");
    if (svgSelection.empty()) {
      svgSelection = container.append("svg")
        .attr("class", "pie-svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("class", "pie-group")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);
    } else {
      svgSelection = svgSelection.select("g.pie-group")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);
    }

    // Use a fade transition to show/hide the pie chart.
    container.select("svg.pie-svg")
      .transition()
      .duration(transitionDuration)
      .style("opacity", data.length > 0 ? 1 : 0);

    // Create the pie layout (preserving order via sort(null)).
    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);
    const arcData = pie(data);

    // Compute total for percentage calculation.
    const total = d3.sum(arcData, d => d.data.value);

    // Define the arc generator.
    const arc = d3.arc()
      .outerRadius(radius)
      .innerRadius(0);

    // Data join for arcs.
    const arcs = svgSelection.selectAll("path.arc")
      .data(arcData, d => d.data.score);

    // Enter new arcs and update arcs.
    arcs.enter()
      .append("path")
      .attr("class", "arc")
      .attr("fill", d => routeScoreColors[d.data.score])
      .each(function(d) { this._current = d; })
      .merge(arcs)
      .on("mouseover", function(event, d) {
        const percentage = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : 0;
        tooltip.text(`Routes: ${d.data.value} (${percentage}%)`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px")
          .transition().duration(200).style("opacity", 1);
      })
      .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition().duration(200).style("opacity", 0);
      })
      .transition()
      .duration(transitionDuration)
      .attrTween("d", function(d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(0);
        return t => arc(interpolate(t));
      });

    arcs.exit().remove();

    // --- Add Labels on the Pie Slices ---
    // Each label shows the route_score (e.g., "High", "Medium", "Low").
    const labels = svgSelection.selectAll("text.label")
      .data(arcData, d => d.data.score);

    labels.enter()
      .append("text")
      .attr("class", "label")
      .merge(labels)
      .attr("transform", d => {
        const centroid = arc.centroid(d);
        return `translate(${centroid[0]}, ${centroid[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .style("font-size", "12px")
      .style("fill", "#fff")
      .text(d => d.data.score);

    labels.exit().remove();
  }

  // --- Update Function for All Pie Charts ---
  function updatePieCharts() {
    // Pie Chart 1: Always visible. Title: "All Routes".
    const nationalCounts = aggregateNationalRoutes();
    const nationalPieData = createPieData(nationalCounts);
    renderPieChart("pieChartLevel1", nationalPieData);
    renderPieTitle("pieChartLevel1", "All Routes");

    // Pie Chart 2: Visible if Level >= 2; otherwise fade out.
    let stationPieData = [];
    let stationTitle = "";
    if (appState.currentLevel >= 2) {
      const stationCounts = aggregateStationRoutes();
      stationPieData = createPieData(stationCounts);
      stationTitle = `Station ${appState.selectedStation || ""}`;
    }
    renderPieChart("pieChartLevel2", stationPieData);
    renderPieTitle("pieChartLevel2", stationTitle);

    // Pie Chart 3: Visible if Level >= 3; otherwise fade out.
    let zonePieData = [];
    let zoneTitle = "";
    if (appState.currentLevel >= 3) {
      const zoneCounts = aggregateRoutesInSameZone();
      zonePieData = createPieData(zoneCounts);
      // Get the zone from the first stop of the selected route, if available.
      const stopsForSelectedRoute = appState.stationStops.filter(s => s.route_id === appState.selectedRoute);
      if (stopsForSelectedRoute.length) {
        zoneTitle = `Zone ${stopsForSelectedRoute[0].zone_id}`;
      }
    }
    renderPieChart("pieChartLevel3", zonePieData);
    renderPieTitle("pieChartLevel3", zoneTitle);
  }

  // Expose the update function globally so it can be invoked on level transitions.
  window.updatePieCharts = updatePieCharts;

  document.addEventListener("DOMContentLoaded", () => {
    updatePieCharts();
  });

  // Optionally update the charts periodically.
  setInterval(updatePieCharts, 2000);
})();
