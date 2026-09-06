import rasterio

path = "data/terrain/velachery_dem.tif"

with rasterio.open(path) as src:
    print("========== DEM METADATA ==========")

    print("\nProfile:")
    print(src.profile)

    print("\nTags:")
    print(src.tags())

    print("\nBand 1 tags:")
    print(src.tags(1))

    print("\nScales:")
    print(src.scales)

    print("\nOffsets:")
    print(src.offsets)

    print("\nDtypes:")
    print(src.dtypes)

    print("==================================")