function initializeDraggableLine(lineId, imageId, backgroundImageUrl, sliderId) {
    const line = document.getElementById(lineId);
    const image = document.getElementById(imageId);
    const slider = document.getElementById(sliderId); // Get slider element
    const maxWidth = image.clientWidth; // Maximum width based on the image width
    const maxHeight = image.clientHeight;


    // Set background image and adjust background size
    line.style.backgroundImage = `url('${backgroundImageUrl}')`;
    line.style.backgroundSize = `${maxWidth}px ${maxHeight}px`;

    // Function to update line width based on slider value
    function updateLineWidth(value) {
        const newWidth = (maxWidth * value) / maxWidth; // Calculate new width based on slider value
        line.style.width = newWidth + 'px';
    }

    // Listen for changes in slider value
    slider.addEventListener('input', function() {
        const sliderValue = this.value; // Get current slider value
        updateLineWidth(sliderValue);
    });

    // Initialize line width based on initial slider value
    updateLineWidth(slider.value);
}

initializeDraggableLine('line1', 'imagee1', '/static/images/forest_labels.png', 'size-slider1');
initializeDraggableLine('line2', 'imagee2', '/static/images/saudi_labels.png', 'size-slider2');
initializeDraggableLine('line3', 'imagee3', '/static/images/semi_labels.png', 'size-slider3');
