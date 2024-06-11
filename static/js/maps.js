const toolsBoard = document.querySelector("#toolsBoard");
const collectionInput = document.getElementById('collection-upload');
const droneInput = document.getElementById('drone-slider');
const ndviInput = document.getElementById('ndvi-slider');
const rotationInput = document.getElementById('rotate-slider');

const canvas = document.querySelector("#test-canvas");
const context = canvas.getContext('2d');

const loadingSpinner = document.getElementById('loading-spinner');
const leftBelowContainer = document.querySelector('.left-below-container');
const rightBelowContainer = document.querySelector('.right-below-container');
const table = document.getElementById('customers-table');
const checkbox = document.getElementById('statsCheckbox');
const statistics = document.querySelector('.table-container');

let map;
let latitudeInput = 41.40236643338575;
let longitudeInput = 2.151736768394448;
let drone_opacity = 0.5;
let ndvi_opacity = 0.5;
let colorMap;

document.getElementById('drone-slider').value = drone_opacity;
toolsBoard.style.pointerEvents = "auto";
toolsBoard.style.display = "block";
checkbox.checked = false; 

generate_sat();

droneInput.addEventListener("input", function() {
  drone_opacity = parseFloat(this.value);
  set_opacity(drone_opacity);
});

ndviInput.addEventListener("input", function() {
  ndvi_opacity = parseFloat(this.value);
});

rotationInput.addEventListener('input', function () {
  var rotationDegrees = parseFloat(rotationInput.value);
  var  rotationRadians = ol.math.toRadians(rotationDegrees);
  map.getView().setRotation(rotationRadians);
});

checkbox.addEventListener('change', function() {
  if (this.checked) {
      table.style.display = 'block';
      statistics.style.zIndex = "2";
  } else {
      table.style.display = 'none';
      statistics.style.zIndex = "0";
  }
});

document.getElementById('toolsBoard').querySelector('.options').addEventListener('click', function (event) {
  let id = null;
  if (event.target.id) {
      // If the click occurred directly on the drone or slider, capture their respective ids
      id = event.target.id;
  } else {
      // If the click occurred on a child element of drone or slider, find their parent div id
      const parentNode = event.target.closest('.option');
      if (parentNode) {
          id = parentNode.id;
      }
  }
  if (id) {
      const activeElement = document.querySelector('.options .active');
      if (activeElement) {
          activeElement.classList.remove('active');
      }
      // Add 'active' class to clicked element
      const btn = document.getElementById(id);
      btn.classList.add('active');
      // Set selectedTool to the id of the clicked element
      selectedTool = id;
  } 
  
  selectedTool = id;

  if (selectedTool === "drone") {
    loadCollection();

  } else if (selectedTool === "ndvi") {
    console.log("ndvi");
  } else if (selectedTool === "clean") {
    // Clean table
    for (let i = table.rows.length - 1; i > 0; i--) {
      table.deleteRow(i);
    }
    // Clean layer on the map
    map.getLayers().forEach(function (layer) {
      if (layer instanceof ol.layer.Image) {
        map.removeLayer(layer);
      }
    });
  }
});

function set_opacity(opacity){
  map.getLayers().forEach(function (layer) {
    if (layer instanceof ol.layer.Image) {
      layer.setOpacity(opacity);
    }
  });
}

function generate_sat(){

  // Check if the map already exists
  if (!map) {

    var zoomIni = 19;
    if (latitudeInput === 41.40236643338575) {
      zoomIni = 5;
    }

    // Create a new OpenLayers map only if it doesn't exist
    map = new ol.Map({
      target: 'map',
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM(),
        }),
      ],
      controls: ol.control.defaults({
        zoom: false,
        attribution: false,
        rotate: false
      }),
      view: new ol.View({
        center: ol.proj.fromLonLat([longitudeInput, latitudeInput]),
        zoom: zoomIni,
      }),
    });

    // Add Google Satellite layer
    var googleSat = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        maxZoom: 24,
      }),
    });
    map.addLayer(googleSat);

    // Create a vector source for drawing features
    var source = new ol.source.Vector({ wrapX: false });

    // Create a vector layer using the vector source
    var vector = new ol.layer.Vector({
      source: source,
    });

    // Add the vector layer to the map
    map.addLayer(vector);

  } else {
    // If the map already exists, update its view
    map.getView().setCenter(ol.proj.fromLonLat([longitudeInput, latitudeInput]));
  }
}

function loadCollection() {

  collectionInput.onchange = function (e) {
    const files = e.target.files;
    const formData = new FormData(); 

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        formData.append('images', file); // Append each file to the FormData object
    }
    
    loadingSpinner.style.display = 'block';
    
    fetch('/input_map', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(response.status);
      }
      return response.json();
    })
    .then(responseData => {
      // Extract image and coordinates from the responseData
      const img_str = responseData.image;
      const new_coord = responseData.new_coord;
      const info = responseData.info;
      plot_table(info);
      // Create a new image element and set its source to the processed image data URI
      var image_tmp2 = new Image();
      image_tmp2.src = 'data:image/png;base64,' + img_str;

      // Wait for the image to load
      image_tmp2.onload = () => {
        // Create a new layer to display the processed image as an overlay
        var canvasLayer = new ol.layer.Image({
          source: new ol.source.ImageStatic({
            url: image_tmp2.src, // Use the processmage as the source
            imageExtent: [
              new_coord[0],
              new_coord[1],
              new_coord[0] + new_coord[2],
              new_coord[1] + new_coord[3],
            ],
            projection: 'EPSG:3857',
          }),
          opacity: 0.5,
        });
        // Add the canvasLayer to the map
        map.addLayer(canvasLayer);
        map.getView().fit([new_coord[0], new_coord[1], new_coord[0] + new_coord[2], new_coord[1] + new_coord[3]], { size: map.getSize(), padding: [10, 10, 10, 10], maxZoom: 17 });
      };
      loadingSpinner.style.display = 'none';
    })
    .catch(error => {
      console.error('Network error:', error.message);
      window.alert("Error input data");
      loadingSpinner.style.display = 'none';
    });
  };
  collectionInput.click();
}

function plot_table(summaryString)  {

  const summary = JSON.parse(summaryString);
  for (let i = table.rows.length - 1; i > 0; i--) {
    table.deleteRow(i);
  }
  
  let i = 0;
  for (const type in summary) {
    const entry = summary[type];
    const newRow = table.insertRow();
    
    const typeCell = newRow.insertCell();
    typeCell.textContent = type;

    const percentageCell  = newRow.insertCell();
    percentageCell.textContent = entry.totalArea.toFixed(2);
    
    const numberTreesCell = newRow.insertCell();
    numberTreesCell.textContent = entry.count;
  
    i++;
  }
}
