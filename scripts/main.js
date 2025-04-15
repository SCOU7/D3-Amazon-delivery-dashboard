// scripts/main.js

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Preloading all data for all stations...");

  try {
    // 1) Preload everything
    const { stationAggregates, stationData } = await preloadAllData();

    // 2) Store them in state
    appState.stations = stationAggregates;      // Level 1 aggregates
    appState.stationData = stationData;         // Full details for each station

    console.log("All station data preloaded. Found", appState.stations.length, "stations.");

    // 3) Set initial level to 1 and init map
    setLevel(1);
    initMap();

    console.log("Click a station circle to jump to Level 2 instantly!");
  }
  catch (err) {
    console.error("Error during preloading:", err);
  }
});
