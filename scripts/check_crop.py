import rasterio
import numpy as np

path = "data/terrain/velachery_dem.tif"

with rasterio.open(path) as src:
    data = src.read(1).astype(np.float32)

    print("========== CROPPED DEM ==========")
    print("CRS:", src.crs)
    print("Size:", data.shape)
    print("Bounds:", src.bounds)
    print("Resolution:", src.res)
    print("NoData:", src.nodata)

    valid = data[data != src.nodata]

    print("Minimum:", np.min(valid))
    print("Maximum:", np.max(valid))
    print("Mean:", np.mean(valid))
    print("=================================")