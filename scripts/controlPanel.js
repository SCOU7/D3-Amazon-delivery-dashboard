document.addEventListener("DOMContentLoaded", function () {
  const routeSelect = d3.select("#routeSelect");

  // Load routes.csv and populate the select menu
  d3.csv("processed_data/DAU1/routes.csv")
    .then(function (routes) {
      routes.forEach(function (route) {
        routeSelect.append("option")
          .attr("value", route.route_id)
          .text(route.route_id);
      });
    })
    .catch(function (error) {
      console.error("Error loading routes.csv:", error);
    });

  // Unified behavior when a route is selected
  routeSelect.on("change", function () {
    const selectedRoute = this.value;
    if (!selectedRoute) return;

    // Clear previous outputs
    d3.select("#stop-list").html("");
    d3.select("#map").html("");

    // Load all required CSVs
    Promise.all([
      d3.csv("processed_data/DAU1/stops.csv"),
      d3.csv("processed_data/DAU1/packages.csv"),
      d3.csv("processed_data/DAU1/actual_sequences.csv"),
      d3.csv(`processed_data/DAU1/travel_times/${selectedRoute}_travel_times.csv`)
    ])
      .then(function ([stopsData, packagesData, sequenceData, travelTimesData]) {
        // Filter relevant stops
        const stopsForRoute = stopsData.filter(d => d.route_id === selectedRoute);

        // Sequence and ordering
        const sequencesForRoute = sequenceData
          .filter(d => d.route_id === selectedRoute)
          .map(d => ({ stop_id: d.stop_id, sequence_order: +d.sequence_order }))
          .sort((a, b) => a.sequence_order - b.sequence_order);

        const orderedStops = sequencesForRoute.map(seq => {
          const stopDetail = stopsForRoute.find(s => s.stop_id === seq.stop_id);
          return { ...seq, ...stopDetail };
        });

        // Package count aggregation
        const packagesForRoute = packagesData.filter(d => d.route_id === selectedRoute);
        const packageCounts = {};
        packagesForRoute.forEach(pkg => {
          packageCounts[pkg.stop_id] = (packageCounts[pkg.stop_id] || 0) + 1;
        });

        // Travel time matrix parsing
        const travelTimes = {};
        travelTimesData.forEach(row => {
          travelTimes[row["from_stop"]] = row;
        });

        // --- Table Rendering ---
        const table = d3.select("#stop-list")
          .append("table")
          .attr("border", 1)
          .style("border-collapse", "collapse");

        const thead = table.append("thead");
        const tbody = table.append("tbody");

        thead.append("tr")
          .selectAll("th")
          .data(["Sequence Order", "Stop ID", "Packages Dropped", "Travel Time from Previous Stop"])
          .enter()
          .append("th")
          .text(d => d)
          .style("padding", "5px");

        orderedStops.forEach((stop, index) => {
          const tr = tbody.append("tr");
          tr.append("td").text(stop.sequence_order).style("padding", "5px");
          tr.append("td").text(stop.stop_id).style("padding", "5px");
          tr.append("td").text(packageCounts[stop.stop_id] || 0).style("padding", "5px");

          let travelTime = "N/A";
          if (index > 0) {
            const prevStop = orderedStops[index - 1].stop_id;
            const currStop = stop.stop_id;
            if (travelTimes[prevStop] && travelTimes[prevStop][currStop]) {
              travelTime = travelTimes[prevStop][currStop];
            }
          }

          tr.append("td").text(travelTime).style("padding", "5px");
        });

        // --- Map Drawing ---
        if (typeof drawMap === "function") {
          drawMap(orderedStops);
        } else {
          console.warn("drawMap function is not defined.");
        }
      })
      .catch(function (error) {
        console.error("Error loading one or more CSV files:", error);
      });
  });
});
