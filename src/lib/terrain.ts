import * as THREE from "three";

/* ================================================================
   TERRAIN
================================================================ */

export const TERRAIN_SIZE = 10;

export const MIN_LON = 80.210972;
export const MAX_LON = 80.229028;

export const MIN_LAT = 12.970972;
export const MAX_LAT = 12.989028;

/*
 * Visual terrain is intentionally compressed.
 *
 * Real elevation:
 *     -6.208936 m → 20.089691 m
 *
 * Visual Three.js elevation:
 *     0 → 0.35
 */
export const ELEVATION_SCALE = 0.35;

/* ================================================================
   REAL TERRAIN ELEVATION
================================================================ */

export const MIN_ELEVATION = -6.208936;
export const MAX_ELEVATION = 20.089691;

export const ELEVATION_RANGE =
  MAX_ELEVATION - MIN_ELEVATION;

/* ================================================================
   FLOOD SETTINGS
================================================================ */

/*
 * IMPORTANT
 *
 * The UI slider is allowed to show 0 → 20,
 * because that gives a nice simulation control.
 *
 * BUT the real flood depth is limited to 6 metres.
 *
 * Therefore:
 *
 * UI 0  → 0 m
 * UI 20 → 6 m
 */
export const FLOOD_SLIDER_MIN = 0;
export const FLOOD_SLIDER_MAX = 20;

export const MAX_REAL_FLOOD_DEPTH = 6;

/* ================================================================
   FLOOD CONVERSION
================================================================ */

/*
 * Convert UI slider value to REAL flood depth.
 *
 * Example:
 *
 * 0  → 0 m
 * 5  → 1.5 m
 * 10 → 3 m
 * 15 → 4.5 m
 * 20 → 6 m
 */
export function sliderToFloodDepth(
  sliderValue: number
) {
  const value = THREE.MathUtils.clamp(
    sliderValue,
    FLOOD_SLIDER_MIN,
    FLOOD_SLIDER_MAX
  );

  return (
    (value / FLOOD_SLIDER_MAX) *
    MAX_REAL_FLOOD_DEPTH
  );
}

/*
 * Convert REAL flood depth into
 * absolute water-surface elevation.
 *
 * Example:
 *
 * terrain minimum = -6.208936
 *
 * 0 m flood:
 *     -6.208936
 *
 * 3 m flood:
 *     -3.208936
 *
 * 6 m flood:
 *     -0.208936
 */
export function floodDepthToSurfaceElevation(
  floodDepth: number
) {
  const depth = THREE.MathUtils.clamp(
    floodDepth,
    0,
    MAX_REAL_FLOOD_DEPTH
  );

  return MIN_ELEVATION + depth;
}

/*
 * Convert UI slider directly to
 * absolute water surface elevation.
 */
export function sliderToWaterSurfaceElevation(
  sliderValue: number
) {
  const floodDepth =
    sliderToFloodDepth(sliderValue);

  return floodDepthToSurfaceElevation(
    floodDepth
  );
}

/* ================================================================
   VISUAL SCALE
================================================================ */

/*
 * Convert a REAL elevation delta in metres
 * into the compressed Three.js Y scale.
 *
 * This keeps water and terrain visually
 * consistent.
 */
export function realDeltaToVisual(
  deltaMeters: number
) {
  return (
    (deltaMeters *
      ELEVATION_SCALE) /
    ELEVATION_RANGE
  );
}

/*
 * Convert a REAL absolute elevation into
 * the visual terrain height.
 */
export function realElevationToVisual(
  elevation: number
) {
  const normalized =
    THREE.MathUtils.clamp(
      (elevation -
        MIN_ELEVATION) /
        ELEVATION_RANGE,
      0,
      1
    );

  return (
    normalized *
    ELEVATION_SCALE
  );
}

/* ================================================================
   GEOGRAPHIC → THREE.JS
================================================================ */

export function lonToX(
  lon: number
) {
  return (
    (
      (lon - MIN_LON) /
        (MAX_LON - MIN_LON) -
      0.5
    ) *
    TERRAIN_SIZE
  );
}

export function latToZ(
  lat: number
) {
  return (
    -(
      (lat - MIN_LAT) /
        (MAX_LAT - MIN_LAT) -
      0.5
    ) *
    TERRAIN_SIZE
  );
}

/* ================================================================
   THREE.JS → NORMALIZED TERRAIN
================================================================ */

export function worldToNormalized(
  x: number,
  z: number
) {
  const nx =
    THREE.MathUtils.clamp(
      x / TERRAIN_SIZE + 0.5,
      0,
      1
    );

  const nz =
    THREE.MathUtils.clamp(
      -z / TERRAIN_SIZE + 0.5,
      0,
      1
    );

  return {
    x: nx,
    z: nz,
  };
}

/* ================================================================
   HEIGHTMAP
================================================================ */

export type TerrainSampler = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

/*
 * Create a shared heightmap sampler.
 *
 * All terrain-dependent systems should use
 * this same conversion.
 */
export function createTerrainSampler(
  image: HTMLImageElement
): TerrainSampler | null {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    image.width;

  canvas.height =
    image.height;

  const context =
    canvas.getContext("2d");

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
    width: image.width,
    height: image.height,
  };
}

/* ================================================================
   TERRAIN SAMPLE
================================================================ */

export type TerrainSample = {
  visualHeight: number;
  elevation: number;
};

export function sampleTerrain(
  x: number,
  z: number,
  sampler: TerrainSampler | null
): TerrainSample {
  if (!sampler) {
    return {
      visualHeight: 0,
      elevation: MIN_ELEVATION,
    };
  }

  const {
    x: normalizedX,
    z: normalizedZ,
  } =
    worldToNormalized(
      x,
      z
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
    ) *
    4;

  const value =
    sampler.pixels[index] ?? 0;

  const normalizedHeight =
    value / 255;

  const elevation =
    MIN_ELEVATION +
    normalizedHeight *
      ELEVATION_RANGE;

  return {
    visualHeight:
      normalizedHeight *
      ELEVATION_SCALE,

    elevation,
  };
}

/* ================================================================
   PIXEL → VISUAL TERRAIN HEIGHT
================================================================ */

export function pixelToTerrainHeight(
  pixelValue: number
) {
  return (
    (pixelValue / 255) *
    ELEVATION_SCALE
  );
}