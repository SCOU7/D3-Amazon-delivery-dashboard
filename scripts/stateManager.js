// scripts/stateManager.js

const appState = {
  currentLevel: 1,       // (1: Nation, 2: Station, 3: Route)
  stations: [],          // array of { station_code, lat, lng, total_routes }
  selectedStation: null, // station code
  selectedRoute: null,   // route ID
  // filters, etc. in future milestones
};

/**
 * Updates the app level and UI label
 */
function setLevel(newLevel) {
  appState.currentLevel = newLevel;
  document.getElementById("currentLevelLabel").textContent =
    `${newLevel} ${newLevel === 1 ? '(Nation)' :
                 newLevel === 2 ? '(Station)' :
                 '(Route)'}`;
}
