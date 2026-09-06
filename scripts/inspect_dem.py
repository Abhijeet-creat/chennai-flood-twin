import rasterio

dem_path = "data/terrain/P5_PAN_CD_N12_000_E080_000_DEM_30m.tif"

with rasterio.open(dem_path) as dem:
    print("========== DEM INFORMATION ==========")
    print("Width:", dem.width)
    print("Height:", dem.height)
    print("Bands:", dem.count)
    print("Coordinate System:", dem.crs)
    print("Bounds:", dem.bounds)
    print("Resolution:", dem.res)
    print("NoData value:", dem.nodata)
    print("Minimum elevation:", dem.read(1, masked=True).min())
    print("Maximum elevation:", dem.read(1, masked=True).max())
    print("=====================================")