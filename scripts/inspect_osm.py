import geopandas as gpd
from pathlib import Path

osm_dir = Path("data/osm")

gpkg_files = list(osm_dir.glob("*.gpkg"))

if not gpkg_files:
    print("ERROR: No .gpkg file found in data/osm")
    raise SystemExit(1)

gpkg = gpkg_files[0]

print("=" * 50)
print("OSM FILE:")
print(gpkg)
print("=" * 50)

layers = gpd.list_layers(gpkg)

print("\nAVAILABLE LAYERS:")
print(layers)

print("\n" + "=" * 50)

for layer_name in layers["name"]:
    try:
        gdf = gpd.read_file(gpkg, layer=layer_name)

        print(f"\nLAYER: {layer_name}")
        print(f"Features: {len(gdf)}")
        print(f"Geometry: {gdf.geometry.geom_type.value_counts().to_dict()}")
        print(f"CRS: {gdf.crs}")

    except Exception as e:
        print(f"\nCould not read {layer_name}: {e}")

print("\n" + "=" * 50)
print("Inspection complete!")