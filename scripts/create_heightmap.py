import rasterio
import numpy as np
from PIL import Image

input_path = "data/terrain/output_hh.tif"
output_path = "public/velachery-heightmap.png"

with rasterio.open(input_path) as src:
    elevation = src.read(1).astype(np.float32)

    minimum = np.min(elevation)
    maximum = np.max(elevation)

    # Convert elevation values to 0-255
    normalized = (elevation - minimum) / (maximum - minimum)

    heightmap = (normalized * 255).astype(np.uint8)

    Image.fromarray(heightmap).save(output_path)

print("========== HEIGHTMAP ==========")
print("Minimum elevation:", minimum)
print("Maximum elevation:", maximum)
print("Heightmap size:", heightmap.shape)
print("Saved to:", output_path)
print("===============================")