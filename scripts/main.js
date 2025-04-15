// scripts/main.js

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Milestone #3: Station-level (Level 2) test started.");

  try {
    // 1) Load aggregated station data for Level 1
    const stationAggregates = await loadAllStations();
    appState.stations = stationAggregates;

    // 2) Set initial level to 1
    setLevel(1);

    // 3) Initialize the map
    initMap();

    console.log("Milestone #3 loaded. Click on any station circle to transition to Level 2!");
  } catch (err) {
    console.error("Error in main.js:", err);
  }
});
