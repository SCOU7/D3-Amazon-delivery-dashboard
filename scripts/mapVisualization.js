// scripts/mapVisualization.js

// Function to draw the map view for a given route's stops
function drawMap(orderedStops) {
  // Clear any previous map
  d3.select("#map").html("");

  // Set the dimensions and margins for the SVG
  const width = 600,
        height = 400,
        margin = 20;

  // Create the SVG container
  const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Convert ordered stops into GeoJSON features
  const features = orderedStops.map(stop => ({
    type: "Feature",
    properties: { stop_id: stop.stop_id },
    geometry: {
      type: "Point",
      coordinates: [ +stop.lng, +stop.lat ]
    }
  }));

  // Create a GeoJSON FeatureCollection
  const geojson = {
    type: "FeatureCollection",
    features: features
  };

  // Define a geoMercator projection that fits the stops into the SVG
  const projection = d3.geoMercator()
    .fitExtent([[margin, margin], [width - margin, height - margin]], geojson);

  // Create a group element for our map elements
  const g = svg.append("g");

  // Compute projected coordinates for each stop
  const projectedPoints = orderedStops.map(stop => projection([+stop.lng, +stop.lat]));

  // Draw a line that connects the stops in the order they were visited.
  // The first stop is assumed to be the starting point.
  const lineGenerator = d3.line();
  g.append("path")
    .datum(projectedPoints)
    .attr("d", lineGenerator)
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 2);

  // Draw circles at each stop position
  g.selectAll("circle")
    .data(projectedPoints)
    .enter()
    .append("circle")
    .attr("cx", d => d[0])
    .attr("cy", d => d[1])
    .attr("r", 5)
    .attr("fill", "red")
    .append("title")  // Add a tooltip to show the stop's ID on hover
    .text((d, i) => orderedStops[i].stop_id);
}
