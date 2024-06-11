import os
from flask import Flask, render_template, request, Response, jsonify, session
import model
from PIL import Image, PngImagePlugin
import cv2
from io import BytesIO
import base64
import shutil


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'tiff'}

@app.route('/favicon.ico')
def favicon():
    return ''
    
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/demo')
def demo():
    return render_template('demo.html')

@app.route('/docu')
def docu():
    return render_template('docu.html')

@app.route('/maps')
def maps():
    return render_template('maps.html')

@app.route('/generate_class', methods=['POST'])
def generate_class():

    data = request.get_json()
    image_data = data.get('imageData')
    mask_data = data.get('maskData') 
    class_data = data.get('classData')
    threshold = data.get('threshold')

    processed_image, new_colors = model.create_label(image_data, mask_data, class_data, threshold)

    # Convert processed_image to data URI
    buffered = BytesIO()
    processed_image.save(buffered, format="png")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    print("Inference labels done")
    return jsonify({"image": img_str, "newColors": new_colors})

@app.route('/generate_mask', methods=['POST'])
def generate_mask():
    filename_org = session.get('filename')
    ratioSeg = float(request.form.get('ratioSeg'))
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], "post_"+filename_org+".PNG")
    
    processed_image = model.process_image(image_path, ratioSeg)

    # Convert processed_image to data URI
    buffered = BytesIO()
    processed_image.save(buffered, format="png")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    response = Response(response=img_str, content_type='image/png')
    print("Inference mask done")
    return response

@app.route('/input', methods=['POST'])
def input():
    # Get the flag value from the request
    flag = request.form.get('flag')
    resolutionImage = float(request.form.get('resolutionImage'))

    if 'images' not in request.files:
        return jsonify({'error': 'No selected file'}), 400
    
    filenames = []
    images = request.files.getlist('images')

    for image in images:
        if image.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if image and allowed_file(image.filename):
            
            filename_org = image.filename
            session['filename'] = os.path.splitext(filename_org)[0]

            if flag == "video":
                framesVideo = int(request.form.get('framesVideo'))
                video_path = os.path.join(app.config['UPLOAD_FOLDER'], filename_org)
                image.save(video_path)
                filenames = model.extractFrames(video_path, app.config['UPLOAD_FOLDER'], framesVideo)
            else:
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename_org)
                image.save(image_path)
                filenames.append(image_path)
    
    if (flag == "maps" and len(filenames) > 1) or (flag == "video"):
        processed_image, lat, lon = model.create_map(filenames, resolutionImage)
        print("Creating Map")
    else:
        img = cv2.imread(filenames[0])
        try:
            lat, lon = model.get_geotagging_info(filenames[0])
        except:
            lat, lon = 41.40236643338575, 2.151736768394448
        cropped_image = model.crop_image(img)
        height, width, _ = cropped_image.shape
        processed_image = cv2.resize(cropped_image, (int(width * resolutionImage), int(height * resolutionImage)), interpolation=cv2.INTER_LINEAR)
        print("Single Image")

    processed_image = Image.fromarray(cv2.cvtColor(processed_image, cv2.COLOR_BGR2RGB))
    
    # Rotate if height is larger than width
    width, height = processed_image.size
    if height > width:
        processed_image = processed_image.rotate(90, expand=True)

    image_path = os.path.join(app.config['UPLOAD_FOLDER'],  "post_"+session['filename']+".PNG")
    processed_image.save(image_path)

    # Encode the image to base64
    with open(image_path, "rb") as f:
        img_bytes = f.read()
        img_str = base64.b64encode(img_bytes).decode()

    # Prepare response with coordinates and image data
    response_data = {
        'coordinates': (lat, lon),
        'image_data': img_str
    }

    return response_data

@app.route('/input_map', methods=['POST'])
def input_map():

    if 'images' not in request.files:
        return jsonify({'error': 'No selected file'}), 400
    
    images = request.files.getlist('images')

    image_path, new_coord, label_counts = model.createLableMap(images, app.config['UPLOAD_FOLDER'])

    # Encode the image to base64
    with open(image_path, "rb") as f:
        img_bytes = f.read()
        img_str = base64.b64encode(img_bytes).decode()

    # Convert new_coord to a JSON serializable format
    new_coord_json = new_coord.tolist()

    # Create a response dictionary with image and new_coord
    response_data = {
        "image": img_str,
        "new_coord": new_coord_json,
        "info": label_counts
    }

    return response_data

@app.route('/exportMap', methods=['POST'])
def export_map():

    data = request.get_json()
    image_data = data.get('imageData')
    labelData = [data.get('masklData'), data.get('labelData')]
    information = data.get('information')
    co = data.get('coordinates')
    rad = data.get('radiants')
    filename_type = ["mask_", "label_"]
    filename_org = session.get('filename')

    for i in range(2):

        processed_image, new_coord = model.cooordinateTransformation(co, rad, image_data, labelData[i])
        processed_image = Image.fromarray(cv2.cvtColor(processed_image, cv2.COLOR_BGR2RGB))

        # Create metadata
        new_coord_string = ' '.join([f"{x:.15f}" for x in new_coord])
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], "map_"+ filename_type[i]+ filename_org + ".PNG")
        png_info = PngImagePlugin.PngInfo()
        png_info.add_text("coord", new_coord_string)
        png_info.add_text("info", information) 
        processed_image.save(image_path, pnginfo=png_info)

    image_path = os.path.join(app.config['UPLOAD_FOLDER'], "map_"+ filename_type[0]+ filename_org + ".PNG")
    # Encode the image to base64
    with open(image_path, "rb") as f:
        img_bytes = f.read()
        img_str = base64.b64encode(img_bytes).decode()

    # Convert new_coord to a JSON serializable format
    new_coord_json = new_coord.tolist()

    # Create a response dictionary with image and new_coord
    response_data = {
        "image": img_str,
        "new_coord": new_coord_json
    }

    print("Transformation done")
    # Return the response as JSON
    return jsonify(response_data)

@app.route('/saveMap', methods=['POST'])
def save_map():

    response_data = {}
    filename_type = ["mask_", "label_"]
    filename_org = session.get('filename')
    response_data["filename"] = filename_org

    for i in range(2):

        image_path = os.path.join(app.config['UPLOAD_FOLDER'], "map_"+ filename_type[i]+ filename_org + ".PNG")

        # Encode the image to base64
        with open(image_path, "rb") as f:
            img_bytes = f.read()
            img_str = base64.b64encode(img_bytes).decode()

        # Create a response dictionary with image and EXIF metadata
        response_data[filename_type[i]] = img_str

    print("Transformation done")
    # Return the response as JSON
    return jsonify(response_data)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

if __name__ == '__main__':
    app.secret_key = 'super_secret_key'
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        shutil.rmtree(app.config['UPLOAD_FOLDER'])

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True)
    #app.run(debug=False, host='0.0.0.0')