const toolsBoard = document.querySelector("#toolsBoard");
const toolsBoard2 = document.querySelector("#toolsBoard2");
const container = document.querySelector('.left-container');
const fileInput = document.getElementById('image-upload');
const collectionInput = document.getElementById('collection-upload');
const videoInput = document.getElementById('video-upload');
const canvas_org = document.querySelector("#image_org");
const canvas0 = document.querySelector("#image");
const canvas1 = document.querySelector("#drawing-canvas");
const canvas2 = document.querySelector("#label-canvas");
const map_org = document.querySelector("#map");
const map_group = document.querySelector(".map-group");

var checkbox = document.getElementById("checkbox_stats");

const cake = document.getElementById('cake');
const table = document.getElementById('customers-table');

// real image from the right and from the left
const ctx_org = canvas_org.getContext('2d');
const ctx0 = canvas0.getContext('2d');
const ctx1 = canvas1.getContext("2d");
const ctx2 = canvas2.getContext("2d");

// temporal drawing helper for the zoom
const canvas1_tmp = document.createElement("canvas")
const ctx1_tmp = canvas1_tmp.getContext("2d");

const loadingSpinner = document.getElementById('loading-spinner');
const framesVideo = document.getElementById("framesVideo");
const resolutionImage = document.getElementById("resolutionImage");
const resolutionSegmentation = document.getElementById("resolutionSegmentation");
const thresholdValue = document.getElementById("threshold-value");
const thresholdInput = document.getElementById("threshold");
const rotationInput = document.getElementById('rotation');

const maxFileCount = 50;
const sensitivity = 0.1; 

sizeSlider = document.querySelector("#size-slider");
thresholdSlider = document.querySelector("#threshold");
circleMask = document.querySelector('#color-picker-mask');
circleLabel = document.querySelector('#color-picker-label');
optionsList = document.querySelector(".options");

sizeSlider.value = 5;
checkbox.checked = false;
default_settings();

// global variables with default value
let isDrawing = false;
let isMousePressed = false;
let selectedTool = "brush";
let selectedColor = "rgb(74, 152, 247)";
let selectedColorLabel = "rgb(255, 255, 255)";
let brushWidth = 5;
let frequentColorsMask = [];
let frequentColorsLabels = [];
let mask2label = {};
let originalImageWidth = 0;
let originalImageHeight = 0;
let reload = 0;
let previousLabel = false;
let imageMask;
let imageLabel;
// Initialize translation values
let translateX = 0;
let translateY = 0;
// Initialize mouse coordinates
let previousX = 0;
let previousY = 0;
let isZoom = false; 
let zoomFactor = 1;
let newWidth, newHeight;
let image_tmp = new Image();
let image_tmp2 = new Image();
let strokes = [];
let names = ["Name1", "Name2", "Name3", "Name4"];
let colors = ["rgb(255, 127, 127)","rgb(193, 154, 107)","rgb(152, 251, 152)","rgb(252, 238, 167)"];
let map;
let rotationRadians = 0;
let latitudeInput;
let longitudeInput;
let coordinates_points = [
  { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(74, 152, 247)'},
  { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(255, 127, 127)'},
  { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(152, 251, 152)'}
];
let save_map = false;

function default_settings(){
  framesVideo.value = 2;
  resolutionImage.value = 0.5;
  resolutionSegmentation.value = 0.5;
  thresholdSlider.value = 0.7;
}

function startDrawing(event) {

  if (event.button === 0 && isZoom) {
    previousX = event.clientX;
    previousY = event.clientY;
    isMousePressed = true;
    return;
  }

  const rect = canvas1.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const pixel = ctx1.getImageData(x, y, 1, 1).data;
  const pixel2 = ctx2.getImageData(x, y, 1, 1).data;

  const rgbValues = selectedColor.substring(4, selectedColor.length - 1).split(', ').join(',');

  if (!mask2label.hasOwnProperty(rgbValues)){
    selectedColorLabel = "rgb(255, 255, 255)";
  }

  if (event.button === 0) { 
    
    ctx1.beginPath();
    ctx1.lineWidth = brushWidth*zoomFactor;
    ctx1.strokeStyle = selectedColor;
    ctx1.fillStyle = selectedColor;
    
    ctx2.beginPath();
    ctx2.lineWidth = brushWidth;
    ctx2.strokeStyle = selectedColorLabel;
    ctx2.fillStyle = selectedColorLabel;

    if (selectedTool === "bucket") {

      let pixel_tmp = pixel.slice(0, 3);
      if (pixel_tmp[0] !== 0 || pixel_tmp[1] !== 0 || pixel_tmp[2] !== 0) {
        analyzeCanvas(ctx1, canvas1, frequentColorsMask);
        bucketCanvas(pixel_tmp, x, y);
      }
      // Copy the content of ctx1 to ctx1_tmp
      ctx1_tmp.drawImage(canvas1, 0, 0);
      
    } else {
      if (selectedTool === "eraser") {
        ctx1.strokeStyle = "rgb(0, 0, 0)";
        ctx1.fillStyle = "rgb(0, 0, 0)";
        ctx2.strokeStyle = "rgb(0, 0, 0)";
        ctx2.fillStyle = "rgb(0, 0, 0)";
      }
      isMousePressed = true;
      drawOnCanvas1(event);
    }
  } else if (event.button === 2) { // Right mouse button is pressed
    if (!(pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0)) {
      event.preventDefault(); // Prevent the default context menu
      selectedColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      circleMask.style.backgroundColor = selectedColor;
      selectedColorLabel = `rgb(${pixel2[0]}, ${pixel2[1]}, ${pixel2[2]})`;
    }
  }
}

function stopDrawing() {
  if (!isZoom && isDrawing){
    strokes.push({ x: -1, y: -1});
  }
  isMousePressed = false;
}

function drawOnCanvas1(event) {
  if (isZoom){
    zoomApply(event)
    return;
  }
  if (!isDrawing || !isMousePressed) return;
  ctx1.lineTo(event.offsetX, event.offsetY);
  ctx1.stroke();
  ctx2.lineTo((event.offsetX-translateX)/zoomFactor, (event.offsetY-translateY)/zoomFactor);
  ctx2.stroke();

  if (selectedTool === "eraser") {
    strokes.push({ tickness: brushWidth, color: "rgb(0, 0, 0)", x: (event.offsetX-translateX)/zoomFactor, y: (event.offsetY-translateY)/zoomFactor});  
  }else{
    strokes.push({ tickness: brushWidth, color: selectedColor, x: (event.offsetX-translateX)/zoomFactor, y: (event.offsetY-translateY)/zoomFactor});
  }
}

function setDrawingColor(event) {
  const rect = canvas1.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const pixel = ctx1.getImageData(x, y, 1, 1).data;
  selectedColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
  circleMask.style.backgroundColor = selectedColor;
}

function labelOnCanvas2(event) {
  if (event.button === 0) {
    const rect = canvas2.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pixel = ctx1.getImageData(x, y, 1, 1).data.slice(0, 3);   
    const pixel2 = ctx2.getImageData(x, y, 1, 1).data.slice(0, 3);  

    // Extract the RGB values from the selectedColor_tmp string
    const rgbValues = selectedColorLabel.match(/\d+/g);
    // Avoid repaiting with same color
    const isEqual = rgbValues.every((value, index) => parseInt(value) === pixel2[index]);

    // Code to execute if the pixel is not black
    if (!(pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) && !isEqual){
      reload++;
      if (reload === 1){
        analyzeCanvas(ctx1, canvas1, frequentColorsMask);
        analyzeCanvas(ctx2, canvas2, frequentColorsLabels);

      }
      const imageMask = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
      const imageLabel = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);

      const data = imageMask.data;
      const data2 = imageLabel.data;

      mask2label[pixel] = rgbValues;

      let colorCount = {};
      var totalPixels = data.length / 4; 

      // Loop through each pixel and convert it to binary
      for (let i = 0; i < data.length; i += 4) {

        const tmp = [data[i], data[i+1], data[i+2]];   

        if (mask2label.hasOwnProperty(tmp)) {
          const pixelValues = mask2label[tmp];
          data2[i] = pixelValues[0];
          data2[i + 1] = pixelValues[1];
          data2[i + 2] = pixelValues[2];
          // Increment the count for the color
          const numericArray = pixelValues.map(value  => parseInt(value , 10));
          const resultString = "[" + numericArray.join(",") + "]";
          colorCount[resultString] = (colorCount[resultString] || 0) + 1;

        } else if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0){
          data2[i] = 0;
          data2[i + 1] = 0;
          data2[i + 2] = 0;
          // Increment the count for the color [0, 0, 0]
          const colorKey = JSON.stringify([0,0,0]);
          colorCount[colorKey] = (colorCount[colorKey] || 0) + 1;

        } else{
          data2[i] = 255;
          data2[i + 1] = 255;
          data2[i + 2] = 255;
          // Increment the count for the color [255, 255, 255]
          const colorKey = JSON.stringify([255,255,255]);
          colorCount[colorKey] = (colorCount[colorKey] || 0) + 1;
        }
      }

      // Put the modified pixel data back to the canvas
      ctx2.putImageData(imageLabel, 0, 0);
      if (checkbox.checked) {
        updateCoverage();
      }
    }
  }
}

function wheelZoom(event) {
  if (isZoom) {
    // Calculate the new zoom factor based on the mouse wheel delta
    var change = Math.sign(event.deltaY);
    if (change < 0){
        translateX = 0;
        translateY = 0;
    }
    zoomFactor += change// Increment or decrement by 1
    // Limit zooming to a reasonable range (e.g., between 1 and 5)
    zoomFactor = Math.min(Math.max(zoomFactor, 1), 5);
    zoomDrawCanvas();
  }
}

function zoomDrawCanvas() {
  ctx0.clearRect(0, 0, newWidth, newHeight);
  ctx0.save();
  ctx0.translate(translateX, translateY);
  ctx0.scale(zoomFactor, zoomFactor);
  ctx0.drawImage(image_tmp, 0, 0, newWidth, newHeight);
  ctx0.restore();

  ctx1.clearRect(0, 0, newWidth, newHeight);
  ctx1.save();
  ctx1.translate(translateX, translateY);
  ctx1.scale(zoomFactor, zoomFactor);
  ctx1.drawImage(canvas1_tmp, 0, 0);
  ctx1.restore();

  ctx1.beginPath();
  
  for (let i = 0; i < strokes.length; i++) {
    ctx1.lineWidth = strokes[i].tickness*zoomFactor;
    ctx1.strokeStyle = strokes[i].color;
    ctx1.fillStyle = strokes[i].color;
    if (strokes[i].x === -1 && strokes[i].y === -1) {
      ctx1.beginPath();
      continue;
    }
    // Calculate the adjusted coordinates
    const adjustedX = (strokes[i].x * zoomFactor) + translateX;
    const adjustedY = (strokes[i].y * zoomFactor) + translateY;
    ctx1.lineTo(adjustedX, adjustedY);
    ctx1.stroke();
  }
}

function zoomApply(event) {
  if (isMousePressed && zoomFactor > 1) {
    translateX += (event.clientX - previousX) * sensitivity;
    translateY += (event.clientY - previousY) * sensitivity;
    if (translateX > 0 && translateY > 0){
      translateX -= (event.clientX - previousX) * sensitivity;
      translateY -= (event.clientY - previousY) * sensitivity;
    }else if (translateX > 0 ){
      translateX -= (event.clientX - previousX) * sensitivity;
    }else if (translateY > 0 ){
      translateY -= (event.clientY - previousY) * sensitivity;
    }
    if (translateX < -1* newWidth*(zoomFactor-1) && translateY < -1* newHeight*(zoomFactor-1)){
      translateX -= (event.clientX - previousX) * sensitivity;
      translateY -= (event.clientY - previousY) * sensitivity;
    }else if (translateX < -1* newWidth*(zoomFactor-1)){
      translateX -= (event.clientX - previousX) * sensitivity;
    }else if (translateY < -1* newHeight*(zoomFactor-1)){
      translateY -= (event.clientY - previousY) * sensitivity;
    }
    zoomDrawCanvas();  
  }
}

function generateNewButton(name, color) {

  var num_buttons = document.querySelectorAll('[id^="label_"]').length
  if (num_buttons % 2 === 0) {
    var liElement = document.createElement("li");
    liElement.className = "option";
    liElement.id = "label" + num_buttons;
  } else {
    // Get the last list item
    var liElements = document.querySelectorAll('#toolsBoard .option');
    var liElement = liElements[liElements.length - 1];
  }

  var newButton = document.createElement("button");
  newButton.style.backgroundColor = color;
  newButton.id = 'label_' + num_buttons;
  newButton.className = "generated-button";
  newButton.textContent = name; 
  newButton.addEventListener("dblclick", function() {
      var newName = prompt("Enter a new name:");
      if (newName !== null) {
        var buttonText = newButton.textContent;
        var index = names.indexOf(buttonText);
        if (index !== -1) {
            names[index] = newName;
            newButton.textContent = newName;
        }
        updateCoverage();
      }
  });

  var rgbValues = color.match(/\d+/g).map(Number);
  frequentColorsLabels.push([rgbValues[0], rgbValues[1], rgbValues[2]]);
  liElement.appendChild(newButton);
  optionsList.appendChild(liElement);

}

function moveOnCanvas0(event) {
  if (isZoom){
    zoomApply(event)
    return;
  }
}

function drawSelectedPoint() {
  ctx0.clearRect(0, 0, newWidth, newHeight);
  ctx0.drawImage(image_tmp, 0, 0, newWidth, newHeight);
  for (var i = 0; i < coordinates_points.length; i++) {
    // Draw a point at the specified coordinates
    ctx0.beginPath();
    ctx0.arc(coordinates_points[i].x1, coordinates_points[i].y1, 5, 0, 2 * Math.PI);
    ctx0.fillStyle = coordinates_points[i].color; // Set the fill color of the point
    ctx0.fill();
    ctx0.closePath();
  }
}

function getPoints(event) {
  if (event.button === 0) { 
    if (isZoom){ 
      previousX = event.clientX;
      previousY = event.clientY;
      isMousePressed = true;
      return;
    } else if(selectedTool !== "raw") {
      const rect = canvas0.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (selectedTool === "point1") {
        coordinates_points[0].x1 = x;
        coordinates_points[0].y1 = y;
      } else if (selectedTool === "point2") {
        coordinates_points[1].x1 = x;
        coordinates_points[1].y1 = y;
      } else if (selectedTool === "point3") {
        coordinates_points[2].x1 = x;
        coordinates_points[2].y1 = y;
      }
      drawSelectedPoint();
    }
  }
}

// Attach mousedown event listener to canvas0
canvas0.addEventListener('mousedown', getPoints);

// Attach mousedown event listener to canvas1
canvas1.addEventListener('mousedown', startDrawing);

// Attach mousedown event listener to canvas2
canvas2.addEventListener('mousedown', labelOnCanvas2);

// Attach mousemove event listener to canvas0
canvas0.addEventListener('mousemove', moveOnCanvas0);

// Attach mousemove event listener to canvas1
canvas1.addEventListener('mousemove', drawOnCanvas1);

// Prevent the default context menu on canvas_org
canvas_org.addEventListener('contextmenu', function (event) {
  event.preventDefault();
});

// Prevent the default context menu on canvas0
canvas0.addEventListener('contextmenu', function (event) {
  event.preventDefault();
});

// Prevent the default context menu on canvas1
canvas1.addEventListener('contextmenu', function (event) {
  event.preventDefault();
});

// Prevent the default context menu on canvas2
canvas2.addEventListener('contextmenu', function (event) {
  event.preventDefault();
});

// Attach mouseup event listener to stop drawing when the mouse is released
document.addEventListener('mouseup', stopDrawing);

// Mouse wheel event listener
document.addEventListener('wheel', wheelZoom);

// Add a click event listener to the "Generate Button" to create a new button
document.getElementById("generateButton").addEventListener("click", function() {
  var buttonIndex = document.querySelectorAll(".generated-button").length -1;
  if (buttonIndex < names.length) {
      generateNewButton(names[buttonIndex], colors[buttonIndex]);
  }
});

// Passing slider value as brushSize
sizeSlider.addEventListener("change", () => brushWidth = sizeSlider.value);

// Update the displayed value when the threshold value changes
thresholdInput.addEventListener("input", function() {
  var currentThreshold = thresholdInput.value;
  thresholdValue.textContent = currentThreshold;
});

// Rotation of map satelite
rotationInput.addEventListener('input', function () {
  var rotationDegrees = parseFloat(rotationInput.value);
  rotationRadians = ol.math.toRadians(rotationDegrees);
  map.getView().setRotation(rotationRadians);
});

// Display statistics
checkbox.addEventListener("change", function() {
  if (this.checked) {
      table.style.display = 'block';
      cake.style.display = 'block';
      canvas_org.style.display = 'none';
      updateCoverage();
  } else {
      table.style.display = 'none';
      cake.style.display = 'none';
      canvas_org.style.display = 'block';
  }
});


// Handle clicks on the options in toolsBoard2
document.getElementById('toolsBoard2').querySelector('.options').addEventListener('click', function (event) {
  const btn = event.target.closest('.option'); // Find the closest ancestor with class 'option'
  if (!btn || !btn.id) return; // If the click didn't occur on a button, do nothing

  const activeElement = document.querySelector('.options .active');
  if (activeElement) {
    activeElement.classList.remove('active');
  }

  btn.classList.add('active');
  selectedTool = btn.id;

  if (selectedTool.startsWith("point")){
    // Disable the default interactions for zooming and panning (move)
    map.getInteractions().forEach(function(interaction) {
      if (interaction instanceof ol.interaction.DragPan || interaction instanceof ol.interaction.MouseWheelZoom || interaction instanceof ol.interaction.PinchZoom) {
          interaction.setActive(false);
      }
    });
    rotationInput.style.display = "none";
  } else if (selectedTool === "export") {
    // Clean layer on the map
    map.getLayers().forEach(function (layer) {
      if (layer instanceof ol.layer.Image) {
        map.removeLayer(layer);
      }
    });
    exportToMap();
    // Clean the selected points
    ctx0.clearRect(0, 0, newWidth, newHeight);
    ctx0.drawImage(image_tmp, 0, 0, newWidth, newHeight);
    // Enable the default interactions for zooming and panning (move)
    map.getInteractions().forEach(function(interaction) {
      if (interaction instanceof ol.interaction.DragPan || interaction instanceof ol.interaction.MouseWheelZoom || interaction instanceof ol.interaction.PinchZoom) {
          interaction.setActive(true);
      }
    });
    save_map = true;
    rotationInput.style.display = "block";
  } else if (selectedTool === "clean") {
    // Clean layer on the map
    const layers = map.getLayers().getArray().slice();
    layers.forEach(function (layer) {
      if (layer instanceof ol.layer.Image) {
        map.removeLayer(layer);
      }
      if (layer instanceof ol.layer.Vector) {
        map.removeLayer(layer);
      }
    });
    // Clean the selected points
    coordinates_points = [
      { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(74, 152, 247)'},
      { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(255, 127, 127)'},
      { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(152, 251, 152)'}
    ];
    ctx0.clearRect(0, 0, newWidth, newHeight);
    ctx0.drawImage(image_tmp, 0, 0, newWidth, newHeight);
    // Enable the default interactions for zooming and panning (move)
    map.getInteractions().forEach(function(interaction) {
      if (interaction instanceof ol.interaction.DragPan || interaction instanceof ol.interaction.MouseWheelZoom || interaction instanceof ol.interaction.PinchZoom) {
          interaction.setActive(true);
      }
    });
    rotationInput.style.display = "block";
    save_map = false;

  } else if (selectedTool === "save") {
    if (save_map === true){
      saveMap();
    }
  } else if (selectedTool === "back") {
    // Clean layer on the map
    const layers = map.getLayers().getArray().slice();
    layers.forEach(function (layer) {
      if (layer instanceof ol.layer.Image) {
        map.removeLayer(layer);
      }
      if (layer instanceof ol.layer.Vector) {
        map.removeLayer(layer);
      }
    });
    // Enable the default interactions for zooming and panning (move)
    map.getInteractions().forEach(function(interaction) {
      if (interaction instanceof ol.interaction.DragPan || interaction instanceof ol.interaction.MouseWheelZoom || interaction instanceof ol.interaction.PinchZoom) {
          interaction.setActive(true);
      }
    });
    rotationInput.style.display = "block";
    save_map = false;
    coordinates_points = [
      { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(74, 152, 247)'},
      { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(255, 127, 127)'},
      { x1: 0, x2: 0, x22: 0, y1: 0, y2: 0, y22: 0, color: 'rgb(152, 251, 152)'}
    ];
    ctx0.clearRect(0, 0, newWidth, newHeight);
    ctx0.drawImage(image_tmp, 0, 0, newWidth, newHeight);
    toolsBoard.style.pointerEvents = "auto";
    toolsBoard2.style.pointerEvents = "none";
    toolsBoard.style.display = "block";
    toolsBoard2.style.display = "none";
    table.style.display = 'block';
    cake.style.display = 'block';
    const labelBtn = document.getElementById("brush");
    labelBtn.click();
  }
});

// Handle clicks on the options in toolsBoard
document.getElementById('toolsBoard').querySelector('.options').addEventListener('click', function (event) {
  const btn = event.target.closest('.option'); // Find the closest ancestor with class 'option'
  if (!btn || !btn.id) return; // If the click didn't occur on a button, do nothing

  const activeElement = document.querySelector('.options .active');
  if (activeElement) {
    activeElement.classList.remove('active');
  }

  btn.classList.add('active');
  selectedTool = btn.id;
  isZoom = false;

  map_group.style.display = "none";
  canvas_org.style.display = 'block';
  table.style.display = 'none';
  cake.style.display = 'none';

  if (selectedTool === "zoom") {
    if (previousLabel){
      canvas0.style.display = "block"; 
      canvas1.style.display = 'block';
      canvas2.style.display = 'none';
      canvas1.style.opacity = 0.5;
      previousLabel = false;
    }
    isZoom = true;

  } else if (selectedTool === "brush") {
    canvas0.style.display = "block"; 
    canvas1.style.display = 'block';
    canvas2.style.display = 'none';
    canvas1.style.opacity = 0.5;
    isDrawing = true;
    reload = 0;

  } else if (selectedTool === "bucket") {
    canvas0.style.display = "block"; 
    canvas1.style.display = 'block';
    canvas2.style.display = 'none';
    canvas1.style.opacity = 0.5;
    isDrawing = true;
    // when bucket is seleted we go back to the orignl size
    translateX = 0;
    translateY = 0;
    zoomFactor = 1;
    zoomDrawCanvas()

  } else if (selectedTool === "eraser") {
    canvas0.style.display = "block"; 
    canvas1.style.display = 'block';
    canvas2.style.display = 'none';
    canvas1.style.opacity = 0.5;
    isDrawing = true;
    reload = 0;

  } else if (selectedTool === "raw") {
    canvas0.style.display = "block"; 
    canvas1.style.display = 'none';
    canvas2.style.display = 'none';
    isDrawing = false;

  } else if (selectedTool === "mask") {
    canvas0.style.display = "none"; 
    canvas1.style.display = 'block';
    canvas2.style.display = 'none';
    canvas1.style.opacity = 1;
    isDrawing = true;

  } else if (selectedTool === "addMask") {
    new_mask_color = generateUniqueRandomColor();
    selectedColor = new_mask_color;
    selectedColorLabel = "rgb(255, 255, 255)";
    circleMask.style.backgroundColor = selectedColor;
    const rgbValues = new_mask_color.match(/\d+/g);
    const numbersArray = rgbValues.map(value => parseInt(value, 10));
    frequentColorsMask.push(numbersArray);
    const brushBtn = document.getElementById("brush");
    brushBtn.click();

  } else if (selectedTool === "satelite") {
    toolsBoard.style.pointerEvents = "none";
    toolsBoard2.style.pointerEvents = "auto";
    toolsBoard.style.display = "none";
    toolsBoard2.style.display = "block";
    map_group.style.display = "block";
    canvas_org.style.display = 'none';
    canvas0.style.display = "block"; 
    canvas1.style.display = 'none';
    canvas2.style.display = 'none';
    generate_sat();
  }else if (selectedTool.startsWith("label") || (selectedTool === "stats")) {
    canvas0.style.display = "block"; 
    canvas1.style.display = 'none';
    canvas2.style.display = 'block';
    if (checkbox.checked) {
        table.style.display = 'block';
        cake.style.display = 'block';
        canvas_org.style.display = 'none';
    }

    isDrawing = false;
    previousLabel = true;
    translateX = 0;
    translateY = 0;
    zoomFactor = 1;
    zoomDrawCanvas();
    analyzeCanvas(ctx1, canvas1, frequentColorsMask);
    analyzeCanvas(ctx2, canvas2, frequentColorsLabels);

    if (selectedTool !=="label"){
      if (event.target.style.backgroundColor !== ''){
        selectedColorLabel = event.target.style.backgroundColor;
        circleLabel.style.backgroundColor = selectedColorLabel;
      }
    }
  }
});

function loadImage() {
  toolsBoard.style.pointerEvents = "none";
  toolsBoard2.style.pointerEvents = "none";

  fileInput.onchange = function (e) {
    const files = e.target.files;
    const formData = new FormData();

    formData.append('images', files[0]);
    // Add a flag to the FormData object
    formData.append('flag', 'single');
    formData.append('resolutionImage', resolutionImage.value);

    loadingSpinner.style.display = 'block';
    loadInput(formData);
  };
  fileInput.click();
}

function loadCollection() {
  toolsBoard.style.pointerEvents = "none";
  toolsBoard2.style.pointerEvents = "none";

  // Hide class options if we load a new image
  document.getElementById("label").style.display = "none";
  document.getElementById("label_gen").style.display = "none";
  document.getElementById("label_other").style.display = "none";

  collectionInput.onchange = function (e) {
    const files = e.target.files;
    const formData = new FormData(); 

    if (files.length > maxFileCount) {
        alert(`You can select up to ${maxFileCount} files.`);
        return;
    }
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        formData.append('images', file); // Append each file to the FormData object
    }
    // Add a flag to the FormData object
    formData.append('flag', 'maps');
    formData.append('resolutionImage', resolutionImage.value);
    
    loadingSpinner.style.display = 'block';
    loadInput(formData);
  };
  collectionInput.click();
}

function loadVideo() {
  toolsBoard.style.pointerEvents = "none";
  toolsBoard2.style.pointerEvents = "none";

  videoInput.onchange = function (e) {
    const files = e.target.files;
    const formData = new FormData();
    formData.append('images', files[0]);
    formData.append('flag', 'video');
    formData.append('resolutionImage', resolutionImage.value);
    formData.append('framesVideo', framesVideo.value);
    
    loadingSpinner.style.display = 'block';
    loadInput(formData);
  };
  videoInput.click();
}

function loadInput(formData) {
  // Send the FormData to the server
  fetch('/input', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json()) // Assuming the server returns a JSON object
  .then(data => {
    const { coordinates, image_data } = data;

    // Create a new image element and set its source to the processed image data URI
    image_tmp.src = 'data:image/png;base64,' + image_data;

    // Clean canvas
    ctx0.clearRect(0, 0, canvas0.width, canvas0.height);
    ctx1.clearRect(0, 0, canvas0.width, canvas0.height);   
    ctx2.clearRect(0, 0, canvas0.width, canvas0.height); 
    ctx_org.clearRect(0, 0, canvas0.width, canvas0.height); 
    ctx1_tmp.clearRect(0, 0, canvas0.width, canvas0.height); 

    // Use the coordinates as needed
    const [latitude, longitude] = coordinates;
    latitudeInput = latitude;
    longitudeInput = longitude;

    // Wait for the image to load
    image_tmp.onload = () => {
      // Save original size
      originalImageWidth = image_tmp.width/resolutionImage.value;
      originalImageHeight = image_tmp.height/resolutionImage.value;

      // Calculate the aspect ratio
      const imgWidth = image_tmp.width;
      const imgHeight = image_tmp.height;
      const aspectRatio = imgWidth / imgHeight;

      // Get the container dimensions
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (containerWidth / containerHeight > aspectRatio) {
        newWidth = containerHeight * aspectRatio;
        newHeight = containerHeight;
      } else {
        newWidth = containerWidth;
        newHeight = containerWidth / aspectRatio;
      }

      // Update the background image source and dimensions
      canvas_org.width = newWidth;
      canvas_org.height = newHeight;
      ctx_org.clearRect(0, 0, newWidth, newHeight);
      ctx_org.drawImage(image_tmp, 0, 0, newWidth, newHeight);

      canvas0.width = newWidth;
      canvas0.height = newHeight;
      ctx0.clearRect(0, 0, newWidth, newHeight);
      ctx0.drawImage(image_tmp, 0, 0, newWidth, newHeight);

      changeBlockedStyles("masks", true);
      changeBlockedStyles("classes", false);
    };
    loadingSpinner.style.display = 'none';
  })
  .catch(error => {
    console.error('Network error:', error.message);
    window.alert("Error input data");
    loadingSpinner.style.display = 'none';
});
}

function loadMask() {
  toolsBoard.style.pointerEvents = "auto";
  toolsBoard2.style.pointerEvents = "none";
  
  fileInput.onchange = function(e) {
    const file = e.target.files[0];
    const reader = new FileReader();

    loadingSpinner.style.display = 'block';

    // Get the dimensions of the context (canvas)
    const contextWidth = canvas0.width;
    const contextHeight = canvas0.height;

    reader.onload = function(event) {
      image_tmp2.onload = function() {  
        
        canvas1.width = contextWidth;
        canvas1.height = contextHeight;
        ctx1.clearRect(0, 0, contextWidth, contextHeight);
        ctx1.drawImage(image_tmp2, 0, 0, contextWidth, contextHeight);

        // Refresh values for the new mask and labels
        frequentColorsMask = []
        frequentColorsLabels = [];
        mask2label = {};
        
        analyzeCanvas(ctx1, canvas1, frequentColorsMask);
        erosionOP(ctx1, canvas1, erosion); 
        analyzeCanvas(ctx1, canvas1, frequentColorsMask);
        frequentColorsMask.push([74,152,247]);
        loadLabel();

        // Copy the content of ctx1 to ctx1_tmp
        ctx1_tmp.canvas.width = contextWidth;
        ctx1_tmp.canvas.height = contextHeight;
        ctx1_tmp.drawImage(canvas1, 0, 0);
        changeBlockedStyles("classes", true);
      };
      loadingSpinner.style.display = 'none';
      image_tmp2.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}

function loadLabel() {
  frequentColorsLabels.push([0,0,0]);
  frequentColorsLabels.push([255,255,255]);

  // Resize canvas1 to match the image dimensions
  const contextWidth = canvas0.width;
  const contextHeight = canvas0.height;

  canvas2.width = contextWidth;
  canvas2.height = contextHeight;
  ctx2.clearRect(0, 0, contextWidth, contextHeight);   

  // Convert the colorful canvas to binary
  convertToBinary();

  circleLabel.style.backgroundColor = "rgb(255,255,255)";
  const labelBtn = document.getElementById("brush");
  labelBtn.click();
}

function changeBlockedStyles(type, flag) {
  // Get all elements with the .blocked class and the specified data-type attribute
  const blockedElements = document.querySelectorAll(`.blocked[data-type="${type}"]`);
  
  // Loop through each element and modify the CSS styles
  if (flag === true) {
    blockedElements.forEach(element => {
      element.style.pointerEvents = 'auto'; // Re-enable pointer events
      element.style.cursor = 'pointer'; 
    });
  } else {
    blockedElements.forEach(element => {
      element.style.pointerEvents = 'none'; // Disable pointer events
      element.style.cursor = 'not-allowed'; 
    });
  }
}

function generate_mask() {
  // Create a FormData object to append the image file
  const formData = new FormData();
  formData.append('ratioSeg', resolutionSegmentation.value);

  loadingSpinner.style.display = 'block';
  toolsBoard.style.pointerEvents = "auto";
  toolsBoard2.style.pointerEvents = "none";

  // Make an HTTP POST request to the process endpoint
  fetch('/generate_mask', {
    method: 'POST',
    body: formData
  })
  .then(response => response.text())
  .then(img_str => {
    // Create a new image element and set its source to the processed image data URI
    image_tmp2.src = 'data:image/png;base64,' + img_str;

    // Get the dimensions of the context (canvas)
    const contextWidth = canvas0.width;
    const contextHeight = canvas0.height;

     // Wait for the image to load
     image_tmp2.onload = () => {
      // Clear the canvas

      canvas1.width = contextWidth;
      canvas1.height = contextHeight;
      ctx1.clearRect(0, 0, contextWidth, contextHeight);
      ctx1.drawImage(image_tmp2, 0, 0, contextWidth, contextHeight);

      // Refresh values for the new mask and labels
      frequentColorsMask = []
      frequentColorsLabels = [];
      mask2label = {};
              
      analyzeCanvas(ctx1, canvas1, frequentColorsMask);
      erosionOP(ctx1, canvas1, erosion); 
      analyzeCanvas(ctx1, canvas1, frequentColorsMask);
      frequentColorsMask.push([74,152,247]);
      loadLabel();

      // Copy the content of ctx1 to ctx1_tmp
      ctx1_tmp.canvas.width = contextWidth;
      ctx1_tmp.canvas.height = contextHeight;
      ctx1_tmp.drawImage(canvas1, 0, 0);
      changeBlockedStyles("classes", true);
    };
    loadingSpinner.style.display = 'none';
  })
  .catch(error => {
    console.error('Network error:', error.message);
    window.alert("Error generating maks");
    loadingSpinner.style.display = 'none';
  });
}

function generate_class() {

  analyzeCanvas(ctx1, canvas1, frequentColorsMask);
  analyzeCanvas(ctx2, canvas2, frequentColorsLabels);

  var dataURLImage = canvas0.toDataURL(); // Get the base64-encoded image data
  var dataURLMask = canvas1.toDataURL(); // Get the base64-encoded image data
  var dataURLClass = canvas2.toDataURL(); // Get the base64-encoded image data
  var currentThreshold = thresholdInput.value;

  loadingSpinner.style.display = 'block';
  toolsBoard.style.pointerEvents = "auto";
  toolsBoard2.style.pointerEvents = "none";

  // Send the dataURL to the server using AJAX
  fetch('/generate_class', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageData: dataURLImage, maskData: dataURLMask, classData: dataURLClass, threshold: currentThreshold }),
  })  
  .then(response => response.json())
  .then(data => {
    // Create a new image element and set its source to the processed image data URI
    image_tmp2.src = 'data:image/png;base64,' + data.image;

    const newColorsArray = data.newColors;
    for (let y = 0; y < newColorsArray.length; y++) {
      
      let colorString = `rgb(${newColorsArray[y][0][0]}, ${newColorsArray[y][0][1]}, ${newColorsArray[y][0][2]})`;

      // Check if label already exists
      const colorExists = frequentColorsLabels.some(color => {
        return color[0] === newColorsArray[y][0][0] && color[1] === newColorsArray[y][0][1] && color[2] === newColorsArray[y][0][2];
      });
      if (!colorExists) {
        var buttonIndex = document.querySelectorAll(".generated-button").length -1;
        generateNewButton(names[buttonIndex], colorString);
      }
      const newColorsArrayStrings = newColorsArray[y][0].map(String);
      mask2label[newColorsArray[y][1]] = newColorsArrayStrings;
    }

    // Wait for the image to load
    image_tmp2.onload = () => {

      ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
      ctx2.drawImage(image_tmp2, 0, 0, canvas2.width, canvas2.height);
      
      analyzeCanvas(ctx2, canvas2, frequentColorsLabels);

      //console.log("frequentColorsLabels",frequentColorsLabels);

      const labelBtn = document.getElementById("label");
      labelBtn.click();
    };
    loadingSpinner.style.display = 'none';
  })
  .catch(error => {
    console.error('Network error:', error.message);
    window.alert("Error generating class");
    loadingSpinner.style.display = 'none';
  });
}

function generate_sat(){

  // Check if the map already exists
  if (!map) {
    map_org.style.width = canvas_org.width + "px";
    map_org.style.height = canvas_org.height + "px";
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

    // Block double click to zoom
    map.getInteractions().forEach(function(interaction) {
      if (interaction instanceof ol.interaction.DoubleClickZoom) {
        interaction.setActive(false);
      }
    });

    // Add event listener to the map to retrieve pixel coordinates on click
    map.on('click', function (event) {
      // Clean layer on the map
      const layers = map.getLayers().getArray().slice();
      layers.forEach(function (layer) {
          if (layer instanceof ol.layer.Vector) {
            map.removeLayer(layer);
          }
      });

      var pixel = map.getEventPixel(event.originalEvent);
      var coord = event.coordinate;

      if (selectedTool === "point1") {
        coordinates_points[0].x2 = pixel[0];
        coordinates_points[0].y2 = pixel[1];
        coordinates_points[0].x22 = coord[0];
        coordinates_points[0].y22 = coord[1];
      } else if (selectedTool === "point2") {
        coordinates_points[1].x2 = pixel[0];
        coordinates_points[1].y2 = pixel[1];
        coordinates_points[1].x22 = coord[0];
        coordinates_points[1].y22 = coord[1];
      } else if (selectedTool === "point3") {
        coordinates_points[2].x2 = pixel[0];
        coordinates_points[2].y2 = pixel[1];
        coordinates_points[2].x22 = coord[0];
        coordinates_points[2].y22 = coord[1];
      }   
    
      for (var i = 0; i < coordinates_points.length; i++) {
        if (coordinates_points[i].x1 !== 0 || coordinates_points[i].x2 !== 0 || coordinates_points[i].x22 !== 0) {
          var coordinate = [coordinates_points[i].x22, coordinates_points[i].y22];
          var point = new ol.geom.Point(coordinate);
      
          // Create a style for the point feature with the specified color
          var style = new ol.style.Style({
            image: new ol.style.Circle({
              radius: 5,
              fill: new ol.style.Fill({
                color: coordinates_points[i].color,
              }),
            }),
          });

          var feature = new ol.Feature(point);
          feature.setStyle(style);
      
          // Add the point feature to a vector layer and then add the layer to the map
          var vectorLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
              features: [feature],
            }),
          });
          map.addLayer(vectorLayer);
        } else {
          continue;
        }
      }
    });
  } else {
    // If the map already exists, update its view
    map.getView().setCenter(ol.proj.fromLonLat([longitudeInput, latitudeInput]));
  }
}

function updateCoverage(){
  let result = get_stats();
  const colorMap = {};
  names.forEach((name, index) => {
    colorMap[name] = colors[index % colors.length];
  });
  console.log(result)
  console.log(colorMap)

  plot_cake(result, colorMap);
  plot_table(result, colorMap);
}

function reshapeImageData(imageData) {
  const reshapedArray = [];
  const width = imageData.width;
  const height = imageData.height;

  for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const r = imageData.data[index];
          const g = imageData.data[index + 1];
          const b = imageData.data[index + 2];
          row.push((r === 0 && g === 0 && b === 0) ? 0 : 1);
      }
      reshapedArray.push(row);
  }
  return reshapedArray;
}

function propagateBlob(redChannelArray, greenChannelArray, blueChannelArray, x, y, fromColor, toColor) {
  const queue = [];
  queue.push([x, y]);

  while (queue.length > 0) {
    const [currentX, currentY] = queue.shift();

    if (currentX < 0 || currentX >= redChannelArray[0].length || currentY < 0 || currentY >= redChannelArray.length) {
      continue;
    }

    if (
      redChannelArray[currentY][currentX] !== fromColor[0] ||
      greenChannelArray[currentY][currentX] !== fromColor[1] ||
      blueChannelArray[currentY][currentX] !== fromColor[2]
    ) {
      continue; // Skip if the current pixel is not the 'fromColor'
    }

    // Change the pixel color
    redChannelArray[currentY][currentX] = toColor[0];
    greenChannelArray[currentY][currentX] = toColor[1];
    blueChannelArray[currentY][currentX] = toColor[2];

    // Add neighboring pixels to the queue
    queue.push([currentX + 1, currentY]);
    queue.push([currentX - 1, currentY]);
    queue.push([currentX, currentY + 1]);
    queue.push([currentX, currentY - 1]);
  }
}

function bucketCanvas(fromColor, startX, startY) {

  startX = parseInt(startX, 10);
  startY = parseInt(startY, 10);

  const fromColor_tmp = `rgb(${fromColor[0]}, ${fromColor[1]}, ${fromColor[2]})`;

  for (let i = 0; i < strokes.length; i++) {
    if (strokes[i].color === fromColor_tmp){
      strokes[i].color = selectedColor;
    }
  }

  // Extract the RGB values from the selectedColor string
  const toColorValues = selectedColor.match(/\d+/g).map(Number);
  const toColorLabelValues = selectedColorLabel.match(/\d+/g).map(Number);

  if (fromColor[0] === toColorValues[0] && fromColor[1] === toColorValues[1] && fromColor[2] === toColorValues[2]) {
    return;
  }

  // Get the pixel data
  const imageData = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
  const maskData = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);

  const redChannelArray = [];
  const greenChannelArray = [];
  const blueChannelArray = [];
  
  // Loop for the masks
  for (let y = 0; y < imageData.height; y++) {
    const redRow = [];
    const greenRow = [];
    const blueRow = [];
    
    for (let x = 0; x < imageData.width; x++) {
      const pixelIndex = (y * imageData.width + x) * 4;
      const red = imageData.data[pixelIndex];
      const green = imageData.data[pixelIndex + 1];
      const blue = imageData.data[pixelIndex + 2];
      redRow.push(red);
      greenRow.push(green);
      blueRow.push(blue);      
    }
    
    redChannelArray.push(redRow);
    greenChannelArray.push(greenRow);
    blueChannelArray.push(blueRow);
  }

  propagateBlob(redChannelArray, greenChannelArray, blueChannelArray, startX, startY, fromColor, toColorValues);

  for (let y = 0; y < imageData.height; y++) {   
    for (let x = 0; x < imageData.width; x++) {
      const pixelIndex = (y * imageData.width + x) * 4;
      imageData.data[pixelIndex] = redChannelArray[y][x];
      imageData.data[pixelIndex + 1] = greenChannelArray[y][x];
      imageData.data[pixelIndex + 2] = blueChannelArray[y][x];
      // paiting the label according to the label color from the selected mask
      if (redChannelArray[y][x] === toColorValues[0] && greenChannelArray[y][x] === toColorValues[1] && blueChannelArray[y][x] === toColorValues[2]) {   
        maskData.data[pixelIndex] = toColorLabelValues[0];
        maskData.data[pixelIndex + 1] = toColorLabelValues[1];
        maskData.data[pixelIndex + 2] = toColorLabelValues[2];
      }
    }
  }

  // Put the modified pixel data back to the canvas
  ctx2.putImageData(maskData, 0, 0);
  ctx1.putImageData(imageData, 0, 0);
}

function euclideanDistance(color1, color2) {
  const rDiff = color1[0] - color2[0];
  const gDiff = color1[1] - color2[1];
  const bDiff = color1[2] - color2[2];
  const distance =  Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  return distance;
}

function analyzeCanvas(ctx, canvas, frequentColors) {

  // Get the pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  if (frequentColors.length === 0) {
    // Count occurrences of each color
    const colorCount = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
        const color = [pixels[i], pixels[i + 1], pixels[i + 2]];
        const colorString = color.join(',');
        colorCount.set(colorString, (colorCount.get(colorString) || 0) + 1);
    }
    // Create a list of colors that appear more than 400 times
    colorCount.forEach((count, colorString) => {
        if (count > 400) {
            const color = colorString.split(',').map(Number);
            frequentColors.push(color);
        }
    });
  }
  //console.log("frequentColors",frequentColors);
  let previousClosestColor = frequentColors[0];

  // Loop through the pixel data again and set colors closer to the frequent ones
  for (let i = 0; i < pixels.length; i += 4) {

    const color = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const colorString = color.join(',');

    if (!frequentColors.includes(colorString)) {

      let closestColor = frequentColors[0];
      let closestDistance = euclideanDistance(color, frequentColors[0]);

      for (const frequentColor of frequentColors) {
          const distance = euclideanDistance(color, frequentColor);

          if (distance < closestDistance) {
              closestColor = frequentColor;
              closestDistance = distance;
          }
      }

      if (closestDistance > 30) {
        pixels[i] = previousClosestColor[0];   
        pixels[i + 1] = previousClosestColor[1];
        pixels[i + 2] = previousClosestColor[2]; 
      } else {
        pixels[i] = closestColor[0];
        pixels[i + 1] = closestColor[1];
        pixels[i + 2] = closestColor[2];
        previousClosestColor = closestColor;
      }
    }
  }

  // Put the modified pixel data back into the imageData
  ctx.putImageData(imageData, 0, 0);
  // Draw the modified image onto the canvas
  //ctx.drawImage(canvas, 0, 0);
}

function erosionOP(ctx, canvas) {
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const outputData = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      const r = data[index]; // Red channel
      const g = data[index + 1]; // Green channel
      const b = data[index + 2]; // Blue channel

      // Perform erosion the operation for each color channel
      const resultR = erosion(r, x, y, data, width, height, 0); // Red channel
      const resultG = erosion(g, x, y, data, width, height, 1); // Green channel
      const resultB = erosion(b, x, y, data, width, height, 2); // Blue channel

      // Set the result pixel values in the output data
      outputData[index] = resultR;
      outputData[index + 1] = resultG;
      outputData[index + 2] = resultB;
      outputData[index + 3] = 255; // Alpha channel, assuming opaque

    }
  }

  // Put the processed data back on the canvas
  ctx.putImageData(new ImageData(outputData, width, height), 0, 0);
}

function erosion(pixelValue, x, y, imageData, width, height, channel) {
  const kernel = [
    [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
    [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
    [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
  ];

  const neighborValues = [];

  for (const [dx, dy] of kernel) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const index = (ny * width + nx) * 4 + channel; // Adjust the index for the specific color channel
      const neighborValue = imageData[index];

      neighborValues.push(neighborValue);
    }
  }

  // Count occurrences of each neighbor value
  const valueCounts = {};
  for (const value of neighborValues) {
    if (value in valueCounts) {
      valueCounts[value]++;
    } else {
      valueCounts[value] = 1;
    }
  }

  // Find the most common value among neighbors
  let mostCommonValue = pixelValue;
  let maxCount = 0;
  for (const value in valueCounts) {
    if (valueCounts[value] > maxCount) {
      mostCommonValue = parseInt(value); // Convert value back to an integer
      maxCount = valueCounts[value];
    }
  }
  return mostCommonValue;
}

function convertToBinary() {

  const imageMask = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
  const data = imageMask.data;

  var uniqueColors = {};

  // Loop through each pixel and convert it to binary
  for (let i = 0; i < data.length; i += 4) {
    // Get the color values of the current pixel (red, green, blue)
    var pixelColor = [data[i], data[i + 1], data[i + 2]];

    if (JSON.stringify(pixelColor) !== JSON.stringify([0, 0, 0])) {
      // Modify the imageMask directly
      data[i] = 255;     // Red channel
      data[i + 1] = 255; // Green channel
      data[i + 2] = 255; // Blue channel

      var colorString = pixelColor.join(',');
      // Check if the color is already logged
      if (!uniqueColors[colorString]) {
        // Mark the color as logged
        uniqueColors[colorString] = true;     
        mask2label[colorString] = ["255", "255", "255"];
      }
    } else {
      data[i] = 0;   // Red channel
      data[i + 1] = 0; // Green channel
      data[i + 2] = 0; // Blue channel
    }
  }
  // Update the canvas with the modified pixel data
  ctx2.putImageData(imageMask, 0, 0);  
}

function exportToMap() {
  var dataURLImage = canvas0.toDataURL();
  var dataURLMask = canvas1.toDataURL();
  var dataURLLabel = canvas2.toDataURL();

  const colorMap = {};
  names.forEach((name, index) => {
    colorMap[name] = colors[index % colors.length];
  });

  
  let result = get_stats();
  let totalAreaSum = 0;

  // First pass: calculate the total area sum
  for (const key in result) {
    if (key === "0,0,0"){
      continue;
    }
    const entry = result[key];
    const totalArea = entry[0];
    totalAreaSum += totalArea;
  }
  const summary = {};
  // Second pass: build the summary object and calculate percentages
  for (const key in result) {
    if (key === "0,0,0"){
      continue;
    }
    const entry = result[key];
    const type = entry[1];
    const totalArea = entry[0];
  
    if (!summary[type]) {
      summary[type] = { count: 0, totalArea: 0 };
    }
    summary[type].count++;
    summary[type].totalArea += totalArea;
  }
  
  // Convert totalArea to percentage
  for (const type in summary) {
    summary[type].totalArea = (summary[type].totalArea / totalAreaSum) * 100;
  }
  
  const colorMapString = JSON.stringify(summary);

  fetch('/exportMap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageData: dataURLImage, masklData: dataURLMask, labelData: dataURLLabel, information: colorMapString, coordinates: coordinates_points , radiants: rotationRadians}),
  })
  .then(response => response.json()) // Parse the response as JSON
  .then(responseData => {
    // Extract image and coordinates from the responseData
    const img_str = responseData.image;
    const new_coord = responseData.new_coord;
    
    // Remove selected points
    var vectorLayers = map.getLayers().getArray().filter(layer => layer instanceof ol.layer.Vector);
      // Remove each vector layer from the map
      vectorLayers.forEach(function (layer) {
        map.removeLayer(layer);
      });

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
    };
  })
  .catch(error => {
    console.error('Network error:', error.message);
    window.alert("Error processing data");
  });
}

function saveMap() {
  fetch('/saveMap', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          // Include any necessary parameters here
      }),
  })
  .then(response => response.json()) // Parse the response as JSON
  .then(responseData => {
    // Extract the original filename
    const originalFilename = responseData.filename;

    // Extract and download mask image
    const maskImgStr = responseData.mask_;
    const maskImg = new Image(); // Create an image element
    maskImg.src = 'data:image/png;base64,' + maskImgStr;
    
    maskImg.onload = function() {    
      // Create a link element for download
      const maskLink = document.createElement('a');
      maskLink.style.display = 'none';
      maskLink.href = maskImg.src;
      maskLink.download = 'mask_' + originalFilename + '.png';
      document.body.appendChild(maskLink);
      maskLink.click();
      document.body.removeChild(maskLink);
    };

    // Extract and download label image
    const labelImgStr = responseData.label_;
    const labelImg = new Image(); // Create an image element
    labelImg.src = 'data:image/png;base64,' + labelImgStr
    
    labelImg.onload = function() {    
      // Create a link element for download
      const labelLink = document.createElement('a');
      labelLink.style.display = 'none';
      labelLink.href = labelImg.src;
      labelLink.download = 'label_' + originalFilename + '.png';
      document.body.appendChild(labelLink);
      labelLink.click();
      document.body.removeChild(labelLink);
    };
})
  .catch(error => {
    console.error('Network error:', error.message);
    window.alert("Error downloading image");
  });
}

function get_stats(){
  const image = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
  const data = image.data;

  let uniqueColors2 = {};
  let stats = {};
  for (let i = 0; i < data.length; i += 4) {
    const tmp = [data[i], data[i + 1], data[i + 2]];
    let colorString = JSON.stringify(tmp);
    if (!uniqueColors2[colorString]) {
      uniqueColors2[colorString] = 1;
    } else {
      uniqueColors2[colorString]++;
    }
  }
  for (let key1 in uniqueColors2) {
    let key1_tmp = key1.slice(1, -1);
    stats[key1_tmp] = [uniqueColors2[key1], "Other"]
    if (mask2label.hasOwnProperty(key1_tmp)) {
      // Convert the value array to a string for comparison
      let targetColorString = `rgb(${mask2label[key1_tmp].join(", ")})`;
      colors.forEach((color, index) => {
        // Check if the current color matches the target color
        if (color === targetColorString) {
          // If it matches, add the index to the matchingIndices array
          stats[key1_tmp] = [uniqueColors2[key1], names[index]];
        }
      });
    }
  }
  return stats;
}

function plot_cake(result, colorMap){

  const aggregatedData = {};
  for (const color in result) {
    if (color === '0,0,0'){
      continue;
    }
    const label = result[color][1];
    const count = result[color][0];
    aggregatedData[label] = (aggregatedData[label] || 0) + count; // Simplified aggregation
  }

  // Convert aggregated data to Plotly format
  const labels = Object.keys(aggregatedData);
  const counts = Object.values(aggregatedData);

  // Define the data and layout for the Plotly plot
  var data = [{
    values: counts,
    labels: labels,
    type: 'pie',
    marker: {
      colors: labels.map(label => colorMap[label] || 'rgb(255,255,255)')
    },
    showlegend: false // Set showlegend to false to hide the legend
  }];
  
  // Define the layout for the Plotly plot
  var layout = {
    height: cake.offsetHeight,
    width: cake.offsetWidth,
    margin: {
      l: 0, // Left margin (in pixels)
      r: 0, // Right margin (in pixels)
      t: 0, // Top margin (in pixels)
      b: 0  // Bottom margin (in pixels)
    },
    plot_bgcolor: 'rgba(0,0,0,0)', 
    paper_bgcolor: 'rgba(0,0,0,0)'
  };

  // Create the Plotly plot
  Plotly.newPlot('cake', data, layout);
}

function plot_table(result, colorMap)  {
  const summary = {};

  for (const key in result) {
    if (key === "0,0,0"){
      continue;
    }
    const entry = result[key];
    const type = entry[1];
    const totalArea = entry[0];

    if (!summary[type]) {
      summary[type] = { count: 0, totalArea: 0 };
    }
    summary[type].count++;
    summary[type].totalArea += totalArea;
  }

  for (let i = table.rows.length - 1; i > 0; i--) {
    table.deleteRow(i);
  }
  
  for (const type in summary) {
    const entry = summary[type];
    const newRow = table.insertRow();

    const colorCell = newRow.insertCell();
    if (type === "Other"){
      colorCell.style.backgroundColor = "rgb(255,255,255)";
    } else{
      colorCell.style.backgroundColor = colorMap[type];
    }
    
    const typeCell = newRow.insertCell();
    typeCell.textContent = type;
    
    const numberTreesCell = newRow.insertCell();
    numberTreesCell.textContent = entry.count;
    
    const totalAreaCell = newRow.insertCell();
    totalAreaCell.textContent = entry.totalArea;
    
    const avgAreaCell = newRow.insertCell();
    avgAreaCell.textContent =  Math.floor(entry.totalArea/entry.count);
  }
}

function openSettings() {
  var modal = document.getElementById("settingsModal");
  modal.style.display = "block";
}

function closeSettingsModal(save=false) {
  var modal = document.getElementById("settingsModal");
  modal.style.display = "none";
  if (save === false){
    default_settings();
  }
}

function applySettings() {
  if (validateInput(framesVideo.value)) {
    closeSettingsModal(true);
  } else {
    default_settings();
    alert("Please enter valid values between 1 and 10.");
  }
}

function validateInput(value) {
  // Validate that the input is a number and within the range of 1 to 10
  return !isNaN(value) && parseInt(value) >= 1 && parseInt(value) <= 10;
}

function saveCanvasAsImage(canvas, frequentColors, filename) {
  translateX = 0;
  translateY = 0;
  zoomFactor = 1;
  zoomDrawCanvas();

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = originalImageWidth;
  resizedCanvas.height = originalImageHeight;

  const resizedCtx = resizedCanvas.getContext("2d");
  resizedCtx.drawImage(canvas, 0, 0, originalImageWidth, originalImageHeight);
 
  analyzeCanvas(resizedCtx, resizedCanvas, frequentColors);

  // Convert the resized canvas content to a data URL (PNG format by default)
  const dataURL = resizedCanvas.toDataURL();

  // Create an anchor element to trigger the download
  const downloadLink = document.createElement("a");
  downloadLink.href = dataURL;
  downloadLink.download = filename; // Set the desired filename here

  // Programmatically trigger a click event on the anchor element
  // This will prompt the user to save the canvas image
  downloadLink.click();
}

function saveImage() {
  // Save canvas1
  if (frequentColorsMask.length !== 0) {
    saveCanvasAsImage(canvas1, frequentColorsMask, "masks.png");
  }
  // Save canvas2
  if (frequentColorsLabels.length !== 0) {
    saveCanvasAsImage(canvas2, frequentColorsLabels, "labels.png");
  }
}

function getColorsInImageMask() {
  const imageMaskColors = new Set();

  for (const color of frequentColorsMask) {
    const colorString = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    imageMaskColors.add(colorString);
  }
  return imageMaskColors;
}

function getRandomRGBColor() {
  const min = 0;
  const max = 255;
  const r = Math.floor(Math.random() * (max - min + 1) + min);
  const g = Math.floor(Math.random() * (max - min + 1) + min);
  const b = Math.floor(Math.random() * (max - min + 1) + min);
  return [r, g, b];
}

function generateUniqueRandomColor() {
  const imageMaskColors = getColorsInImageMask();
  const MAX_ATTEMPTS = 100; // Limit the attempts to avoid an infinite loop

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const randomRGBColor = getRandomRGBColor();
    const randomColorString = `rgb(${randomRGBColor[0]}, ${randomRGBColor[1]}, ${randomRGBColor[2]})`;

    if (!imageMaskColors.has(randomColorString)) {
      return randomColorString; // Return the RGB string if it is not in the image_mask
    }
  }

  // If we reach here, it means we couldn't find a unique color after MAX_ATTEMPTS
  return "rgb(0, 0, 0)"; // Return black  as RGB string as a fallback color
}

function check(name, ctx, canvas) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  var uniqueColors2 = {};
  for (let i = 0; i < data.length; i += 4) {
    const tmp = [data[i], data[i + 1], data[i + 2]];
    var colorString = JSON.stringify(tmp);
    if (!uniqueColors2[colorString]) {
      uniqueColors2[colorString] = 1;
    } else {
      uniqueColors2[colorString]++;
    }
  }
  console.log(`${name}`, uniqueColors2);
}