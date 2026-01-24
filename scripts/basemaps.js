const basemaps = {
    imagery: {
        name: "Satellite Imagery",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        options: {
            minZoom: 0,
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }
    },
    watercolor: {
        name: "Watercolor",
        url: "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg",
        options: {
            minZoom: 1,
            maxZoom: 16,
            attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },
    terrain: {
        name: "Terrain",
        url: "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png",
        options: {
            minZoom: 0,
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },
    toner: {
        name: "Toner (B&W)",
        url: "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png",
        options: {
            minZoom: 0,
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },
    osm: {
        name: "OpenStreetMap",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        options: {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    }
};

function getBasemapLayer(basemapKey) {
    const basemap = basemaps[basemapKey];
    if (!basemap) {
        console.error(`Basemap "${basemapKey}" not found. Falling back to imagery.`);
        return getBasemapLayer('imagery');
    }
    return L.tileLayer(basemap.url, basemap.options);
}

function getBasemapKeys() {
    return Object.keys(basemaps);
}

function getBasemapName(basemapKey) {
    return basemaps[basemapKey]?.name || basemapKey;
}

function getMapPreset(key) {
  if (!mapPresets[key]) {
    console.warn(`Map preset "${key}" not found`);
    return null;
  }
  return mapPresets[key];
}

function populatePresetDropdown(selectElement) {
  if (!selectElement) return;

  selectElement.innerHTML = "";

  Object.entries(mapPresets).forEach(([key, preset]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = preset.title;
    selectElement.appendChild(option);
  });

  const option = document.createElement("option");
  option.value = "custom";
  option.textContent = "Custom";
  selectElement.appendChild(option);
}

const mapPresets = {
  "world": { title: "World", lat: 20, lng: 0, zoom: 2, basemap: "imagery" },
  "new-york": { title: "New York", lat: 40.7128, lng: -74.0060, zoom: 12, basemap: "imagery" },
  "portland": { title: "Portland", lat: 45.5152, lng: -122.6784, zoom: 12, basemap: "imagery" },
  "miami": { title: "Miami", lat: 25.7617, lng: -80.1918, zoom: 12, basemap: "imagery" },
  "los-angeles": { title: "Los Angeles", lat: 34.0522, lng: -118.2437, zoom: 11, basemap: "imagery" },
  "europe": { title: "Europe", lat: 54.526, lng: 15.2551, zoom: 4, basemap: "imagery" },
  "north-america": { title: "North America", lat: 54.526, lng: -105.2551, zoom: 3, basemap: "imagery" },
  "eurasia": { title: "Eurasia", lat: 50, lng: 60, zoom: 3, basemap: "imagery" },
  "north-africa": { title: "North Africa", lat: 28, lng: 10, zoom: 4, basemap: "imagery" },
  "brazil": { title: "Brazil", lat: -14.235, lng: -51.9253, zoom: 4, basemap: "imagery" },
  "south-america": { title: "South America", lat: -15, lng: -60, zoom: 3, basemap: "imagery" }
};
