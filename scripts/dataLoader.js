// scripts/dataLoader.js

// Station codes defined as before
const STATION_CODES = [
  "DAU1", "DBO1", "DBO2", "DBO3", "DCH1", "DCH2", "DCH3", "DCH4",
  "DLA3", "DLA4", "DLA5", "DLA7", "DLA8", "DLA9",
  "DSE2", "DSE4", "DSE5"
];

/**
 * preloadAllData():
 *  1) For each station code, load routes.csv, stops.csv, actual_sequences.csv.
 *  2) Compute:
 *     - total_routes (simply routes.length)
 *     - approximate lat/lng for station (average of stops, or find "Station" row)
 *  3) Build two structures:
 *     a) stationAggregates[] for Level 1, each with { station_code, lat, lng, total_routes }
 *     b) stationData{} keyed by stationCode => { routes, stops, sequences, lat, lng, total_routes }
 *
 * Returns: { stationAggregates, stationData }
 */
async function preloadAllData() {
  const stationData = {};       // dictionary: stationCode -> { routes, stops, sequences, lat, lng, total_routes }
  const stationAggregates = []; // array: for Level 1 circles

  // Process each station code in parallel
  const allPromises = STATION_CODES.map(async (stationCode) => {
    try {
      // Load all 3 CSVs in parallel
      const [routes, stops, sequences] = await Promise.all([
        d3.csv(`processed_data/${stationCode}/routes.csv`, r => ({
          route_id: r.route_id,
          station_code: r.station_code,
          date: r.date,
          departure_time_utc: r.departure_time_utc,
          executor_capacity_cm3: +r.executor_capacity_cm3,
          route_score: r.route_score
        })),
        d3.csv(`processed_data/${stationCode}/stops.csv`, s => ({
          route_id: s.route_id,
          stop_id: s.stop_id,
          lat: +s.lat,
          lng: +s.lng,
          zone_id: s.zone_id,
          type: s.type
        })),
        d3.csv(`processed_data/${stationCode}/actual_sequences.csv`, seq => ({
          route_id: seq.route_id,
          stop_id: seq.stop_id,
          sequence_order: +seq.sequence_order
        }))
      ]);

      // total routes is simply the length of routes.csv
      const total_routes = routes.length;

      // approximate station lat/lng by averaging all stops:
      let avgLat = 0, avgLng = 0;
      if (stops.length > 0) {
        stops.forEach(st => {
          avgLat += st.lat;
          avgLng += st.lng;
        });
        avgLat /= stops.length;
        avgLng /= stops.length;
      } else {
        // fallback
        avgLat = 39; 
        avgLng = -95; 
      }

      // build stationData entry
      stationData[stationCode] = {
        routes,
        stops,
        sequences,
        lat: avgLat,
        lng: avgLng,
        total_routes
      };

      // build a Level 1 aggregate record
      stationAggregates.push({
        station_code: stationCode,
        lat: avgLat,
        lng: avgLng,
        total_routes
      });
    } catch (err) {
      console.error(`Error loading data for station ${stationCode}:`, err);
      // We'll skip this station if there's an error
    }
  });

  // Wait for all stations
  await Promise.all(allPromises);

  return {
    stationAggregates,
    stationData
  };
}
