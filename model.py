import numpy as np
from fastsam import FastSAM 
import torch
import torch.nn as nn
from torchvision import models
from PIL import Image
import piexif
import cv2
from sklearn.metrics.pairwise import cosine_distances
from scipy.cluster.hierarchy import linkage, fcluster
from flask import jsonify
from collections import Counter
import math
import base64
from decimal import Decimal
import random
import json
import os

def show_anns(anns):
    np.random.seed(12)
    anns = anns.numpy().astype(np.uint8)
    if len(anns) == 0:
        return
    img = np.zeros((anns.shape[1], anns.shape[2], 3), dtype=np.uint8)
    for ann in anns:
        ann = ann == 1
        color_mask = np.random.randint(0, 256, size=3)
        img[ann] = color_mask
    return img

def process_image(image_path, ratioSeg):
    model_path = "FastSAM-x.pt"
    model = FastSAM(model_path)

    # Load and preprocess the image
    input = Image.open(image_path)
    input = input.convert("RGB")

    # Calculate the new dimensions while maintaining the aspect ratio
    width, height = input.size

    # Resize the image
    rescaled_image = input.resize((int(width*ratioSeg), int(height*ratioSeg)), Image.BILINEAR)
    
    # Perform inference
    everything_results = model(rescaled_image, device="cpu", retina_masks=True, imgsz=512, conf=0.4, iou=0.9)
    masks = everything_results[0].masks.data
    output = show_anns(masks)       
    output_image = Image.fromarray(output.astype(np.uint8))
    return output_image

def extractFrames(video_path, output_path, ratioFrame):
    # Open the video file
    filenames = []
    video_capture = cv2.VideoCapture(video_path)
    
    if not video_capture.isOpened():
        print("Error: Could not open video file.")
        return

    frame_count = 0
    frame_rate = int(video_capture.get(cv2.CAP_PROP_FPS))
    save_every_n_frames = frame_rate//ratioFrame  # Save one frame per 0.5 second

    while True:
        # Read a frame from the video
        ret, frame = video_capture.read()

        # Check if the frame was read successfully
        if not ret:
            break  # End of the video

        # Save a frame every second
        if frame_count % save_every_n_frames == 0:
            frame_filename = f'{output_path}/frame_{frame_count:04d}.jpg'
            cv2.imwrite(frame_filename, frame)
            filenames.append(frame_filename)

        frame_count += 1

    # Release the video capture object and close the video file
    video_capture.release()
    cv2.destroyAllWindows()

    return filenames

def warpImages(img1, img2, H):
    rows1, cols1 = img1.shape[:2]
    rows2, cols2 = img2.shape[:2]

    list_of_points_1 = np.float32([[0,0], [0, rows1],[cols1, rows1], [cols1, 0]]).reshape(-1, 1, 2) #coordinates of a reference image
    temp_points = np.float32([[0,0], [0,rows2], [cols2,rows2], [cols2,0]]).reshape(-1,1,2) #coordinates of second image

    # When we have established a homography we need to warp perspective
    # Change field of view
    list_of_points_2 = cv2.perspectiveTransform(temp_points, H)#calculate the transformation matrix

    list_of_points = np.concatenate((list_of_points_1,list_of_points_2), axis=0)

    [x_min, y_min] = np.int32(list_of_points.min(axis=0).ravel() - 0.5)
    [x_max, y_max] = np.int32(list_of_points.max(axis=0).ravel() + 0.5)

    translation_dist = [-x_min,-y_min]

    H_translation = np.array([[1, 0, translation_dist[0]], [0, 1, translation_dist[1]], [0, 0, 1]])

    output_img = cv2.warpPerspective(img2, H_translation.dot(H), (x_max-x_min, y_max-y_min))
    output_img[translation_dist[1]:rows1+translation_dist[1], translation_dist[0]:cols1+translation_dist[0]] = img1
    return output_img

def create_map(images_path, resolutionImage):
    img_list = []

    for img in images_path:

        image = cv2.imread(img)

        if image is not None:
            try:
                lat, lon = get_geotagging_info(img)
            except:
                lat, lon = 0, 0
            # we remove borders as they might suffer from distortion
            cropped_image = crop_image(image)
            height, width, _ = cropped_image.shape
            processed_image = cv2.resize(cropped_image, (int(width * resolutionImage), int(height * resolutionImage)), interpolation=cv2.INTER_LINEAR)
            img_list.append(processed_image)

    #Use ORB detector to extract keypoints
    orb = cv2.ORB_create(nfeatures=2000)
    while True:
        img1=img_list.pop(0)
        img2=img_list.pop(0)
        # Find the key points and descriptors with ORB (descriptors are arrays of numbers that define the keypoints)
        keypoints1, descriptors1 = orb.detectAndCompute(img1, None)
        keypoints2, descriptors2 = orb.detectAndCompute(img2, None)

        # Create a BFMatcher object to match descriptors
        # It will find all of the matching keypoints on two images
        bf = cv2.BFMatcher_create(cv2.NORM_HAMMING)#NORM_HAMMING specifies the distance as a measurement of similarity between two descriptors

        # Find matching points
        matches = bf.knnMatch(descriptors1, descriptors2,k=2)

        all_matches = []
        for m, n in matches:
            all_matches.append(m)
        # Finding the best matches
        good = []
        for m, n in matches:
            if m.distance < 0.6 * n.distance:#Threshold
                good.append(m)

        # Set minimum match condition
        MIN_MATCH_COUNT = 5

        if len(good) > MIN_MATCH_COUNT:
        
            # Convert keypoints to an argument for findHomography
            src_pts = np.float32([ keypoints1[m.queryIdx].pt for m in good]).reshape(-1,1,2)
            dst_pts = np.float32([ keypoints2[m.trainIdx].pt for m in good]).reshape(-1,1,2)

            # Establish a homography
            M, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC,5.0)
            result = warpImages(img2, img1, M)
            
            # Check for rows and columns containing only zeros
            row_mask = np.any(result != 0, axis=(1, 2))
            col_mask = np.any(result != 0, axis=(0, 2))

            # Crop the array based on the row and column masks
            result = result[row_mask][:, col_mask]
            img_list.insert(0,result)

            if len(img_list)==1:
                break

    return result, lat, lon

def cosine_distance_matrix(vectors):
    """
    Compute the cosine distance matrix between all pairs of vectors.

    Parameters:
    - vectors: List of numerical vectors.

    Returns:
    - distance_matrix: 2D NumPy array representing the cosine distance matrix.
    """
    # Convert the list of vectors to a NumPy array
    vectors_array = np.array(vectors)

    # Compute the cosine distance matrix using sklearn's cosine_distances
    distance_matrix = 1 - cosine_distances(vectors_array)

    return distance_matrix

def cluster_cosine_distance_matrix(distance_matrix, threshold=0.8, clusters=4):
    """
    Cluster vectors based on the cosine distance matrix using hierarchical clustering.

    Parameters:
    - distance_matrix: 2D NumPy array representing the cosine distance matrix.
    - threshold: Threshold to cut the dendrogram and form clusters. If None, use the default.
    - clusters: Maximum number of clusters.

    Returns:
    - labels: Cluster labels assigned to each vector.
    """

    # Perform hierarchical clustering
    linkage_matrix = linkage(distance_matrix, method='average')

    # Cut the dendrogram to form clusters
    labels = fcluster(linkage_matrix, threshold, criterion='distance')
    found_clusters = len(np.unique(labels))
    
    if found_clusters > min(clusters,4):
        labels = fcluster(linkage_matrix, clusters, criterion='maxclust')  

    return labels

def create_label(image_data, mask_data, class_data, threshold):

    colors_palette =[[255, 127, 127], [193, 154, 107], [152,251,152], [252, 238, 167]]

    convnext_small = models.convnext_small(weights = 'ConvNeXt_Small_Weights.DEFAULT')
    # Remove classifier layer
    model = nn.Sequential(*list(convnext_small.children())[:-1])
    model.eval()

    binary_data = base64.b64decode(image_data.split(',')[1])
    image_array = np.frombuffer(binary_data, np.uint8)
    img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    img_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    binary_mask = base64.b64decode(mask_data.split(',')[1])
    mask_array = np.frombuffer(binary_mask, np.uint8)
    mask = cv2.imdecode(mask_array, cv2.IMREAD_COLOR)
    mask_img = cv2.cvtColor(mask, cv2.COLOR_BGR2RGB)

    binary_class = base64.b64decode(class_data.split(',')[1])
    class_array = np.frombuffer(binary_class, np.uint8)
    clas = cv2.imdecode(class_array, cv2.IMREAD_COLOR)
    class_img = cv2.cvtColor(clas, cv2.COLOR_BGR2RGB)

    img_array = np.array(img_img)
    mask_array = np.array(mask_img)
    class_array = np.array(class_img)

    # Get unique colors
    pixels = mask_array.reshape((-1, 3))
    unique_colors = np.unique(pixels, axis=0)

    vectors = []
    entries = []

    for i in range(len(unique_colors)):

        if np.all(unique_colors[i] == [0,0,0]):
            continue
        mask = ((mask_array[:,:,0] == unique_colors[i][0]) & (mask_array[:,:,1] == unique_colors[i][1]) & (mask_array[:,:,2] == unique_colors[i][2])).astype(np.uint8)*1

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        mask = np.stack([mask] * 3, axis=-1)

        # Assuming there is only one contour 
        largest_contour = max(contours, key=cv2.contourArea)

        # Get the bounding box of the contour
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Crop the image based on the bounding box
        cropped_image = img_array[y:y + h, x:x + w,:3]*mask[y:y + h, x:x + w]

        value_mask = (class_array[:,:])*mask
        pixels = value_mask.reshape((-1, 3))
        label_color = np.unique(pixels, axis=0)

        # Identify rows where all elements are not equal to [0, 0, 0]
        non_zero_rows = np.any(label_color != [0, 0, 0], axis=1)

        # Keep only the rows where at least one element is not equal to [0, 0, 0]
        label_color = label_color[non_zero_rows]

        if np.all(label_color[0].tolist() != [255,255,255]):
            color_label_end_tmp = label_color[0].tolist()
        else:
            color_label_end_tmp = None

        try:
            img_tensor = torch.from_numpy(cropped_image)
            img_tensor = img_tensor.permute(2, 0, 1).float()
            img_tensor = img_tensor.unsqueeze(0)
            vectors.append(model(img_tensor).cpu().detach().numpy()[0,:,0,0])
            class_tmp = None
            
        except:
            class_tmp = -1
            color_label_end_tmp = [255, 255, 255]

        new_entry = {
            'id': i,
            'class': class_tmp,
            'color_mask': unique_colors[i].tolist(),
            'color_label_org': label_color[0].tolist(),
            'color_label_end': color_label_end_tmp,
        }
        entries.append(new_entry)
        #print(entries)

    # Clustering the cropped trees
    distance_matrix = cosine_distance_matrix(vectors)
    clusters = 4 # Set your desired cluster value (max 4)
    cluster_labels = cluster_cosine_distance_matrix(distance_matrix, threshold, clusters)
    #print(cluster_labels)

    #for entry in entries:
    #    print(entry)

    # Assign labels to each entry
    j = 0
    for entry in(entries):
        if entry['class'] is None:
            entry['class'] = cluster_labels[j]
            j = j+1

    #for entry in entries:
    #    print(entry)

    # Create a dictionary to store the occurrences of color_label_end for each class
    class_color_counts = {}

    # Count occurrences of color_label_end for each class
    for entry in entries:
        if entry['class'] is not None and entry['class'] != -1 and entry['color_label_end'] is not None:
            class_color_counts.setdefault(entry['class'], []).append(tuple(entry['color_label_end']))

    # Find the most common color_label_end for each class
    most_common_colors = {}
    for class_label, colors in class_color_counts.items():
        most_common_colors[class_label] = Counter(colors).most_common(1)[0][0]

    # Update entries with the most common color_label_end for each class
    for entry in entries:
        if entry['class'] in most_common_colors and entry['color_label_end'] is None:
            entry['color_label_end'] = list(most_common_colors[entry['class']])
            
    # Give color to classes without it
    cont = len(most_common_colors)
    for entry in entries:
        if entry['color_label_end'] is None:
            entry['color_label_end'] = colors_palette[cont]
            
            # Propagate new class
            for entry2 in entries:
                if entry2['color_label_end'] is None and entry2['class'] == entry['class']:
                    entry2['color_label_end'] = entry['color_label_end']                  
            cont = cont +1
            
    # Print the updated entries
    #for entry in entries:
    #    print(entry)

    for index, entry in enumerate(entries):
        color_mask_value = entry['color_mask']
        mask = ((mask_array[:,:,0] == color_mask_value[0]) & (mask_array[:,:,1] == color_mask_value[1]) & (mask_array[:,:,2] == color_mask_value[2])).astype(np.uint8)*1   
             
        # Check that classes do not contain already labels
        mask = np.stack([mask] * 3, axis=-1)
        
        mask[:,:,0] = mask[:,:,0]*entry['color_label_end'][0]
        mask[:,:,1] = mask[:,:,1]*entry['color_label_end'][1]
        mask[:,:,2] = mask[:,:,2]*entry['color_label_end'][2]
        
        if index == 0:
            mask_tmp = mask
        else:
            mask_tmp = mask_tmp + mask

    color_mask_label_tuples = []

    for entry in entries:
        color_mask = entry['color_mask']
        color_label_end = entry['color_label_end']
        color_mask_label_tuples.append((color_label_end, color_mask))

    output_image = Image.fromarray(mask_tmp.astype(np.uint8))
    
    return output_image, color_mask_label_tuples

def get_geotagging_info(img_path):

    # Load the EXIF data from the image file
    exif_data = piexif.load(img_path)
    
    # Check if GPS tag exists in the EXIF data
    if piexif.GPSIFD.GPSLongitude in exif_data['GPS'] and piexif.GPSIFD.GPSLatitude in exif_data['GPS']:
        geotagging_info = {}
        # Extract GPS coordinates
        lon = exif_data['GPS'][piexif.GPSIFD.GPSLongitude]
        lat = exif_data['GPS'][piexif.GPSIFD.GPSLatitude]
        
        # Convert GPS coordinates from rational format to decimal format
        lon_value = lon[0][0] / lon[0][1] + lon[1][0] / (lon[1][1] * 60) + lon[2][0] / (lon[2][1] * 3600)
        lat_value = lat[0][0] / lat[0][1] + lat[1][0] / (lat[1][1] * 60) + lat[2][0] / (lat[2][1] * 3600)
        
        # Determine the reference direction (N/S, E/W)
        lon_ref = exif_data['GPS'][piexif.GPSIFD.GPSLongitudeRef]
        lat_ref = exif_data['GPS'][piexif.GPSIFD.GPSLatitudeRef]
        
        if lon_ref.decode('utf-8') == 'W':
            lon_value = -lon_value
        if lat_ref.decode('utf-8') == 'S':
            lat_value = -lat_value
        
        # Store the GPS coordinates in the geotagging_info dictionary
        geotagging_info['GPSLatitude'] = lat_value
        geotagging_info['GPSLongitude'] = lon_value
        
        return lat_value, lon_value


def crop_image(img, crop_percentage=0.1):
    
    height, width, _ = img.shape
    crop_left = int(width * crop_percentage)
    crop_top = int(height * crop_percentage)
    crop_right = width - crop_left
    crop_bottom = height - crop_top
    cropped_img = img[crop_top:crop_bottom, crop_left:crop_right]
    
    return cropped_img
    
def calculate_distance(point1, point2):
    x1, y1 = point1
    x2, y2 = point2

    distance = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
    return distance

def rotate_points_back(rot_rad, points):
    # Define the rotation matrix
    R = np.array([[np.cos(rot_rad), -np.sin(rot_rad)],
                  [np.sin(rot_rad), np.cos(rot_rad)]])
    
    # Inverse of the rotation matrix
    R_inv = np.linalg.inv(R)
    
    original_coordinates = np.zeros_like(points)
    
    for i, pixel in enumerate(points):
        # Convert pixel coordinates to numpy array
        pixel_arr = np.array(pixel)
        
        # Apply the inverse rotation matrix to recover original coordinates
        original_coords = np.dot(R_inv, pixel_arr)
        
        original_coordinates[i] = original_coords
    
    return original_coordinates

def cooordinateTransformation(co, rad, image_data, label_data):

    # Process the data as needed
    binary_data = base64.b64decode(image_data.split(',')[1])
    image_array = np.frombuffer(binary_data, np.uint8)
    img_img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    binary_label = base64.b64decode(label_data.split(',')[1])
    label_array = np.frombuffer(binary_label, np.uint8)
    label_img = cv2.imdecode(label_array, cv2.IMREAD_COLOR)

    # Choose corresponding points (you might use a tool to manually select them)
    pts_src = np.array([[co[0]['x1'], co[0]['y1']], [co[1]['x1'], co[1]['y1']], [co[2]['x1'], co[2]['y1']]], dtype=np.float32)
    pts_dst = np.array([[co[0]['x2'], co[0]['y2']], [co[1]['x2'], co[1]['y2']], [co[2]['x2'], co[2]['y2']]], dtype=np.float32)
    pts_dst = rotate_points_back(rad, pts_dst)

    max_dim = 5000

    # Calculate the transformation matrix
    transformation_matrix = cv2.getAffineTransform(pts_src[:3], pts_dst[:3])
    
    transformation_matrix[0,2] =  max_dim//2
    transformation_matrix[1,2] =  max_dim//2

    original_point1 = np.array([co[0]['x1'], co[0]['y1'], 1])
    transformed_point1 = np.dot(transformation_matrix, original_point1)
    original_point2 = np.array([co[1]['x1'], co[1]['y1'], 1])
    transformed_point2 = np.dot(transformation_matrix, original_point2)
    dist_pixels = calculate_distance(transformed_point1, transformed_point2)

    original_coord1 = np.array([co[0]['x22'], co[0]['y22']])
    original_coord2 = np.array([co[1]['x22'], co[1]['y22']])
    dist_coord = calculate_distance(original_coord1, original_coord2)

    ratio = dist_coord/dist_pixels

    new_coord = np.zeros([4])
    new_coord[0] = original_coord1[0] - (transformed_point1[0]*ratio)
    new_coord[1] = original_coord1[1] - ((max_dim-transformed_point1[1])*ratio)
    new_coord[2:] = max_dim*ratio

    aligned_image = cv2.warpAffine(img_img, transformation_matrix, (max_dim, max_dim))
    aligned_label = cv2.warpAffine(label_img, transformation_matrix, (max_dim, max_dim), flags=cv2.INTER_NEAREST)

    # Convert the transformed image to grayscale
    aligned_gray = cv2.cvtColor(aligned_image, cv2.COLOR_BGR2GRAY)

    # Find contours in the image
    contours, _ = cv2.findContours(aligned_gray, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Find the bounding box of the main contour (assuming it's the largest)
    largest_contour = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest_contour)

    # Crop the image to the bounding box
    aligned_cropped_label = aligned_label[y:y+h, x:x+w]

    new_coord[0] = new_coord[0] + (x*ratio)
    new_coord[1] = new_coord[1] + ((max_dim-(y+h))*ratio) 
    new_coord[2] = w*ratio
    new_coord[3] = h*ratio 

    return aligned_cropped_label, new_coord

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png'}

def createLableMap(images, path):

    new_coord = np.zeros([4])

    for image in images:
        if image.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if image and allowed_file(image.filename):

            filename_org = image.filename
            image_path = os.path.join(path, filename_org)
            image.save(image_path)

            try:
                # Extracting metadata information
                image_tmp = Image.open(image_path)
                metadata = image_tmp.info
                label_counts = metadata["info"]
                image_description_str = metadata["coord"]
                decimalX, decimalY, decimalWidth, decimalHeight = map(Decimal, image_description_str.split(' '))
 
            except:
                return jsonify({'error': 'No metadata'}), 400

            new_coord[0] = decimalX
            new_coord[1] = decimalY
            new_coord[2] = np.abs(decimalWidth)
            new_coord[3] = np.abs(decimalHeight)

    return image_path, new_coord, label_counts


def merge_dictionaries(dic1, dic2):
    merged_dict = dic1.copy()
    used_colors = set(merged_dict.keys())
    newMap = []

    for key, value in dic2.items():
        if key in merged_dict:
            if merged_dict[key] != value:
                new_key = generate_unique_color(used_colors)
                merged_dict[new_key] = value
                newMap.append([key, new_key])
        else:
            merged_dict[key] = value
    return newMap, merged_dict

def generate_unique_color(used_colors):
    while True:
        rgb = tuple(random.randint(0, 255) for _ in range(3))
        if rgb not in used_colors:
            return ",".join(map(str, rgb))

def updateImage(image_rgb, newMap):
    for color_pair in newMap:
        old_color = tuple(map(int, color_pair[0].split(',')))
        new_color = tuple(map(int, color_pair[1].split(',')))
        mask = np.all(image_rgb == old_color, axis=-1)
        image_rgb[mask] = new_color

    return image_rgb