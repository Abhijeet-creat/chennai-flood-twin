"use client";

import {
  getEarthquakeDamage,
  getEarthquakeColor,
  getEarthquakeDamageLevel,
  type EarthquakeOrigin,
} from "@/lib/earthquake";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useFrame,
  useLoader,
} from "@react-three/fiber";

import * as THREE from "three";

import { mergeGeometries } from
  "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  TERRAIN_SIZE,
  ELEVATION_SCALE,
  lonToX,
  latToZ,
} from "@/lib/terrain";

/* ================================================================
   TYPES
================================================================ */

type GeoJSONGeometry =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

type BuildingFeature = {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties?:
    | Record<string, unknown>
    | null;
};

type BuildingGeoJSON = {
  type: "FeatureCollection";
  features: BuildingFeature[];
};

export type SelectedBuilding = {
  index: number;

  longitude: number;
  latitude: number;

  terrainElevation: number;

  height: number;

  floodDepth: number;

  properties:
    Record<string, unknown>;

  centerX: number;
  centerZ: number;

  /* Earthquake inspection data. */
  earthquakeDamage: number;
  earthquakeDistance: number | null;
  earthquakeStatus:
    | "safe"
    | "minor"
    | "moderate"
    | "severe"
    | "destroyed";
};

type BuildingsProps = {
  waterLevel?: number;

  onBuildingSelect?: (
    building: SelectedBuilding
  ) => void;

  earthquakeOrigin?: EarthquakeOrigin | null;

  earthquakeMagnitude?: number;

  earthquakeActive?: boolean;

  earthquakeSelectionMode?: boolean;

  onEarthquakePoint?: (
    point: EarthquakeOrigin
  ) => void;
};

/* ================================================================
   PREPARED BUILDING
================================================================ */

type PreparedBuilding = {
  geometry: THREE.BufferGeometry;

  terrainElevation: number;

  visualElevation: number;

  baseColor: THREE.Color;

  height: number;

  minX: number;
  maxX: number;

  minZ: number;
  maxZ: number;

  centerX: number;
  centerZ: number;

  longitude: number;
  latitude: number;

  properties:
    Record<string, unknown>;

  index: number;
};

/* ================================================================
   COLOR RANGE
================================================================ */

type BuildingColorRange = {
  start: number;

  count: number;

  terrainElevation: number;

  baseColor: THREE.Color;

  height: number;

  prepared: PreparedBuilding;
};

type BuildingBatch = {
  geometry: THREE.BufferGeometry;

  buildings: BuildingColorRange[];

  /*
   * Original geometry positions.
   *
   * We always deform from this copy instead
   * of deforming the already-deformed geometry.
   */
  basePositions: Float32Array;
};

/* ================================================================
   CONSTANTS
================================================================ */

const MIN_ELEVATION =
  -6.208936;

const MAX_ELEVATION =
  20.089691;

/* ================================================================
   FLOOD REACH — MUST MATCH FloodWater.tsx
================================================================ */

const MAX_FLOOD_DEPTH = 6;
const FLOOD_VISUAL_TERRAIN_RANGE = 17;
const FLOOD_REACH_EXPONENT = 0.55;

function getFloodSurfaceElevation(
  floodDepth: number
): number {
  const normalized = THREE.MathUtils.clamp(
    floodDepth / MAX_FLOOD_DEPTH,
    0,
    1
  );

  const curved = Math.pow(
    normalized,
    FLOOD_REACH_EXPONENT
  );

  return (
    MIN_ELEVATION +
    curved * FLOOD_VISUAL_TERRAIN_RANGE
  );
}

const BUILDING_OFFSET =
  0.035;

const DEFAULT_HEIGHT =
  0.28;

const MIN_HEIGHT =
  0.12;

const MAX_HEIGHT =
  3.5;

const WARNING_DEPTH =
  0.15;

const HIGH_DEPTH =
  0.35;

const SEVERE_DEPTH =
  0.60;

const BATCH_SIZE =
  750;

/* ================================================================
   WINDOW SETTINGS
================================================================ */

const WINDOW_WIDTH =
  0.045;

const WINDOW_HEIGHT =
  0.065;

const WINDOW_DEPTH =
  0.014;

const WINDOW_WALL_OFFSET =
  0.018;

const WINDOW_HORIZONTAL_SPACING =
  0.18;

const WINDOW_VERTICAL_SPACING =
  0.22;

const MAX_WINDOWS_PER_BUILDING =
  32;

const WINDOW_COLOR =
  new THREE.Color("#8fc9df");

const WINDOW_WARM_COLOR =
  new THREE.Color("#e6c982");

const WINDOW_DARK_COLOR =
  new THREE.Color("#355c70");

const WINDOW_EMISSIVE =
  new THREE.Color("#173c4d");

/* ================================================================
   FLOOD COLORS
================================================================ */

const WARNING_COLOR =
  new THREE.Color("#facc15");

const HIGH_COLOR =
  new THREE.Color("#f97316");

const SEVERE_COLOR =
  new THREE.Color("#ef4444");

/* ================================================================
   BUILDING COLORS
================================================================ */

const RESIDENTIAL_COLORS = [
  "#8f8b82", "#a39a8c", "#b0a38f", "#77746d", "#9a958a", "#b7aa96",
];

const APARTMENT_COLORS = [
  "#777a78", "#8b8d88", "#9b9890", "#6f7371", "#aaa69c", "#858a88",
];

const COMMERCIAL_COLORS = [
  "#686d6d", "#777c7b", "#858887", "#5f6667", "#92928c",
];

const RETAIL_COLORS = [
  "#9a8d7b", "#aa9b87", "#897c6c", "#b1a28d", "#7d7367",
];

const INDUSTRIAL_COLORS = [
  "#666b68", "#737773", "#858681", "#5c625f", "#96958c",
];

const HOSPITAL_COLORS = [
  "#b9b9b2", "#a9aaa5", "#c7c7c0", "#989b98",
];

const SCHOOL_COLORS = [
  "#9d927f", "#aa9d87", "#8c816f", "#b0a28a", "#7f7769",
];

const OTHER_COLORS = [
  "#89867d", "#9a9386", "#77766f", "#a69b88", "#707872", "#858b88",
];

/* ================================================================
   NUMBER
================================================================ */


function getNumber(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const number =
      Number(
        value
          .replace(",", ".")
          .replace(/m/gi, "")
          .trim()
      );

    if (
      Number.isFinite(number)
    ) {
      return number;
    }
  }

  return null;
}

/* ================================================================
   BUILDING TYPE
================================================================ */

function getBuildingType(
  properties:
    | Record<string, unknown>
    | null
    | undefined
): string {
  if (!properties) {
    return "other";
  }

  return String(
    properties.building ?? ""
  ).toLowerCase();
}

/* ================================================================
   BUILDING HEIGHT
================================================================ */

function getBuildingHeight(
  properties:
    | Record<string, unknown>
    | null
    | undefined,
  index: number
): number {
  if (!properties) {
    return THREE.MathUtils.clamp(
      DEFAULT_HEIGHT *
        (
          0.85 +
          ((index * 17) % 25) /
            100
        ),
      MIN_HEIGHT,
      MAX_HEIGHT
    );
  }

  const explicitHeight =
    getNumber(
      properties.height
    );

  if (
    explicitHeight !== null
  ) {
    return THREE.MathUtils.clamp(
      explicitHeight * 0.06,
      MIN_HEIGHT,
      MAX_HEIGHT
    );
  }

  const levels =
    getNumber(
      properties[
        "building:levels"
      ]
    ) ??
    getNumber(
      properties.levels
    );

  if (
    levels !== null
  ) {
    const variation =
      0.94 +
      ((index * 13) % 10) /
        100;

    return THREE.MathUtils.clamp(
      levels *
        0.28 *
        variation,
      MIN_HEIGHT,
      MAX_HEIGHT
    );
  }

  const type =
    getBuildingType(
      properties
    );

  let height =
    DEFAULT_HEIGHT;

  switch (type) {
    case "apartments":
      height = 1.05;
      break;

    case "commercial":
      height = 0.88;
      break;

    case "retail":
      height = 0.58;
      break;

    case "industrial":
      height = 0.62;
      break;

    case "hospital":
      height = 1.15;
      break;

    case "school":
      height = 0.78;
      break;

    case "house":
    case "detached":
    case "semidetached_house":
    case "terrace":
    case "residential":
      height = 0.30;
      break;

    default:
      height =
        DEFAULT_HEIGHT;
  }

  const variation =
    0.85 +
    ((index * 29) % 20) /
      100;

  return THREE.MathUtils.clamp(
    height * variation,
    MIN_HEIGHT,
    MAX_HEIGHT
  );
}

/* ================================================================
   BASE COLOR
================================================================ */

function getBuildingBaseColor(
  properties:
    | Record<string, unknown>
    | null
    | undefined,
  index: number
): THREE.Color {
  const type =
    getBuildingType(
      properties
    );

  let palette: string[];

  switch (type) {
    case "apartments":
      palette =
        APARTMENT_COLORS;
      break;

    case "commercial":
      palette =
        COMMERCIAL_COLORS;
      break;

    case "retail":
      palette =
        RETAIL_COLORS;
      break;

    case "industrial":
      palette =
        INDUSTRIAL_COLORS;
      break;

    case "hospital":
      palette =
        HOSPITAL_COLORS;
      break;

    case "school":
      palette =
        SCHOOL_COLORS;
      break;

    case "residential":
    case "house":
    case "detached":
    case "semidetached_house":
    case "terrace":
      palette =
        RESIDENTIAL_COLORS;
      break;

    default:
      palette =
        OTHER_COLORS;
  }

  let colorValue =
    palette[
      index %
        palette.length
    ];

  const pattern =
    (index * 37) % 17;

  if (
    pattern === 3 ||
    pattern === 11
  ) {
    const accentColors = [
      "#71899a",
      "#7f927b",
      "#b48768",
      "#8d879c",
    ];

    colorValue =
      accentColors[
        index %
          accentColors.length
      ];
  }

  const color =
    new THREE.Color(
      colorValue
    );

  const variation =
    ((index * 17) % 9 - 4) /
    100;

  color.multiplyScalar(
    1 + variation
  );

  return color;
}

/* ================================================================
   POLYGONS
================================================================ */

function getPolygons(
  geometry: GeoJSONGeometry
): number[][][][] {
  if (
    geometry.type ===
    "Polygon"
  ) {
    return [
      geometry.coordinates,
    ];
  }

  return geometry.coordinates;
}

/* ================================================================
   CENTER
================================================================ */

function getCenter(
  rings: number[][][]
) {
  const outer =
    rings[0];

  if (
    !outer ||
    outer.length === 0
  ) {
    return null;
  }

  let lon = 0;
  let lat = 0;

  for (
    const coordinate of outer
  ) {
    lon +=
      coordinate[0];

    lat +=
      coordinate[1];
  }

  return {
    lon:
      lon /
      outer.length,

    lat:
      lat /
      outer.length,
  };
}

/* ================================================================
   SHAPE
================================================================ */

function createShape(
  rings: number[][][],
  centerLon: number,
  centerLat: number
): THREE.Shape | null {
  const outer =
    rings[0];

  if (
    !outer ||
    outer.length < 3
  ) {
    return null;
  }

  const shape =
    new THREE.Shape();

  for (
    let i = 0;
    i < outer.length;
    i++
  ) {
    const coordinate =
      outer[i];

    const x =
      lonToX(
        coordinate[0]
      ) -
      lonToX(
        centerLon
      );

    const y =
      latToZ(
        coordinate[1]
      ) -
      latToZ(
        centerLat
      );

    if (i === 0) {
      shape.moveTo(
        x,
        y
      );
    } else {
      shape.lineTo(
        x,
        y
      );
    }
  }

  shape.closePath();

  for (
    let r = 1;
    r < rings.length;
    r++
  ) {
    const ring =
      rings[r];

    if (
      !ring ||
      ring.length < 3
    ) {
      continue;
    }

    const hole =
      new THREE.Path();

    for (
      let i = 0;
      i < ring.length;
      i++
    ) {
      const coordinate =
        ring[i];

      const x =
        lonToX(
          coordinate[0]
        ) -
        lonToX(
          centerLon
        );

      const y =
        latToZ(
          coordinate[1]
        ) -
        latToZ(
          centerLat
        );

      if (i === 0) {
        hole.moveTo(
          x,
          y
        );
      } else {
        hole.lineTo(
          x,
          y
        );
      }
    }

    hole.closePath();

    shape.holes.push(
      hole
    );
  }

  return shape;
}

/* ================================================================
   TERRAIN SAMPLER
================================================================ */

function createTerrainSampler(
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
    return null;
  }

  context.drawImage(
    image,
    0,
    0
  );

  const pixels =
    context.getImageData(
      0,
      0,
      image.width,
      image.height
    ).data;

  return {
    pixels,
    width:
      image.width,
    height:
      image.height,
  };
}

/* ================================================================
   TERRAIN HEIGHT
================================================================ */
function getTerrain(
  x: number,
  z: number,
  sampler: ReturnType<
    typeof createTerrainSampler
  >
) {
  if (!sampler) {
    return {
      visualHeight: 0,
      elevation: MIN_ELEVATION,
    };
  }

  /*
   * IMPORTANT:
   *
   * The terrain uses an inverted Z axis because
   * latitude is converted using latToZ().
   *
   * Therefore:
   *
   * world Z -> heightmap Y
   *
   * must use:
   *
   * -z / TERRAIN_SIZE + 0.5
   *
   * NOT:
   *
   * z / TERRAIN_SIZE + 0.5
   */

  const normalizedX =
    THREE.MathUtils.clamp(
      x / TERRAIN_SIZE + 0.5,
      0,
      1
    );

  const normalizedZ =
    THREE.MathUtils.clamp(
      -z / TERRAIN_SIZE + 0.5,
      0,
      1
    );

  const pixelX =
    Math.round(
      normalizedX *
        (sampler.width - 1)
    );

  const pixelY =
    Math.round(
      (1 - normalizedZ) *
        (sampler.height - 1)
    );

  const index =
    (
      pixelY *
        sampler.width +
      pixelX
    ) * 4;

  const value =
    sampler.pixels[index] ?? 0;

  const normalizedHeight =
    value / 255;

  return {
    visualHeight:
      normalizedHeight *
      ELEVATION_SCALE,

    elevation:
      MIN_ELEVATION +
      normalizedHeight *
        (
          MAX_ELEVATION -
          MIN_ELEVATION
        ),
  };
}

/* ================================================================
   PREPARE BUILDINGS
================================================================ */

function prepareBuildings(
  data: BuildingGeoJSON,
  sampler: ReturnType<
    typeof createTerrainSampler
  >
): PreparedBuilding[] {
  const result:
    PreparedBuilding[] = [];

  if (!sampler) {
    return result;
  }

  let buildingIndex =
    0;

  for (
    const feature of
      data.features
  ) {
    if (
      feature.geometry.type !==
        "Polygon" &&
      feature.geometry.type !==
        "MultiPolygon"
    ) {
      continue;
    }

    const polygons =
      getPolygons(
        feature.geometry
      );

    for (
      const rings of polygons
    ) {
      const center =
        getCenter(
          rings
        );

      if (!center) {
        continue;
      }

      const x =
        lonToX(
          center.lon
        );

      const z =
        latToZ(
          center.lat
        );

      const terrain =
        getTerrain(
          x,
          z,
          sampler
        );

      const shape =
        createShape(
          rings,
          center.lon,
          center.lat
        );

      if (!shape) {
        continue;
      }

      const outer =
        rings[0];

      let minX =
        Infinity;

      let maxX =
        -Infinity;

      let minZ =
        Infinity;

      let maxZ =
        -Infinity;

      for (
        const coordinate of
          outer
      ) {
        const localX =
          lonToX(
            coordinate[0]
          ) -
          lonToX(
            center.lon
          );

        const localZ =
          latToZ(
            coordinate[1]
          ) -
          latToZ(
            center.lat
          );

        minX =
          Math.min(
            minX,
            localX
          );

        maxX =
          Math.max(
            maxX,
            localX
          );

        minZ =
          Math.min(
            minZ,
            localZ
          );

        maxZ =
          Math.max(
            maxZ,
            localZ
          );
      }

      const height =
        getBuildingHeight(
          feature.properties,
          buildingIndex
        );

      const useBevel =
        buildingIndex % 9 ===
          0 &&
        height > 0.35;

      const geometry =
        new THREE.ExtrudeGeometry(
          shape,
          {
            depth:
              height,

            bevelEnabled:
              useBevel,

            bevelSegments: 1,

            bevelSize:
              useBevel
                ? 0.008
                : 0,

            bevelThickness:
              useBevel
                ? 0.008
                : 0,

            steps: 1,

            curveSegments: 1,
          }
        );

      geometry.rotateX(
        -Math.PI / 2
      );

      const visualElevation =
        terrain.visualHeight +
        BUILDING_OFFSET;

      geometry.translate(
        x,
        visualElevation,
        z
      );

      geometry.computeVertexNormals();

      const baseColor =
        getBuildingBaseColor(
          feature.properties,
          buildingIndex
        );

      result.push({
        geometry,

        terrainElevation:
          terrain.elevation,

        visualElevation,

        baseColor,

        height,

        minX,
        maxX,

        minZ,
        maxZ,

        centerX: x,
        centerZ: z,

        longitude:
          center.lon,

        latitude:
          center.lat,

        properties:
          feature.properties ??
          {},

        index:
          buildingIndex,
      });

      buildingIndex++;
    }
  }

  return result;
}

/* ================================================================
   FACADE COLOR
================================================================ */

function getFacadeColor(
  baseColor: THREE.Color,
  localY: number,
  height: number,
  normalY: number,
  index: number
): THREE.Color {
  /* Satellite-style appearance: muted roofs, darker walls, no fake floor bands. */
  const color = baseColor.clone();

  if (normalY > 0.72) {
    color.multiplyScalar(1.04);
  } else if (normalY < -0.72) {
    color.multiplyScalar(0.68);
  } else {
    color.multiplyScalar(0.82);
  }

  const variation = ((index * 17) % 7 - 3) / 100;
  color.multiplyScalar(1 + variation);
  return color;
}

/* ================================================================
   BATCH BUILDINGS
================================================================ */

function createBatches(
  buildings: PreparedBuilding[]
): BuildingBatch[] {
  const batches:
    BuildingBatch[] = [];

  for (
    let i = 0;
    i < buildings.length;
    i += BATCH_SIZE
  ) {
    const chunk =
      buildings.slice(
        i,
        i + BATCH_SIZE
      );

    const geometries =
      chunk.map(
        (building) =>
          building.geometry
      );

    const merged =
      mergeGeometries(
        geometries,
        false
      );

    if (!merged) {
      continue;
    }

    const vertexCount =
      merged.attributes
        .position.count;

    const basePositions =
  (
    merged.attributes
      .position
      .array as Float32Array
  ).slice();

    const positions =
      merged.attributes
        .position;

    const normals =
      merged.attributes
        .normal;

    const colors =
      new Float32Array(
        vertexCount * 3
      );

    let colorVertex = 0;

    for (
      let buildingIndex = 0;
      buildingIndex <
      chunk.length;
      buildingIndex++
    ) {
      const building =
        chunk[
          buildingIndex
        ];

      const count =
        building.geometry
          .attributes
          .position.count;

      const minY =
        building.geometry
          .boundingBox
          ?.min.y ?? 0;

      for (
        let v = 0;
        v < count;
        v++
      ) {
        const globalVertex =
          colorVertex;

        const worldY =
          positions.getY(
            globalVertex
          );

        const localY =
          THREE.MathUtils.clamp(
            worldY - minY,
            0,
            building.height
          );

        const normalY =
          normals.getY(
            globalVertex
          );

        const color =
          getFacadeColor(
            building.baseColor,
            localY,
            building.height,
            normalY,
            buildingIndex
          );

        colors[
          globalVertex * 3
        ] =
          color.r;

        colors[
          globalVertex * 3 + 1
        ] =
          color.g;

        colors[
          globalVertex * 3 + 2
        ] =
          color.b;

        colorVertex++;
      }
    }

    merged.setAttribute(
      "color",
      new THREE.BufferAttribute(
        colors,
        3
      )
    );

    merged.computeBoundingSphere();

    const buildingRanges:
      BuildingColorRange[] = [];

    let vertexOffset = 0;

    for (
      const building of chunk
    ) {
      const count =
        building.geometry
          .attributes
          .position.count;

      buildingRanges.push({
        start:
          vertexOffset,

        count,

        terrainElevation:
          building.terrainElevation,

        baseColor:
          building.baseColor,

        height:
          building.height,

        prepared:
          building,
      });

      vertexOffset += count;
    }

batches.push({
  geometry:
    merged,

  buildings:
    buildingRanges,

  basePositions,
});

  }

  return batches;
}

/* ================================================================
   FLOOD COLOR
================================================================ */

function getFloodColor(
  floodDepth: number
): THREE.Color | null {
  if (floodDepth <= 0) {
    return null;
  }

  // 0.00 - 0.15 m: keep the original building color.
  if (floodDepth < 0.15) {
    return null;
  }

  // 0.15 - 0.50 m: shallow flooding.
  if (floodDepth < 0.50) {
    return new THREE.Color("#facc15");
  }

  // 0.50 - 1.00 m: moderate flooding.
  if (floodDepth < 1.00) {
    return new THREE.Color("#f97316");
  }

  // 1.00 - 2.00 m: high flooding.
  if (floodDepth < 2.00) {
    return new THREE.Color("#ef4444");
  }

  // 2.00 m and above: severe flooding.
  return new THREE.Color("#b91c1c");
}

/* ================================================================
   UPDATE BUILDING COLORS
================================================================ */
function updateBuildingColors(
  batches: BuildingBatch[],
  waterLevel: number,
  selectedIndex:
    | number
    | null,
  earthquakeOrigin:
    | EarthquakeOrigin
    | null,
  earthquakeMagnitude: number,
  earthquakeActive: boolean
) {
  for (
    const batch of batches
  ) {
    const colorAttribute =
      batch.geometry.getAttribute(
        "color"
      ) as THREE.BufferAttribute;

    for (
      const building of
        batch.buildings
    ) {
      const floodDepth =
        Math.max(
          0,
          getFloodSurfaceElevation(
            Math.max(
              0,
              Math.min(
                MAX_FLOOD_DEPTH,
                waterLevel -
                  MIN_ELEVATION
              )
            )
          ) -
            building.terrainElevation
        );

      let color =
        getFloodColor(
          floodDepth
        ) ??
        building.baseColor;

      /*
       * EARTHQUAKE
       */
      if (
        earthquakeActive &&
        earthquakeOrigin
      ) {
        const damage =
          getEarthquakeDamage(
            building.prepared.centerX,
            building.prepared.centerZ,
            earthquakeOrigin,
            earthquakeMagnitude
          );

        const earthquakeColor =
          getEarthquakeColor(
            damage
          );

        if (
          earthquakeColor
        ) {
          color =
            new THREE.Color(
              earthquakeColor
            );
        }
      }

      /*
       * Selected building
       */
      if (
        selectedIndex !== null &&
        building.prepared.index ===
          selectedIndex
      ) {
        color =
          new THREE.Color(
            "#22d3ee"
          );
      }

      for (
        let vertex =
          building.start;

        vertex <
        building.start +
          building.count;

        vertex++
      ) {
        colorAttribute.setXYZ(
          vertex,
          color.r,
          color.g,
          color.b
        );
      }
    }

    colorAttribute.needsUpdate =
      true;
  }
}


function updateEarthquakeGeometry(
  batches: BuildingBatch[],
  origin: EarthquakeOrigin | null,
  magnitude: number,
  active: boolean,
  progress = 1,
  elapsed = 0
) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);

  /*
   * The destruction is staged instead of instantly shrinking the
   * building.  The sequence is:
   *
   * 0.00 - 0.20  : earthquake starts / strong lateral shaking
   * 0.20 - 0.55  : structural sway + torsion
   * 0.55 - 0.78  : floors start failing and the upper mass bends
   * 0.78 - 1.00  : upper structure collapses and settles
   *
   * This is deliberately deterministic per building so the city does
   * not look like every building is using the exact same animation.
   */

  for (const batch of batches) {
    const position =
      batch.geometry.attributes.position as THREE.BufferAttribute;

    const base = batch.basePositions;

    for (const building of batch.buildings) {
      const prepared = building.prepared;

      let damage = 0;

      if (active && origin) {
        damage = THREE.MathUtils.clamp(
          getEarthquakeDamage(
            prepared.centerX,
            prepared.centerZ,
            origin,
            magnitude
          ),
          0,
          1
        );
      }

      const phase = prepared.index * 1.731;
      const phase2 = prepared.index * 0.913 + 2.4;
      const direction = prepared.index % 2 === 0 ? 1 : -1;

      /*
       * A building should not visibly move much if it is outside the
       * earthquake damage radius.
       */
      const affected = damage > 0.02;

      for (let i = 0; i < building.count; i++) {
        const vertex = building.start + i;
        const baseIndex = vertex * 3;

        const baseX = base[baseIndex];
        const baseY = base[baseIndex + 1];
        const baseZ = base[baseIndex + 2];

        if (!affected) {
          position.setXYZ(
            vertex,
            baseX,
            baseY,
            baseZ
          );
          continue;
        }

        const localY = THREE.MathUtils.clamp(
          baseY - prepared.visualElevation,
          0,
          prepared.height
        );

        const height01 = THREE.MathUtils.clamp(
          localY / Math.max(prepared.height, 0.001),
          0,
          1
        );

        /* ----------------------------------------------------------
           STAGE 1 — HIGH-FREQUENCY GROUND SHAKING
        ---------------------------------------------------------- */

        const onset = THREE.MathUtils.smoothstep(
          p,
          0,
          0.20
        );

        const shaking =
          Math.sin(elapsed * 19 + phase) *
            Math.sin(elapsed * 3.2 + phase2) *
            damage *
            0.055 *
            onset;

        const shakingZ =
          Math.cos(elapsed * 17.5 + phase2) *
            Math.sin(elapsed * 2.7 + phase) *
            damage *
            0.050 *
            onset;

        /* ----------------------------------------------------------
           STAGE 2 — BUILDING SWAY / TORSION
        ---------------------------------------------------------- */

        const swayStage = THREE.MathUtils.smoothstep(
          p,
          0.10,
          0.62
        );

        const swayAmplitude =
          damage *
          damage *
          0.13 *
          swayStage *
          height01;

        const swayX =
          Math.sin(elapsed * 6.2 + phase) *
          swayAmplitude;

        const swayZ =
          Math.cos(elapsed * 5.5 + phase2) *
          swayAmplitude *
          0.82;

        /* ----------------------------------------------------------
           STAGE 3 — STRUCTURAL BENDING

           The bottom remains comparatively stable while the upper
           floors move increasingly farther from their foundation.
        ---------------------------------------------------------- */

        const bendStage = THREE.MathUtils.smoothstep(
          p,
          0.35,
          0.82
        );

        const bend =
          height01 *
          height01 *
          damage *
          bendStage;

        const bendX =
          direction *
          bend *
          0.20 *
          Math.sin(phase);

        const bendZ =
          Math.sin(phase2) *
          bend *
          0.15;

        /* ----------------------------------------------------------
           STAGE 4 — FLOOR FAILURE / COLLAPSE
        ---------------------------------------------------------- */

        const collapseStage = THREE.MathUtils.smoothstep(
          p,
          0.67,
          1.0
        );

        /* Buildings with low damage mainly sway.  Strongly damaged
           buildings begin losing their upper floors. */
        const collapseStrength = THREE.MathUtils.clamp(
          (damage - 0.48) / 0.52,
          0,
          1
        );

        const upperStart = THREE.MathUtils.lerp(
          0.72,
          0.38,
          collapseStrength
        );

        const upper01 = THREE.MathUtils.clamp(
          (height01 - upperStart) /
            Math.max(1 - upperStart, 0.001),
          0,
          1
        );

        const floorFailure =
          upper01 *
          upper01 *
          collapseStrength *
          collapseStage;

        /* A broken upper section rotates away from the lower
           structure instead of simply moving straight down. */
        const collapseTilt =
          floorFailure *
          prepared.height *
          (0.18 + damage * 0.22);

        const collapseX =
          direction *
          collapseTilt *
          (0.45 + 0.55 * upper01);

        const collapseZ =
          Math.sin(phase2) *
          collapseTilt *
          0.75 *
          upper01;

        const collapseY =
          floorFailure *
          prepared.height *
          (0.20 + damage * 0.32);

        /* ----------------------------------------------------------
           STAGE 5 — SMALL IRREGULAR SETTLING
        ---------------------------------------------------------- */

        const settle = THREE.MathUtils.smoothstep(
          p,
          0.82,
          1
        );

        const rubbleJitter =
          settle *
          floorFailure *
          0.012 *
          Math.sin(i * 0.71 + phase);

        let x = baseX;
        let y = baseY;
        let z = baseZ;

        /* Whole building motion. */
        x += shaking + swayX + bendX + collapseX;
        z += shakingZ + swayZ + bendZ + collapseZ;

        /* Upper floors lag behind the foundation. */
        x += bendX * height01;
        z += bendZ * height01;

        /* Collapse vertically, but only for the failed upper part. */
        y -= collapseY;

        /* Slight irregularity prevents a perfectly mechanical fall. */
        x += rubbleJitter;
        z += rubbleJitter * 0.7;

        position.setXYZ(
          vertex,
          x,
          y,
          z
        );
      }
    }

    position.needsUpdate = true;
    batch.geometry.computeBoundingSphere();
  }
}

/* ================================================================
   WINDOW MESH
================================================================ */

function createWindowMesh(
  buildings: PreparedBuilding[]
): THREE.InstancedMesh | null {
  if (
    buildings.length === 0
  ) {
    return null;
  }

  const dummy =
    new THREE.Object3D();

  const windowPositions: {
    x: number;
    y: number;
    z: number;
    rotationY: number;
    color: THREE.Color;
  }[] = [];

  function isLit(
    buildingIndex: number,
    floor: number,
    column: number
  ) {
    const value =
      (
        buildingIndex * 17 +
        floor * 31 +
        column * 13
      ) % 11;

    return (
      value === 1 ||
      value === 4 ||
      value === 8
    );
  }

  for (
    let buildingIndex = 0;
    buildingIndex <
    buildings.length;
    buildingIndex++
  ) {
    const building =
      buildings[
        buildingIndex
      ];

    if (
      building.height <
      0.28
    ) {
      continue;
    }

    const width =
      building.maxX -
      building.minX;

    const depth =
      building.maxZ -
      building.minZ;

    if (
      width < 0.08 &&
      depth < 0.08
    ) {
      continue;
    }

    const floors =
      THREE.MathUtils.clamp(
        Math.floor(
          building.height /
            WINDOW_VERTICAL_SPACING
        ),
        1,
        8
      );

    const columnsX =
      THREE.MathUtils.clamp(
        Math.floor(
          width /
            WINDOW_HORIZONTAL_SPACING
        ),
        1,
        5
      );

    const columnsZ =
      THREE.MathUtils.clamp(
        Math.floor(
          depth /
            WINDOW_HORIZONTAL_SPACING
        ),
        1,
        5
      );

    const estimated =
      (
        columnsX * 2 +
        columnsZ * 2
      ) * floors;

    const density =
      estimated >
      MAX_WINDOWS_PER_BUILDING
        ? MAX_WINDOWS_PER_BUILDING /
          estimated
        : 1;

    const skipEvery =
      Math.max(
        1,
        Math.ceil(
          1 / density
        )
      );

    for (
      let floor = 0;
      floor < floors;
      floor++
    ) {
      const y =
        building.height *
        (
          (floor + 0.62) /
          (floors + 0.35)
        );

      /* FRONT */

      for (
        let column = 0;
        column < columnsX;
        column++
      ) {
        if (
          (
            buildingIndex +
            floor +
            column
          ) %
            skipEvery !==
          0
        ) {
          continue;
        }

        const x =
          THREE.MathUtils.lerp(
            building.minX +
              0.045,
            building.maxX -
              0.045,
            (column + 0.5) /
              columnsX
          );

        const z =
          building.maxZ +
          WINDOW_WALL_OFFSET;

        windowPositions.push({
          x:
            building.centerX +
            x,

          y:
            building.visualElevation +
            y,

          z:
            building.centerZ +
            z,

          rotationY: 0,

          color:
            isLit(
              buildingIndex,
              floor,
              column
            )
              ? WINDOW_WARM_COLOR
              : WINDOW_COLOR,
        });
      }

      /* BACK */

      for (
        let column = 0;
        column < columnsX;
        column++
      ) {
        if (
          (
            buildingIndex +
            floor +
            column +
            3
          ) %
            skipEvery !==
          0
        ) {
          continue;
        }

        const x =
          THREE.MathUtils.lerp(
            building.minX +
              0.045,
            building.maxX -
              0.045,
            (column + 0.5) /
              columnsX
          );

        const z =
          building.minZ -
          WINDOW_WALL_OFFSET;

        windowPositions.push({
          x:
            building.centerX +
            x,

          y:
            building.visualElevation +
            y,

          z:
            building.centerZ +
            z,

          rotationY: 0,

          color:
            isLit(
              buildingIndex + 3,
              floor,
              column
            )
              ? WINDOW_WARM_COLOR
              : WINDOW_COLOR,
        });
      }

      /* LEFT */

      for (
        let column = 0;
        column < columnsZ;
        column++
      ) {
        if (
          (
            buildingIndex +
            floor +
            column +
            5
          ) %
            skipEvery !==
          0
        ) {
          continue;
        }

        const z =
          THREE.MathUtils.lerp(
            building.minZ +
              0.045,
            building.maxZ -
              0.045,
            (column + 0.5) /
              columnsZ
          );

        const x =
          building.minX -
          WINDOW_WALL_OFFSET;

        windowPositions.push({
          x:
            building.centerX +
            x,

          y:
            building.visualElevation +
            y,

          z:
            building.centerZ +
            z,

          rotationY:
            Math.PI / 2,

          color:
            isLit(
              buildingIndex + 5,
              floor,
              column
            )
              ? WINDOW_WARM_COLOR
              : WINDOW_DARK_COLOR,
        });
      }

      /* RIGHT */

      for (
        let column = 0;
        column < columnsZ;
        column++
      ) {
        if (
          (
            buildingIndex +
            floor +
            column +
            7
          ) %
            skipEvery !==
          0
        ) {
          continue;
        }

        const z =
          THREE.MathUtils.lerp(
            building.minZ +
              0.045,
            building.maxZ -
              0.045,
            (column + 0.5) /
              columnsZ
          );

        const x =
          building.maxX +
          WINDOW_WALL_OFFSET;

        windowPositions.push({
          x:
            building.centerX +
            x,

          y:
            building.visualElevation +
            y,

          z:
            building.centerZ +
            z,

          rotationY:
            Math.PI / 2,

          color:
            isLit(
              buildingIndex + 7,
              floor,
              column
            )
              ? WINDOW_WARM_COLOR
              : WINDOW_DARK_COLOR,
        });
      }
    }
  }

  if (
    windowPositions.length === 0
  ) {
    return null;
  }

  const geometry =
    new THREE.BoxGeometry(
      WINDOW_WIDTH,
      WINDOW_HEIGHT,
      WINDOW_DEPTH
    );

  const material =
    new THREE.MeshStandardMaterial({
      color:
        "#7fb8cb",

      roughness:
        0.28,

      metalness:
        0.05,

      emissive:
        WINDOW_EMISSIVE,

      emissiveIntensity:
        0.35,

      vertexColors:
        true,
    });

  const mesh =
    new THREE.InstancedMesh(
      geometry,
      material,
      windowPositions.length
    );

  mesh.frustumCulled =
    true;

  for (
    let i = 0;
    i <
    windowPositions.length;
    i++
  ) {
    const window =
      windowPositions[i];

    dummy.position.set(
      window.x,
      window.y,
      window.z
    );

    dummy.rotation.set(
      0,
      window.rotationY,
      0
    );

    dummy.scale.set(
      1,
      1,
      1
    );

    dummy.updateMatrix();

    mesh.setMatrixAt(
      i,
      dummy.matrix
    );

    mesh.setColorAt(
      i,
      window.color
    );
  }

  mesh.instanceMatrix.needsUpdate =
    true;

  if (
    mesh.instanceColor
  ) {
    mesh.instanceColor.needsUpdate =
      true;
  }

  return mesh;
}

/* ================================================================
   FIND BUILDING FROM CLICK
================================================================ */

function findBuildingAtPoint(
  batch: BuildingBatch,
  point: THREE.Vector3
): PreparedBuilding | null {
  /*
   * Because buildings are merged into one
   * mesh, we identify the building from
   * its original footprint.
   */

  let closest:
    | PreparedBuilding
    | null = null;

  let closestDistance =
    Infinity;

  for (
    const range of
      batch.buildings
  ) {
    const building =
      range.prepared;

    const minX =
      building.centerX +
      building.minX;

    const maxX =
      building.centerX +
      building.maxX;

    const minZ =
      building.centerZ +
      building.minZ;

    const maxZ =
      building.centerZ +
      building.maxZ;

    const inside =
      point.x >= minX &&
      point.x <= maxX &&
      point.z >= minZ &&
      point.z <= maxZ;

    if (!inside) {
      continue;
    }

    const dx =
      point.x -
      building.centerX;

    const dz =
      point.z -
      building.centerZ;

    const distance =
      dx * dx +
      dz * dz;

    if (
      distance <
      closestDistance
    ) {
      closestDistance =
        distance;

      closest =
        building;
    }
  }

  return closest;
}

/* ================================================================
   COMPONENT
================================================================ */

export default function Buildings({
  waterLevel =
    MIN_ELEVATION,

  onBuildingSelect,

  earthquakeOrigin =
    null,

  earthquakeMagnitude =
    0,

  earthquakeActive =
    false,

  earthquakeSelectionMode =
    false,

  onEarthquakePoint,
}: BuildingsProps) {
  /* ==============================================================
     HEIGHTMAP
  ============================================================== */

  const heightmap =
    useLoader(
      THREE.TextureLoader,
      "/velachery-heightmap.png"
    );

  /* ==============================================================
     TERRAIN SAMPLER
  ============================================================== */

  const terrainSampler =
    useMemo(() => {
      const image =
        heightmap.image as
          | HTMLImageElement
          | undefined;

      if (!image) {
        return null;
      }

      return createTerrainSampler(
        image
      );
    }, [
      heightmap,
    ]);

  /* ==============================================================
     BUILDING DATA
  ============================================================== */

  const [
    buildingData,
    setBuildingData,
  ] =
    useState<
      BuildingGeoJSON | null
    >(null);

  useEffect(() => {
    let cancelled =
      false;

    fetch(
      "/buildings.geojson"
    )
      .then(
        async (
          response
        ) => {
          if (
            !response.ok
          ) {
            throw new Error(
              `Failed to load buildings.geojson: ${response.status}`
            );
          }

          return response.json();
        }
      )
      .then(
        (
          json: BuildingGeoJSON
        ) => {
          if (
            cancelled
          ) {
            return;
          }

          console.log(
            "OSM buildings loaded:",
            json.features.length
          );

          setBuildingData(
            json
          );
        }
      )
      .catch(
        (error) => {
          console.error(
            "Building loading error:",
            error
          );
        }
      );

    return () => {
      cancelled =
        true;
    };
  }, []);

  /* ==============================================================
     PREPARE
  ============================================================== */

  const preparedBuildings =
    useMemo(() => {
      if (
        !buildingData ||
        !terrainSampler
      ) {
        return [];
      }

      return prepareBuildings(
        buildingData,
        terrainSampler
      );
    }, [
      buildingData,
      terrainSampler,
    ]);

  /* ==============================================================
     BATCHES
  ============================================================== */

  const batches =
    useMemo(() => {
      if (
        preparedBuildings.length ===
        0
      ) {
        return [];
      }

      return createBatches(
        preparedBuildings
      );
    }, [
      preparedBuildings,
    ]);

  /* ==============================================================
     SELECTED BUILDING
  ============================================================== */

  const [
    selectedIndex,
    setSelectedIndex,
  ] =
    useState<
      number | null
    >(null);

  /* ==============================================================
     MATERIAL
  ============================================================== */

  const material =
    useMemo(() => {
      return new THREE.MeshStandardMaterial({
        color: "#ffffff",
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.0,
      });
    }, []);

  /* =============================================================
     WINDOWS
     ============================================================= */

  const windowMesh = useMemo(() => {
    const mesh = createWindowMesh(
      preparedBuildings
    );

    if (mesh) {
      // Windows are visual only. They must not intercept
      // clicks intended for the underlying building mesh.
      mesh.raycast = () => {};
    }

    return mesh;
  }, [preparedBuildings]);

  useEffect(() => {
    return () => {
      if (!windowMesh) return;

      windowMesh.geometry.dispose();

      if (Array.isArray(windowMesh.material)) {
        windowMesh.material.forEach((m) => m.dispose());
      } else {
        windowMesh.material.dispose();
      }
    };
  }, [windowMesh]);

  /* ==============================================================
     EARTHQUAKE ANIMATION CLOCK
  ============================================================== */

  const earthquakeProgress = useRef(0);
  const earthquakeElapsed = useRef(0);

  useEffect(() => {
    earthquakeProgress.current = 0;
    earthquakeElapsed.current = 0;
  }, [earthquakeOrigin, earthquakeMagnitude]);

  useFrame((state, delta) => {
    if (batches.length === 0) {
      return;
    }

    if (!earthquakeActive || !earthquakeOrigin) {
      earthquakeProgress.current = 0;
      earthquakeElapsed.current = 0;

      updateEarthquakeGeometry(
        batches,
        null,
        earthquakeMagnitude,
        false,
        0,
        0
      );

      return;
    }

    /* About 5.5 seconds from first shaking to final collapse. */
    earthquakeElapsed.current += delta;
    earthquakeProgress.current = THREE.MathUtils.clamp(
      earthquakeProgress.current + delta / 5.5,
      0,
      1
    );

    updateEarthquakeGeometry(
      batches,
      earthquakeOrigin,
      earthquakeMagnitude,
      true,
      earthquakeProgress.current,
      earthquakeElapsed.current
    );
  });

  /* ==============================================================
     FLOOD COLORS
  ============================================================== */

useEffect(() => {
  if (
    batches.length === 0
  ) {
    return;
  }

  updateBuildingColors(
    batches,
    waterLevel,
    selectedIndex,
    earthquakeOrigin,
    earthquakeMagnitude,
    earthquakeActive
  );

}, [
  batches,
  waterLevel,
  selectedIndex,
  earthquakeOrigin,
  earthquakeMagnitude,
  earthquakeActive,
]);

  /* ==============================================================
     CLICK HANDLER
  ============================================================== */

  const handleBuildingClick =
    (
      event: any,
      batch: BuildingBatch
    ) => {
      event.stopPropagation();

      if (
        !event.point
      ) {
        return;
      }

      const point =
        event.point.clone();

      /*
       * The buildings are merged into one mesh. During the earthquake
       * animation the geometry moves away from its original footprint,
       * so footprint-only hit testing can fail. The raycast already tells
       * us which triangle was clicked; map that triangle back to the
       * building's vertex range first, then use the footprint as fallback.
       */
      const faceVertex =
        event.face?.a ??
        event.face?.b ??
        event.face?.c;

      let building: PreparedBuilding | null = null;

      if (typeof faceVertex === "number") {
        const hitVertex = faceVertex;

        building =
          batch.buildings.find(
            (range) =>
              hitVertex >= range.start &&
              hitVertex < range.start + range.count
          )?.prepared ?? null;
      }

      if (!building) {
        building =
          findBuildingAtPoint(
            batch,
            point
          );
      }

      if (!building) {
        return;
      }

      /* ------------------------------------------------------------
         EARTHQUAKE EPICENTER SELECTION

         While the earthquake setup screen is open, clicking a
         building chooses that building's center as the epicenter.
         Once the simulation starts, building clicks go back to
         normal inspection.
      ------------------------------------------------------------ */
      if (
        earthquakeSelectionMode &&
        !earthquakeActive
      ) {
        onEarthquakePoint?.({
          x: building.centerX,
          z: building.centerZ,
        });

        setSelectedIndex(null);
        return;
      }

      setSelectedIndex(
        building.index
      );

      const floodDepth =
        Math.max(
          0,
          getFloodSurfaceElevation(
            Math.max(
              0,
              Math.min(
                MAX_FLOOD_DEPTH,
                waterLevel - MIN_ELEVATION
              )
            )
          ) - building.terrainElevation
        );

      let earthquakeDamage = 0;
      let earthquakeDistance: number | null = null;
      let earthquakeStatus:
        | "safe"
        | "minor"
        | "moderate"
        | "severe"
        | "destroyed" =
        "safe";

      if (
        earthquakeOrigin &&
        earthquakeActive
      ) {
        const dx =
          building.centerX -
          earthquakeOrigin.x;

        const dz =
          building.centerZ -
          earthquakeOrigin.z;

        earthquakeDistance =
          Math.sqrt(
            dx * dx +
            dz * dz
          );

        earthquakeDamage =
          Math.round(
            getEarthquakeDamage(
              building.centerX,
              building.centerZ,
              earthquakeOrigin,
              earthquakeMagnitude
            ) * 100
          );

        earthquakeDamage = THREE.MathUtils.clamp(
          earthquakeDamage,
          0,
          100
        );

        earthquakeStatus =
          getEarthquakeDamageLevel(
            earthquakeDamage / 100
          ) as typeof earthquakeStatus;
      }

      const selected: SelectedBuilding =
        {
          index:
            building.index,

          longitude:
            building.longitude,

          latitude:
            building.latitude,

          terrainElevation:
            building.terrainElevation,

          height:
            building.height,

          floodDepth,

          properties:
            building.properties,

          centerX:
            building.centerX,

          centerZ:
            building.centerZ,

          earthquakeDamage,

          earthquakeDistance,

          earthquakeStatus,
        };

      onBuildingSelect?.(
        selected
      );
    };

  /* ==============================================================
     BACKGROUND CLICK
  ============================================================== */

  const handleBackgroundClick =
    () => {
      setSelectedIndex(
        null
      );
    };

  /* ==============================================================
     RENDER
  ============================================================== */

  return (
    <group
      onPointerMissed={
        handleBackgroundClick
      }
    >
      {/* ==========================================================
          BUILDINGS
      ========================================================== */}

      {batches.map(
        (
          batch,
          index
        ) => (
          <mesh
            key={index}
            geometry={
              batch.geometry
            }
            material={
              material
            }
            castShadow={false}
            receiveShadow
            onClick={(event) =>
              handleBuildingClick(
                event,
                batch
              )
            }
          />
        )
      )}

      {/* Visual window layer. It deliberately does not receive pointer events. */}
      {windowMesh && (
        <primitive
          object={windowMesh}
          visible={!earthquakeActive}
        />
      )}

    </group>
  );
}