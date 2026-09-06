import geopandas as gpd
from pathlib import Path

osm_dir = Path("data/osm")
gpkg = list(osm_dir.glob("*.gpkg"))[0]

print("=" * 60)
print("INSPECTING OSM TAGS")
print("=" * 60)

# -----------------------------
# MULTIPOLYGONS
# -----------------------------

polygons = gpd.read_file(gpkg, layer="multipolygons")

print("\nMULTIPOLYGON COLUMNS:")
print(polygons.columns.tolist())

print("\nBUILDING TAGS:")
if "building" in polygons.columns:
    print(polygons["building"].value_counts().head(30))
else:
    print("No 'building' column found.")

# -----------------------------
# LINES
# -----------------------------

lines = gpd.read_file(gpkg, layer="lines")

print("\n" + "=" * 60)
print("LINE COLUMNS:")
print(lines.columns.tolist())

print("\nHIGHWAY TAGS:")

if "highway" in lines.columns:
    print(lines["highway"].value_counts().head(40))
else:
    print("No 'highway' column found.")

print("\n" + "=" * 60)
print("Inspection complete!")