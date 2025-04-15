document.addEventListener("DOMContentLoaded", function() {
  const routeSelect = d3.select("#routeSelect");

  // Load routes.csv and populate the select menu
  d3.csv("preprocessed_data/DAU1/routes.csv")
    .then(function(routes) {
      routes.forEach(function(route) {
        routeSelect.append("option")
          .attr("value", route.route_id)
          .text(route.route_id);
      });
    })
    .catch(function(error) {
      console.error("Error loading routes.csv:", error);
    });

  // When a route is selected, load and link data from the other CSV files
  routeSelect.on("change", function() {
    const selectedRoute = this.value;
    if (!selectedRoute) return;

    // Clear any previous stop details
    d3.select("#stop-list").html("");

    // Load stops, packages, actual sequences, and travel times for the selected route
    Promise.all([
      d3.csv("preprocessed_data/DAU1/stops.csv"),
      d3.csv("preprocessed_data/DAU1/packages.csv"),
      d3.csv("preprocessed_data/DAU1/actual_sequences.csv"),
      d3.csv(`preprocessed_data/DAU1/travel_times/${selectedRoute}_travel_times.csv`)
    ])
    .then(function([stopsData, packagesData, sequenceData, travelTimesData]) {
      // Filter stops for the selected route
      const stopsForRoute = stopsData.filter(d => d.route_id === selectedRoute);

      // Get the sequence for the route and ensure numeric ordering
      const sequencesForRoute = sequenceData
        .filter(d => d.route_id === selectedRoute)
        .map(d => ({ stop_id: d.stop_id, sequence_order: +d.sequence_order }));

      // Sort by sequence order
      sequencesForRoute.sort((a, b) => a.sequence_order - b.sequence_order);

      // Merge sequence info with stop data
      const orderedStops = sequencesForRoute.map(seq => {
        const stopDetail = stopsForRoute.find(s => s.stop_id === seq.stop_id);
        return { ...seq, ...stopDetail };
      });

      // Count packages dropped off at each stop (defaulting to 0 if none)
      const packagesForRoute = packagesData.filter(d => d.route_id === selectedRoute);
      const packageCounts = {};
      packagesForRoute.forEach(pkg => {
        packageCounts[pkg.stop_id] = (packageCounts[pkg.stop_id] || 0) + 1;
      });

      // Process travel times:
      // The travelTimesData is in matrix form where each row has a 'from_stop'
      // and columns for destination stops.
      const travelTimes = {};
      travelTimesData.forEach(row => {
        // row.from_stop serves as the key for this row
        travelTimes[row["from_stop"]] = row;
      });

      // Create a table to display:
      // Sequence Order, Stop ID, Packages Dropped, Travel Time from Previous Stop
      const table = d3.select("#stop-list")
        .append("table")
        .attr("border", 1)
        .style("border-collapse", "collapse");

      const thead = table.append("thead");
      const tbody = table.append("tbody");

      // Define table headers
      thead.append("tr")
        .selectAll("th")
        .data(["Sequence Order", "Stop ID", "Packages Dropped", "Travel Time from Previous Stop"])
        .enter()
        .append("th")
        .text(d => d)
        .style("padding", "5px");

      // Create a row for each stop in the ordered list
      orderedStops.forEach((stop, index) => {
        const tr = tbody.append("tr");
        tr.append("td").text(stop.sequence_order).style("padding", "5px");
        tr.append("td").text(stop.stop_id).style("padding", "5px");
        tr.append("td").text(packageCounts[stop.stop_id] || 0).style("padding", "5px");

        // Determine travel time from the previous stop
        let travelTime = "";
        if (index === 0) {
          travelTime = "N/A";  // Starting point has no previous leg
        } else {
          const prevStop = orderedStops[index - 1].stop_id;
          const currentStop = stop.stop_id;
          // Lookup travel time in the matrix: from prevStop row to currentStop column
          if (travelTimes[prevStop] && travelTimes[prevStop][currentStop]) {
            travelTime = travelTimes[prevStop][currentStop];
          } else {
            travelTime = "N/A";
          }
        }
        tr.append("td").text(travelTime).style("padding", "5px");
      });
    })
    .catch(function(error) {
      console.error("Error loading one or more CSV files:", error);
    });
  });
});
