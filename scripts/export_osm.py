import geopandas as gpd
from pathlib import Path


# --------------------------------------------------
# Paths
# --------------------------------------------------

osm_dir = Path("data/osm")
output_dir = Path("data")

gpkg_files = list(osm_dir.glob("*.gpkg"))

if not gpkg_files:
    raise FileNotFoundError("No .gpkg file found in data/osm")

gpkg = gpkg_files[0]

print("=" * 60)
print("EXPORTING VELACHERY OSM DATA")
print("=" * 60)
print(f"Source: {gpkg}")


# --------------------------------------------------
# BUILDINGS
# --------------------------------------------------

print("\nLoading buildings...")

polygons = gpd.read_file(
    gpkg,
    layer="multipolygons"
)

buildings = polygons[
    polygons["building"].notna()
].copy()

print(f"Buildings found: {len(buildings)}")

# Keep only useful columns
buildings = buildings[
    ["osm_id", "name", "building", "geometry"]
]

# Remove invalid geometries
buildings = buildings[
    buildings.geometry.notna()
]

buildings = buildings[
    ~buildings.geometry.is_empty
]

# Make sure CRS is WGS84
buildings = buildings.to_crs("EPSG:4326")

# Create output folder
buildings_dir = output_dir / "buildings"
buildings_dir.mkdir(parents=True, exist_ok=True)

buildings_file = buildings_dir / "buildings.geojson"

buildings.to_file(
    buildings_file,
    driver="GeoJSON"
)

print(f"Buildings saved to:")
print(buildings_file)


# --------------------------------------------------
# ROADS
# --------------------------------------------------

print("\nLoading roads...")

lines = gpd.read_file(
    gpkg,
    layer="lines"
)

roads = lines[
    lines["highway"].notna()
].copy()

# Remove footpaths/steps for the main 3D road network
roads = roads[
    ~roads["highway"].isin([
        "footway",
        "path",
        "steps"
    ])
]

print(f"Road segments found: {len(roads)}")

# Keep useful columns
roads = roads[
    ["osm_id", "name", "highway", "geometry"]
]

roads = roads[
    roads.geometry.notna()
]

roads = roads[
    ~roads.geometry.is_empty
]

roads = roads.to_crs("EPSG:4326")

roads_dir = output_dir / "roads"
roads_dir.mkdir(parents=True, exist_ok=True)

roads_file = roads_dir / "roads.geojson"

roads.to_file(
    roads_file,
    driver="GeoJSON"
)

print(f"Roads saved to:")
print(roads_file)


# --------------------------------------------------
# SUMMARY
# --------------------------------------------------

print("\n" + "=" * 60)
print("EXPORT COMPLETE")
print("=" * 60)

print(f"Buildings : {len(buildings)}")
print(f"Roads     : {len(roads)}")

print("\nCreated:")

print(buildings_file)
print(roads_file)

print("=" * 60)