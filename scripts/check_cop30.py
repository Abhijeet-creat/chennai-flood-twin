import rasterio
import numpy as np

path = "data/terrain/output_hh.tif"

with rasterio.open(path) as src:
    data = src.read(1).astype(np.float32)

    print("========== COPERNICUS GLO-30 ==========")
    print("CRS:", src.crs)
    print("Size:", data.shape)
    print("Bounds:", src.bounds)
    print("Resolution:", src.res)
    print("NoData:", src.nodata)
    print("Minimum:", np.nanmin(data))
    print("Maximum:", np.nanmax(data))
    print("Mean:", np.nanmean(data))
    print("=======================================")