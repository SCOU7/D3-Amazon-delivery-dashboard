// scripts/stateManager.js

const appState = {
  currentLevel: 1,
  stations: [],             // from loadAllStations (Level 1 aggregates)
  selectedStation: null,    // code (e.g. "DAU1")

  // These hold data for the "currently viewed" station in Level 2:
  stationRoutes: [],        // each item = { route_id, ... }
  stationStops: [],         // each item = { route_id, stop_id, lat, lng, ... }
  stationSequences: [],     // each item = { route_id, stop_id, sequence_order }

  selectedRoute: null,
  // In future milestones, we might also store route-level details, filters, etc.
};

function setLevel(newLevel) {
  appState.currentLevel = newLevel;
  document.getElementById("currentLevelLabel").textContent =
    `${newLevel} ${newLevel === 1 ? '(Nation)' :
                 newLevel === 2 ? '(Station)' :
                 '(Route)'}`;
}

/**
 * Clears station-level data from state, in case we go back to Level 1 or switch stations
 */
function clearStationData() {
  appState.stationRoutes = [];
  appState.stationStops = [];
  appState.stationSequences = [];
  appState.selectedStation = null;
}
