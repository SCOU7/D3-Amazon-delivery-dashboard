// scripts/dataLoader.js

const STATION_CODES = [
  "DAU1", "DBO1", "DBO2", "DBO3", "DCH1", "DCH2", "DCH3", "DCH4",
  "DLA3", "DLA4", "DLA5", "DLA7", "DLA8", "DLA9",
  "DSE2", "DSE4", "DSE5"
];

/**
 * preloadAllData():
 * Loads routes, stops, sequences, packages for each station.
 * Computes total_routes and approximates station location.
 */
async function preloadAllData() {
  const stationData = {};
  const stationAggregates = [];

  const allPromises = STATION_CODES.map(async (stationCode) => {
    try {
      const [routes, stops, sequences, packages] = await Promise.all([
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
        })),
        d3.csv(`processed_data/${stationCode}/packages.csv`, p => ({
          package_id: p.package_id,
          route_id: p.route_id,
          stop_id: p.stop_id,
          scan_status: p.scan_status,
          planned_service_time_seconds: +p.planned_service_time_seconds,
          time_window_start_utc: p.time_window_start_utc,
          time_window_end_utc: p.time_window_end_utc,
          depth_cm: +p.depth_cm,
          height_cm: +p.height_cm,
          width_cm: +p.width_cm
        }))
      ]);

      const total_routes = routes.length;
      let avgLat = 0, avgLng = 0;
      if (stops.length > 0) {
        stops.forEach(st => {
          avgLat += st.lat;
          avgLng += st.lng;
        });
        avgLat /= stops.length;
        avgLng /= stops.length;
      } else {
        avgLat = 39;
        avgLng = -95;
      }

      stationData[stationCode] = {
        routes,
        stops,
        sequences,
        packages,
        lat: avgLat,
        lng: avgLng,
        total_routes
      };

      stationAggregates.push({
        station_code: stationCode,
        lat: avgLat,
        lng: avgLng,
        total_routes
      });
    } catch (err) {
      console.error(`Error loading data for station ${stationCode}:`, err);
    }
  });

  await Promise.all(allPromises);
  return {
    stationAggregates,
    stationData
  };
}

/**
 * loadRouteTravelTimes(stationCode, route_id):
 * Reads travel_times/RouteID_xxx_travel_times.csv
 */
async function loadRouteTravelTimes(stationCode, route_id) {
  const filePath = `processed_data/${stationCode}/travel_times/${route_id}_travel_times.csv`;
  const raw = await d3.csv(filePath);

  const travelTimes = {};
  for (const row of raw) {
    const fromStop = row["from_stop"];
    travelTimes[fromStop] = {};
    for (const [key, val] of Object.entries(row)) {
      if (key === "from_stop") continue;
      travelTimes[fromStop][key] = +val;
    }
  }

  return travelTimes;
}
