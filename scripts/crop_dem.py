import rasterio
from rasterio.windows import from_bounds

input_path = "data/terrain/P5_PAN_CD_N12_000_E080_000_DEM_30m.tif"
output_path = "data/terrain/velachery_dem.tif"

# Approx. 2 km x 2 km area around Velachery
left = 80.211
right = 80.229
bottom = 12.971
top = 12.989

with rasterio.open(input_path) as src:

    window = from_bounds(
        left,
        bottom,
        right,
        top,
        src.transform
    )

    # Make the window use whole pixels
    window = window.round_offsets().round_lengths()

    data = src.read(1, window=window)

    transform = src.window_transform(window)

    profile = src.profile.copy()

    profile.update(
        width=window.width,
        height=window.height,
        transform=transform,
        compress="lzw"
    )

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(data, 1)

print("Terrain crop created successfully!")
print("Saved to:", output_path)
print("Size:", data.shape)