import { preloadAllData } from './dataLoader.js';
import { initMap } from './mapManager.js';
import { renderScatterPlot } from './scatterPlot.js';
import { updatePieCharts } from './pieCharts.js';
import { initializeFilters } from './filterManager.js';
import { appState, setLevel, handleBackNavigation } from './stateManager.js';

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Preloading all data for all stations...");

  try {
    const { stationAggregates, stationData } = await preloadAllData();
    appState.stations = stationAggregates;
    appState.stationData = stationData;

    renderScatterPlot();
    setLevel(1);
    initMap();
    initializeFilters();

    console.log("All station data preloaded. Found", appState.stations.length, "stations.");
  }
  catch (err) {
    console.error("Error during preloading:", err);
  }

  document.getElementById("backButton").addEventListener("click", () => {
    handleBackNavigation();
  });

  document.getElementById("switchAxesButton").addEventListener("click", () => {
    const ax = appState.scatterAxes;
    [ax.x, ax.y] = [ax.y, ax.x];
    renderScatterPlot();
  });
});