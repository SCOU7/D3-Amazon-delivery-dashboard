// scripts/stateManager.js

const appState = {
  currentLevel: 1,
  stations: [],             // for Level 1 aggregates
  stationData: {},          // dictionary of stationCode -> { routes, stops, sequences, lat, lng, total_routes }

  selectedStation: null,
  stationRoutes: [],
  stationStops: [],
  stationSequences: [],

  selectedRoute: null
};

function setLevel(newLevel) {
  appState.currentLevel = newLevel;
  document.getElementById("currentLevelLabel").textContent =
    `${newLevel} ${newLevel === 1 ? '(Nation)' :
                 newLevel === 2 ? '(Station)' :
                 '(Route)'}`;
}

function clearStationData() {
  appState.stationRoutes = [];
  appState.stationStops = [];
  appState.stationSequences = [];
  appState.selectedStation = null;
}
