"use client";

import {
  MIN_LON,
  MAX_LON,
  MIN_LAT,
  MAX_LAT,
  MIN_ELEVATION,
  MAX_ELEVATION,
} from "@/lib/terrain";

/* ================================================================
   TYPES
================================================================ */

export type FloodAnalysis = {
  totalBuildings: number;
  floodedBuildings: number;
  atRiskBuildings: number;
  totalRoads: number;
  affectedRoads: number;
  overallRisk: number;
};

type BuildingFeature = {
  geometry?: {
    type: string;
    coordinates: any;
  };
};

type BuildingGeoJSON = {
  features: BuildingFeature[];
};

type RoadFeature = {
  geometry?: {
    type: string;
    coordinates: any;
  };
};

type RoadGeoJSON = {
  features: RoadFeature[];
};

/* ================================================================
   FLOOD CONFIGURATION
================================================================ */

/*
 * The UI represents REAL flood depth:
 *
 * 0 → 6 metres
 *
 * Do not change this to 20.
 */
const MAX_FLOOD_DEPTH = 6;

/*
 * IMPORTANT:
 *
 * This MUST MATCH FloodWater.tsx.
 *
 * FloodWater currently uses:
 *
 * const FLOOD_VISUAL_TERRAIN_RANGE = 17;
 *
 * Therefore the analysis must use the same
 * flood elevation mapping.
 *
 * This is what makes the dashboard numbers
 * correspond to the blue water you actually see.
 */
const FLOOD_VISUAL_TERRAIN_RANGE = 17;

/*
 * Building is considered flooded when at least
 * 5 cm of flood water reaches its ground.
 */
const FLOODED_THRESHOLD = 0.05;

/*
 * Building is considered at risk when it is
 * within 1 metre above the flood surface.
 *
 * This is intentionally larger than the old
 * 0.75m because we want the dashboard to
 * identify buildings that are close to the
 * flooding boundary.
 */
const BUILDING_RISK_BUFFER = 1.0;

/*
 * Roads need a smaller threshold because roads
 * are affected even by relatively shallow water.
 */
const ROAD_FLOOD_THRESHOLD = 0.03;

/* ================================================================
   LOAD IMAGE
================================================================ */

function loadImage(
  src: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error(
            `Unable to load ${src}`
          )
        );
      };

      image.src = src;
    }
  );
}

/* ================================================================
   HEIGHTMAP SAMPLER
================================================================ */

function createElevationSampler(
  image: HTMLImageElement
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    image.width;

  canvas.height =
    image.height;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    throw new Error(
      "Could not create heightmap canvas"
    );
  }

  context.drawImage(
    image,
    0,
    0
  );

  const imageData =
    context.getImageData(
      0,
      0,
      image.width,
      image.height
    );

  return (
    lon: number,
    lat: number
  ) => {

    /* ============================================================
       NORMALIZED COORDINATES
    ============================================================ */

    const normalizedX =
      Math.max(
        0,
        Math.min(
          1,
          (
            lon -
            MIN_LON
          ) /
          (
            MAX_LON -
            MIN_LON
          )
        )
      );

    const normalizedY =
      Math.max(
        0,
        Math.min(
          1,
          (
            lat -
            MIN_LAT
          ) /
          (
            MAX_LAT -
            MIN_LAT
          )
        )
      );

    /* ============================================================
       PIXEL
    ============================================================ */

    const pixelX =
      Math.round(
        normalizedX *
        (
          image.width -
          1
        )
      );

    const pixelY =
      Math.round(
        (
          1 -
          normalizedY
        ) *
        (
          image.height -
          1
        )
      );

    const index =
      (
        pixelY *
        image.width +
        pixelX
      ) *
      4;

    const value =
      imageData.data[
        index
      ] ?? 0;

    /* ============================================================
       NORMALIZED HEIGHT
    ============================================================ */

    const normalizedHeight =
      value / 255;

    /* ============================================================
       REAL TERRAIN ELEVATION
    ============================================================ */

    return (
      MIN_ELEVATION +
      normalizedHeight *
      (
        MAX_ELEVATION -
        MIN_ELEVATION
      )
    );
  };
}

/* ================================================================
   BUILDING CENTER
================================================================ */

function getBuildingCenter(
  feature: BuildingFeature
): [number, number] | null {

  const geometry =
    feature.geometry;

  if (!geometry) {
    return null;
  }

  let ring:
    number[][] | null =
    null;

  /* ============================================================
     POLYGON
  ============================================================ */

  if (
    geometry.type ===
    "Polygon"
  ) {
    ring =
      geometry.coordinates?.[0] ??
      null;
  }

  /* ============================================================
     MULTIPOLYGON
  ============================================================ */

  if (
    geometry.type ===
    "MultiPolygon"
  ) {
    ring =
      geometry.coordinates?.[0]?.[0] ??
      null;
  }

  if (
    !ring ||
    ring.length === 0
  ) {
    return null;
  }

  let lon = 0;
  let lat = 0;

  let validPoints = 0;

  for (
    const coordinate of ring
  ) {

    if (
      !coordinate ||
      coordinate.length < 2
    ) {
      continue;
    }

    const pointLon =
      Number(
        coordinate[0]
      );

    const pointLat =
      Number(
        coordinate[1]
      );

    if (
      !Number.isFinite(
        pointLon
      ) ||
      !Number.isFinite(
        pointLat
      )
    ) {
      continue;
    }

    lon += pointLon;
    lat += pointLat;

    validPoints++;
  }

  if (
    validPoints === 0
  ) {
    return null;
  }

  return [
    lon / validPoints,
    lat / validPoints,
  ];
}

/* ================================================================
   ROAD POINTS
================================================================ */

function getRoadPoints(
  feature: RoadFeature
): number[][] {

  const geometry =
    feature.geometry;

  if (!geometry) {
    return [];
  }

  /* ============================================================
     LINE STRING
  ============================================================ */

  if (
    geometry.type ===
    "LineString"
  ) {
    return (
      geometry.coordinates ??
      []
    );
  }

  /* ============================================================
     MULTI LINE STRING
  ============================================================ */

  if (
    geometry.type ===
    "MultiLineString"
  ) {
    return (
      geometry.coordinates?.flat() ??
      []
    );
  }

  return [];
}

/* ================================================================
   CONVERT INPUT TO REAL FLOOD DEPTH
================================================================ */

/*
 * CityScene currently passes the absolute water
 * elevation:
 *
 * MIN_ELEVATION + floodDepth
 *
 * Example:
 *
 * 0m:
 * -6.208936
 *
 * 3m:
 * -3.208936
 *
 * 6m:
 * -0.208936
 *
 * This function also supports a direct 0–6
 * value so the component is more robust.
 */

function getFloodDepth(
  waterLevel: number
): number {

  if (
    !Number.isFinite(
      waterLevel
    )
  ) {
    return 0;
  }

  /*
   * Expected absolute elevation range.
   */
  const absoluteMin =
    MIN_ELEVATION;

  const absoluteMax =
    MIN_ELEVATION +
    MAX_FLOOD_DEPTH;

  /*
   * If the value is inside the absolute
   * elevation range, convert it to depth.
   */
  if (
    waterLevel >=
      absoluteMin &&
    waterLevel <=
      absoluteMax
  ) {

    return Math.max(
      0,
      Math.min(
        MAX_FLOOD_DEPTH,
        waterLevel -
          MIN_ELEVATION
      )
    );
  }

  /*
   * Otherwise assume the caller supplied
   * the depth directly.
   */
  return Math.max(
    0,
    Math.min(
      MAX_FLOOD_DEPTH,
      waterLevel
    )
  );
}

/* ================================================================
   GET FLOOD ELEVATION
================================================================ */

/*
 * THIS IS THE IMPORTANT PART.
 *
 * It matches FloodWater.tsx.
 *
 * The real terrain spans roughly:
 *
 * -6.2 → 20.1
 *
 * But a 0–6m flood should visually affect
 * a useful portion of the city.
 *
 * Therefore:
 *
 * flood 0m → MIN_ELEVATION
 *
 * flood 6m → MIN_ELEVATION + 17m
 *
 * This is exactly the same mapping used
 * by FloodWater.tsx.
 */

function getFloodElevation(
  floodDepth: number
): number {

  const normalizedFlood =
    Math.max(
      0,
      Math.min(
        1,
        floodDepth /
          MAX_FLOOD_DEPTH
      )
    );

  return (
    MIN_ELEVATION +
    normalizedFlood *
    FLOOD_VISUAL_TERRAIN_RANGE
  );
}

/* ================================================================
   FLOOD ANALYSIS
================================================================ */

export async function analyzeFlood(
  waterLevel: number
): Promise<FloodAnalysis> {

  /* ==============================================================
     LOAD DATA
  ============================================================== */

  const [
    buildingsResponse,
    roadsResponse,
    heightmap,
  ] =
    await Promise.all([
      fetch(
        "/buildings.geojson"
      ),

      fetch(
        "/roads.geojson"
      ),

      loadImage(
        "/velachery-heightmap.png"
      ),
    ]);

  /* ==============================================================
     VALIDATE BUILDINGS
  ============================================================== */

  if (
    !buildingsResponse.ok
  ) {
    throw new Error(
      "Could not load buildings.geojson"
    );
  }

  /* ==============================================================
     VALIDATE ROADS
  ============================================================== */

  if (
    !roadsResponse.ok
  ) {
    throw new Error(
      "Could not load roads.geojson"
    );
  }

  /* ==============================================================
     PARSE DATA
  ============================================================== */

  const buildings =
    (await buildingsResponse.json()) as
      BuildingGeoJSON;

  const roads =
    (await roadsResponse.json()) as
      RoadGeoJSON;

  /* ==============================================================
     ELEVATION FUNCTION
  ============================================================== */

  const getElevation =
    createElevationSampler(
      heightmap
    );

  /* ==============================================================
     FLOOD LEVEL
  ============================================================== */

  /*
   * Convert CityScene's waterLevel
   * into the same 0–6m depth used
   * by the water.
   */
  const floodDepth =
    getFloodDepth(
      waterLevel
    );

  /*
   * Calculate the SAME flood surface
   * used by FloodWater.tsx.
   */
  const floodElevation =
    getFloodElevation(
      floodDepth
    );

  /* ==============================================================
     BUILDINGS
  ============================================================== */

  let floodedBuildings =
    0;

  let atRiskBuildings =
    0;

  for (
    const building of
      buildings.features
  ) {

    const center =
      getBuildingCenter(
        building
      );

    if (!center) {
      continue;
    }

    const elevation =
      getElevation(
        center[0],
        center[1]
      );

    /*
     * Local water depth at the
     * building.
     */
    const localDepth =
      Math.max(
        0,
        floodElevation -
        elevation
      );

    /* ==========================================================
       FLOODED
    ========================================================== */

    if (
      localDepth >
      FLOODED_THRESHOLD
    ) {
      floodedBuildings++;
    }

    /* ==========================================================
       AT RISK
       
       Either:
       
       1. Already flooded
       
       OR
       
       2. Within the risk buffer
          above the flood surface.
    ========================================================== */

    if (
      elevation <=
      floodElevation +
      BUILDING_RISK_BUFFER
    ) {
      atRiskBuildings++;
    }
  }

  /* ==============================================================
     ROADS
  ============================================================== */

  let affectedRoads =
    0;

  for (
    const road of
      roads.features
  ) {

    const points =
      getRoadPoints(
        road
      );

    if (
      points.length < 2
    ) {
      continue;
    }

    /*
     * Sample up to approximately
     * 12 points along each road.
     *
     * This is more reliable than
     * the old 8-point sampling.
     */
    const step =
      Math.max(
        1,
        Math.floor(
          points.length /
          12
        )
      );

    let roadAffected =
      false;

    for (
      let i = 0;
      i < points.length;
      i += step
    ) {

      const coordinate =
        points[i];

      if (
        !coordinate ||
        coordinate.length < 2
      ) {
        continue;
      }

      const lon =
        Number(
          coordinate[0]
        );

      const lat =
        Number(
          coordinate[1]
        );

      if (
        !Number.isFinite(
          lon
        ) ||
        !Number.isFinite(
          lat
        )
      ) {
        continue;
      }

      /* ========================================================
         KEEP ONLY CITY AREA
      ======================================================== */

      if (
        lon < MIN_LON ||
        lon > MAX_LON ||
        lat < MIN_LAT ||
        lat > MAX_LAT
      ) {
        continue;
      }

      /* ========================================================
         TERRAIN
      ======================================================== */

      const elevation =
        getElevation(
          lon,
          lat
        );

      /* ========================================================
         LOCAL WATER
      ======================================================== */

      const localDepth =
        Math.max(
          0,
          floodElevation -
          elevation
        );

      /*
       * Even shallow water affects
       * roads.
       */
      if (
        localDepth >
        ROAD_FLOOD_THRESHOLD
      ) {

        roadAffected =
          true;

        break;
      }
    }

    if (
      roadAffected
    ) {
      affectedRoads++;
    }
  }

  /* ==============================================================
     TOTALS
  ============================================================== */

  const totalBuildings =
    buildings.features.length;

  const totalRoads =
    roads.features.length;

  /* ==============================================================
     BUILDING RISK %
  ============================================================== */

  const buildingRisk =
    totalBuildings > 0
      ? (
          atRiskBuildings /
          totalBuildings
        ) *
        100
      : 0;

  /* ==============================================================
     ROAD RISK %
  ============================================================== */

  const roadRisk =
    totalRoads > 0
      ? (
          affectedRoads /
          totalRoads
        ) *
        100
      : 0;

  /* ==============================================================
     OVERALL RISK
  ============================================================== */

  /*
   * Buildings have slightly more weight
   * because they are the primary impact
   * indicator.
   */
  const overallRisk =
    Math.min(
      100,
      Math.round(
        buildingRisk *
          0.65 +
        roadRisk *
          0.35
      )
    );

  /* ==============================================================
     RETURN
  ============================================================== */

  return {
    totalBuildings,

    floodedBuildings,

    atRiskBuildings,

    totalRoads,

    affectedRoads,

    overallRisk,
  };
}