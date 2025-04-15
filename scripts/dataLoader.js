// scripts/dataLoader.js

// You might store all station codes here or in stateManager.
// We'll store them here for convenience.
const STATION_CODES = [
  "DAU1", "DBO1", "DBO2", "DBO3", "DCH1", "DCH2", "DCH3", "DCH4",
  "DLA3", "DLA4", "DLA5", "DLA7", "DLA8", "DLA9",
  "DSE2", "DSE4", "DSE5"
];

/**
 * loadAllStations()
 * For each station folder in STATION_CODES:
 *   1) Load routes.csv -> find total # of routes.
 *   2) Load stops.csv  -> compute average lat/lng as station "representative" location.
 * Returns an array of station objects:
 * [
 *   { station_code: "DAU1", lat: 30.3, lng: -97.9, total_routes: 205 },
 *   { station_code: "DBO1", lat: 29.7, lng: -98.2, total_routes: 160 },
 *   ...
 * ]
 */
async function loadAllStations() {
  const stationPromises = STATION_CODES.map(async stationCode => {
    try {
      // 1) Load routes.csv to get total # routes
      const routes = await d3.csv(`processed_data/${stationCode}/routes.csv`);
      const totalRoutes = routes.length;

      // 2) Load stops.csv to compute average lat/lng
      const stops = await d3.csv(`processed_data/${stationCode}/stops.csv`, d => {
        // lat/lng are numeric
        return {
          route_id: d.route_id,
          stop_id: d.stop_id,
          lat: +d.lat,
          lng: +d.lng,
          zone_id: d.zone_id,
          type: d.type
        };
      });

      // If your dataset has a row with type = "Station", you might prefer to find that row:
      // const stationRow = stops.find(s => s.type === "Station");
      // let stationLat = stationRow ? stationRow.lat : ...
      // let stationLng = stationRow ? stationRow.lng : ...
      // 
      // Otherwise, we take average of all stops:
      let avgLat = 0, avgLng = 0;
      stops.forEach(s => {
        avgLat += s.lat;
        avgLng += s.lng;
      });
      avgLat /= stops.length;
      avgLng /= stops.length;

      return {
        station_code: stationCode,
        lat: avgLat,
        lng: avgLng,
        total_routes: totalRoutes
      };
    } catch (err) {
      console.error(`Error loading data for station ${stationCode}:`, err);
      // Return null or some fallback
      return null;
    }
  });

  // Wait for all station data to load
  const stationsArray = await Promise.all(stationPromises);

  // Filter out any null returns (in case of an error)
  const validStations = stationsArray.filter(d => d !== null);

  return validStations;
}
