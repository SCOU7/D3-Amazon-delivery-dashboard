// scripts/main.js

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Milestone #2 (Real Data): Loading station-level aggregates...");

  try {
    // 1) Load aggregated station data
    const stationAggregates = await loadAllStations();
    appState.stations = stationAggregates;
    console.log("Successfully loaded all station data:", stationAggregates);

    // 2) Set initial level to 1 (Nation)
    setLevel(1);

    // 3) Initialize the map
    initMap();

  } catch (err) {
    console.error("Error in main.js:", err);
  }
});
