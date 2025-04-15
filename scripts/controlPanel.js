// scripts/controlPanel.js

document.addEventListener("DOMContentLoaded", function() {
  // List of the 17 station codes (folder names)
  const stationCodes = [
    "DAU1", "DBO1", "DBO2", "DBO3", "DCH1", "DCH2", "DCH3", "DCH4",
    "DLA3", "DLA4", "DLA5", "DLA7", "DLA8", "DLA9", "DSE2", "DSE4", "DSE5"
  ];

  // Select DOM elements
  const stationSelect = d3.select("#stationSelect");
  const routeSelect = d3.select("#routeSelect");
  const stationRouteCount = d3.select("#station-route-count");
  const aggregateStatsEl = d3.select("#aggregate-stats");

  // Populate stationSelect dropdown using the stationCodes array.
  stationCodes.forEach(station => {
    stationSelect.append("option")
      .attr("value", station)
      .text(station);
  });

  // Function to compute aggregate stats (total routes and average stops) across all stations.
  function computeAggregateStats(stations) {
    let totalRoutes = 0;
    let totalStops = 0;
    // For each station, load its routes.csv and stops.csv
    const promises = stations.map(station => {
      return Promise.all([
        d3.csv(`processed_data/${station}/routes.csv`),
        d3.csv(`processed_data/${station}/stops.csv`)
      ]).then(([routes, stops]) => {
        totalRoutes += routes.length;
        // Group stops by route_id.
        const routesGrouped = d3.group(stops, d => d.route_id);
        routesGrouped.forEach(stopsArray => {
          totalStops += stopsArray.length;
        });
      }).catch(error => {
        console.error(`Error loading data for station ${station}:`, error);
      });
    });
    return Promise.all(promises).then(() => {
      return {
        totalRoutes: totalRoutes,
        averageStops: totalStops / totalRoutes
      };
    });
  }

  // Compute and display aggregate stats
  computeAggregateStats(stationCodes)
    .then(stats => {
      aggregateStatsEl.html(
        `<p>Total routes among all stations: ${stats.totalRoutes}</p>
         <p>Average number of stops per route: ${stats.averageStops.toFixed(2)}</p>`
      );
    })
    .catch(error => {
      aggregateStatsEl.html("<p>Error computing aggregate stats.</p>");
      console.error("Error computing aggregate stats:", error);
    });

  // When a station is selected, load its routes.csv and update the route dropdown.
  stationSelect.on("change", function() {
    const selectedStation = this.value;
    // Clear previous station-specific information.
    routeSelect.html('<option value="">--Select a Route--</option>');
    stationRouteCount.html("");
    d3.select("#stop-list").html("");
    d3.select("#map").html("");

    if (!selectedStation) return;

    d3.csv(`processed_data/${selectedStation}/routes.csv`)
      .then(function(routes) {
        // Update the station-route count display.
        stationRouteCount.html(`<p>Station ${selectedStation} has ${routes.length} routes.</p>`);
        // Populate routeSelect dropdown.
        routes.forEach(route => {
          routeSelect.append("option")
            .attr("value", route.route_id)
            .text(route.route_id);
        });
      })
      .catch(function(error) {
        console.error("Error loading routes.csv for station:", error);
      });
  });

  // When a route is selected, load route-specific files and display stops table and map.
  routeSelect.on("change", function() {
    const selectedRoute = this.value;
    const selectedStation = stationSelect.node().value;
    if (!selectedRoute || !selectedStation) return;

    // Clear previous output for stops table and map.
    d3.select("#stop-list").html("");
    d3.select("#map").html("");

    // Load the stops, packages, actual_sequences, and travel_times files for the selected route.
    Promise.all([
      d3.csv(`processed_data/${selectedStation}/stops.csv`),
      d3.csv(`processed_data/${selectedStation}/packages.csv`),
      d3.csv(`processed_data/${selectedStation}/actual_sequences.csv`),
      d3.csv(`processed_data/${selectedStation}/travel_times/${selectedRoute}_travel_times.csv`)
    ])
    .then(function([stopsData, packagesData, sequenceData, travelTimesData]) {
      // Filter stops data by the selected route.
      const stopsForRoute = stopsData.filter(d => d.route_id === selectedRoute);

      // Get the sequence of stops and sort them numerically.
      const sequencesForRoute = sequenceData
        .filter(d => d.route_id === selectedRoute)
        .map(d => ({ stop_id: d.stop_id, sequence_order: +d.sequence_order }))
        .sort((a, b) => a.sequence_order - b.sequence_order);

      // Merge sequence information with the stop details.
      const orderedStops = sequencesForRoute.map(seq => {
        const stopDetail = stopsForRoute.find(s => s.stop_id === seq.stop_id);
        return { ...seq, ...stopDetail };
      });

      // Count packages dropped off at each stop.
      const packagesForRoute = packagesData.filter(d => d.route_id === selectedRoute);
      const packageCounts = {};
      packagesForRoute.forEach(pkg => {
        packageCounts[pkg.stop_id] = (packageCounts[pkg.stop_id] || 0) + 1;
      });

      // Process travel times data (assumed matrix form: row key is from_stop).
      const travelTimes = {};
      travelTimesData.forEach(row => {
        travelTimes[row["from_stop"]] = row;
      });

      // Create a table to display stop details.
      const table = d3.select("#stop-list")
        .append("table")
        .attr("border", 1)
        .style("border-collapse", "collapse");

      const thead = table.append("thead");
      const tbody = table.append("tbody");

      // Define table headers.
      thead.append("tr")
        .selectAll("th")
        .data(["Sequence Order", "Stop ID", "Packages Dropped", "Travel Time from Previous Stop"])
        .enter()
        .append("th")
        .text(d => d)
        .style("padding", "5px");

      // Create a row for each stop.
      orderedStops.forEach((stop, index) => {
        const tr = tbody.append("tr");
        tr.append("td").text(stop.sequence_order).style("padding", "5px");
        tr.append("td").text(stop.stop_id).style("padding", "5px");
        tr.append("td").text(packageCounts[stop.stop_id] || 0).style("padding", "5px");

        // Determine travel time from the previous stop.
        let travelTime = "";
        if (index === 0) {
          travelTime = "N/A"; // Starting point has no previous segment.
        } else {
          const prevStop = orderedStops[index - 1].stop_id;
          const currStop = stop.stop_id;
          travelTime = (travelTimes[prevStop] && travelTimes[prevStop][currStop]) ? 
                        travelTimes[prevStop][currStop] : "N/A";
        }
        tr.append("td").text(travelTime).style("padding", "5px");
      });

      // Call the map drawing function (from mapVisualization.js) with the ordered stops.
      drawMap(orderedStops);
    })
    .catch(function(error) {
      console.error("Error loading route-specific CSV files:", error);
    });
  });
});
