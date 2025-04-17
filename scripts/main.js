/* scripts/main.js */
import { preloadAllData }            from './dataLoader.js';
import { initMap }                   from './mapManager.js';
import { initializeFilters }         from './filterManager.js';
import { appState, setLevel,
         handleBackNavigation }      from './stateManager.js';

document.addEventListener("DOMContentLoaded", () => {
  /* ─ DOM refs ─ */
  const landingPage    = document.getElementById("landingPage");
  const appRoot        = document.getElementById("appRoot");
  const discoverBtn    = document.getElementById("discoverButton");
  const loadingStatus  = document.getElementById("loadingStatus");

  let dashboardBooted = false;

  /* ───────────── background preload ───────────── */
  async function loadEverything() {
    loadingStatus.textContent = "Loading data…";
    try {
      const { stationAggregates, stationData } = await preloadAllData();
      appState.stations    = stationAggregates;
      appState.stationData = stationData;

      loadingStatus.textContent = "Ready!";
      discoverBtn.disabled = false;
    } catch (err) {
      console.error("Preload failed:", err);
      loadingStatus.textContent = "Failed to load – refresh to retry.";
      discoverBtn.disabled = false;
      discoverBtn.textContent = "Reload";
      discoverBtn.addEventListener("click", () => location.reload(), { once:true });
    }
  }

  /* ───────────── boot the interactive dashboard ───────────── */
  function bootDashboard() {
    if (dashboardBooted) return;
    dashboardBooted = true;

    /* Reveal UI */
    landingPage.style.display = "none";
    appRoot.style.display     = "block";

    /* First‑time visualisation build */
    setLevel(1);              // also calls renderScatterPlot, updatePieCharts, initMap
    initializeFilters();

    /* Global controls */
    document.getElementById("backButton")
            .addEventListener("click", handleBackNavigation);

    document.getElementById("switchAxesButton")
            .addEventListener("click", () => {
              const ax = appState.scatterAxes;
              [ax.x, ax.y] = [ax.y, ax.x];
              // setLevel(…) already refreshes scatter; just re‑call manually:
              setLevel(appState.currentLevel);
            });
  }

  /* Button click -> boot (only when enabled) */
  discoverBtn.addEventListener("click", () => {
    if (!discoverBtn.disabled) bootDashboard();
  });

  /* Start preload immediately */
  loadEverything();
});
