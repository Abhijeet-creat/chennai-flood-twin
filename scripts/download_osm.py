import requests
import json
from pathlib import Path

# --------------------------------------------------
# Velachery study area
# --------------------------------------------------

SOUTH = 12.970972
WEST = 80.210972
NORTH = 12.989028
EAST = 80.229028

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

query = f"""
[out:json][timeout:120];

(
  way["building"]({SOUTH},{WEST},{NORTH},{EAST});
  way["highway"]({SOUTH},{WEST},{NORTH},{EAST});
);

out geom;
"""

print("Downloading OSM data...")
print(f"Area: {SOUTH}, {WEST} → {NORTH}, {EAST}")

# --------------------------------------------------
# Important: Overpass now checks request headers
# --------------------------------------------------

headers = {
    "User-Agent": "ChennaiFloodTwin/1.0 (student-project)",
    "Accept": "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
}

try:
    response = requests.post(
        OVERPASS_URL,
        data={"data": query},
        headers=headers,
        timeout=180,
    )

    print(f"HTTP status: {response.status_code}")

    if response.status_code != 200:
        print("Server response:")
        print(response.text[:2000])
        response.raise_for_status()

    data = response.json()

except requests.RequestException as e:
    print()
    print("ERROR: Could not download OSM data.")
    print(e)
    raise SystemExit(1)

# --------------------------------------------------
# Separate buildings and roads
# --------------------------------------------------

buildings = []
roads = []

for element in data.get("elements", []):

    tags = element.get("tags", {})
    geometry = element.get("geometry", [])

    if not geometry:
        continue

    coordinates = [
        [point["lon"], point["lat"]]
        for point in geometry
    ]

    # -----------------------------
    # Buildings
    # -----------------------------

    if "building" in tags and len(coordinates) >= 3:

        # Close polygon if necessary
        if coordinates[0] != coordinates[-1]:
            coordinates.append(coordinates[0])

        buildings.append({
            "type": "Feature",
            "properties": tags,
            "geometry": {
                "type": "Polygon",
                "coordinates": [coordinates]
            }
        })

    # -----------------------------
    # Roads
    # -----------------------------

    if "highway" in tags and len(coordinates) >= 2:

        roads.append({
            "type": "Feature",
            "properties": tags,
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            }
        })

# --------------------------------------------------
# Create folders
# --------------------------------------------------

Path("data/buildings").mkdir(
    parents=True,
    exist_ok=True
)

Path("data/roads").mkdir(
    parents=True,
    exist_ok=True
)

# --------------------------------------------------
# Save buildings
# --------------------------------------------------

with open(
    "data/buildings/buildings.geojson",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        {
            "type": "FeatureCollection",
            "features": buildings
        },
        f,
        indent=2
    )

# --------------------------------------------------
# Save roads
# --------------------------------------------------

with open(
    "data/roads/roads.geojson",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        {
            "type": "FeatureCollection",
            "features": roads
        },
        f,
        indent=2
    )

# --------------------------------------------------
# Finished
# --------------------------------------------------

print()
print("===================================")
print(f"Buildings: {len(buildings)}")
print(f"Roads:     {len(roads)}")
print("===================================")

print()
print("Saved:")
print("  data/buildings/buildings.geojson")
print("  data/roads/roads.geojson")