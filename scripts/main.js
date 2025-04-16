// scripts/main.js

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Preloading all data for all stations...");

  try {
    // 1) Preload everything
    const { stationAggregates, stationData } = await preloadAllData();

    // 2) Store them in state
    appState.stations = stationAggregates;
    appState.stationData = stationData;

    console.log("All station data preloaded. Found", appState.stations.length, "stations.");

    // 3) Set initial level and map
    setLevel(1);
    initMap();

    // 4) Initialize filter UI
    initializeFilters();

    console.log("Click a station circle to jump to Level 2 instantly!");
  }
  catch (err) {
    console.error("Error during preloading:", err);
  }

  // Back button logic
  const backBtn = document.getElementById("backButton");
  backBtn.addEventListener("click", () => {
    handleBackNavigation();
  });
});
