// scripts/pieCharts.js

(function () {
  const routeScoreColors = {
    High: "#d73027",
    Medium: "#fc8d59",
    Low: "#91bfdb"
  };

  const packageStatusColorsBinary = {
    DELIVERED: "#4CAF50",
    OTHER: "#FF5722"
  };

  const timeIntervals = [
    { label: "5–7AM", start: 5, end: 7 },
    { label: "7–9AM", start: 7, end: 9 },
    { label: "9–11AM", start: 9, end: 11 },
    { label: "11–1PM", start: 11, end: 13 },
    { label: "1–3PM", start: 13, end: 15 },
    { label: "3–5PM", start: 15, end: 17 },
    { label: "5–7PM", start: 17, end: 19 },
    { label: "7–9PM", start: 19, end: 21 },
    { label: "9–11PM", start: 21, end: 23 },
    { label: "11–1AM", start: 23, end: 1 },
    { label: "1–3AM", start: 1, end: 3 },
    { label: "3–5AM", start: 3, end: 5 },
  ];

  const timeIntervalColors = [
    "#FFCC80", "#FFE082", "#FFF176", "#AED581",
    "#81C784", "#4DB6AC", "#4FC3F7", "#64B5F6",
    "#BA68C8", "#9575CD", "#A1887F", "#90A4AE"
  ];

  const transitionDuration = 750;

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

  // ---------- Aggregation Functions ----------

  function aggregateRouteScores(level) {
    let routes = [];

    if (level === 1) {
      routes = Object.values(appState.stationData).flatMap(st => st.routes);
    } else if (level === 2) {
      routes = appState.filteredStationRoutes || [];
    } else if (level === 3) {
      const route = appState.stationRoutes.find(r => r.route_id === appState.selectedRoute);
      if (route) routes = [route];
    }

    return routes.reduce((acc, r) => {
      const score = r.route_score || "UNKNOWN";
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, {});
  }

  function aggregateDepartureTimeIntervals(level) {
    let routes = [];

    if (level === 1) {
      routes = Object.values(appState.stationData).flatMap(s => s.routes);
    } else if (level === 2) {
      routes = appState.filteredStationRoutes || [];
    } else if (level === 3) {
      const route = appState.stationRoutes.find(r => r.route_id === appState.selectedRoute);
      if (route) routes = [route];
    }

    const counts = Object.fromEntries(timeIntervals.map(t => [t.label, 0]));

    routes.forEach(r => {
      if (!r.departure_time_utc) return;
      const hour = parseInt(r.departure_time_utc.split(":")[0]);

      for (const t of timeIntervals) {
        if (t.start < t.end && hour >= t.start && hour < t.end) {
          counts[t.label]++;
          break;
        } else if (t.start > t.end && (hour >= t.start || hour < t.end)) {
          counts[t.label]++;
          break;
        }
      }
    });

    return counts;
  }

  function aggregateDeliveredBinary(level) {
    let pkgs = [];

    if (level === 1) {
      pkgs = Object.values(appState.stationData)
        .flatMap(st => st.packages);
    } else if (level === 2) {
      const station = appState.stationData[appState.selectedStation];
      pkgs = station ? station.packages : [];
    } else if (level === 3) {
      pkgs = appState.routePackages || [];
    }

    const counts = { DELIVERED: 0, OTHER: 0 };

    pkgs.forEach(p => {
      if (p.scan_status === "DELIVERED") {
        counts.DELIVERED++;
      } else {
        counts.OTHER++;
      }
    });

    return counts;
  }

  function createPieData(counts, thresholdPercent = 0) {
    const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
    return Object.entries(counts)
      .map(([label, value]) => ({
        score: label,
        value,
        percent: total > 0 ? (value / total) * 100 : 0
      }))
      .filter(d => d.value > 0 && d.percent >= thresholdPercent);
  }

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

  function renderPieChart(containerId, data, colorMap) {
    const container = d3.select(`#${containerId}`);
    const rect = container.node().getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const radius = Math.min(width, height) / 3.5;

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

    container.select("svg.pie-svg")
      .transition()
      .duration(transitionDuration)
      .style("opacity", data.length > 0 ? 1 : 0.25);

    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);
    const arcData = pie(data);
    const total = d3.sum(arcData, d => d.data.value);

    const arc = d3.arc()
      .outerRadius(radius)
      .innerRadius(0);

    const arcs = svgSelection.selectAll("path.arc")
      .data(arcData, d => d.data.score);

    arcs.enter()
      .append("path")
      .attr("class", "arc")
      .attr("fill", d => {
        if (colorMap instanceof Array) {
          const index = timeIntervals.findIndex(t => t.label === d.data.score);
          return colorMap[index] || "#ccc";
        } else {
          return colorMap[d.data.score] || "#ccc";
        }
      })
      .each(function (d) { this._current = d; })
      .merge(arcs)
      .on("mouseover", function (event, d) {
        const percentage = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : 0;
        tooltip.text(`${d.data.score}: ${d.data.value} (${percentage}%)`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px")
          .transition().duration(200).style("opacity", 1);
      })
      .on("mousemove", function (event) {
        tooltip.style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(200).style("opacity", 0);
      })
      .transition()
      .duration(transitionDuration)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(0);
        return t => arc(interpolate(t));
      });

    arcs.exit().remove();

    const labelOffset = 10; // How far outside the arc

    const labels = svgSelection.selectAll("text.label")
      .data(arcData, d => d.data.score);

    labels.enter()
      .append("text")
      .attr("class", "label")
      .merge(labels)
      .attr("transform", d => {
        const [x, y] = arc.centroid(d);
        const angle = Math.atan2(y, x);
        const r = radius + labelOffset;
        const lx = r * Math.cos(angle);
        const ly = r * Math.sin(angle);
        return `translate(${lx}, ${ly})`;
      })
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .style("font-size", "12px")
      .style("fill", "white")
      .text(d => d.data.score);

    labels.exit().remove();
  }

  function updatePieCharts() {
    const level = appState.currentLevel;

    // Pie 1: Route Score
    const pie1Data = createPieData(aggregateRouteScores(level));
    renderPieChart("pieChartLevel1", pie1Data, routeScoreColors);
    renderPieTitle("pieChartLevel1", "Route Score");

    // Pie 2: Departure Clock
    const pie2Raw = aggregateDepartureTimeIntervals(level);
    const pie2Data = createPieData(pie2Raw, 0.5); // exclude <0.5% slivers
    renderPieChart("pieChartLevel2", pie2Data, timeIntervalColors);
    renderPieTitle("pieChartLevel2", "Departure Time (UTC)");

    // Pie 3: Delivered vs Other (now for all levels)
    const pie3Data = createPieData(aggregateDeliveredBinary(level));
    renderPieChart("pieChartLevel3", pie3Data, packageStatusColorsBinary);
    renderPieTitle("pieChartLevel3", "Delivered");
  }

  window.updatePieCharts = updatePieCharts;

  document.addEventListener("DOMContentLoaded", () => {
    updatePieCharts();
  });

  setInterval(updatePieCharts, 2000);
})();
