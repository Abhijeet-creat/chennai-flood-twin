/* ================================================================
   CITY RAINFALL GRID

   Converts the larger IMD Chennai radar grid into the exact
   geographic extent used by the Chennai Digital Twin.

   DIGITAL TWIN:

   Longitude:
     80.210972 → 80.229028

   Latitude:
     12.970972 → 12.989028
================================================================ */

import * as THREE from "three";

import type {
  RainfallGrid,
} from "./radar";

import {
  MIN_LON,
  MAX_LON,
  MIN_LAT,
  MAX_LAT,
} from "@/lib/terrain";

/* ================================================================
   TYPES
================================================================ */

export type CityRainfallOptions = {
  width?: number;
  height?: number;
};

/* ================================================================
   DEFAULT GRID SIZE
================================================================ */

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 120;

/* ================================================================
   CLAMP
================================================================ */

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

/* ================================================================
   SAMPLE RADAR GRID
================================================================ */

/*
 * Bilinear interpolation is used instead of simply picking the
 * nearest radar pixel.
 *
 * This gives a smoother city rainfall field.
 */

function sampleRainfall(
  grid: RainfallGrid,
  lon: number,
  lat: number
): number {
  const lonRange =
    grid.maxLon -
    grid.minLon;

  const latRange =
    grid.maxLat -
    grid.minLat;

  if (
    lonRange <= 0 ||
    latRange <= 0 ||
    grid.width <= 0 ||
    grid.height <= 0
  ) {
    return 0;
  }

  const normalizedX =
    clamp(
      (
        lon -
        grid.minLon
      ) /
        lonRange,
      0,
      1
    );

  const normalizedY =
    clamp(
      (
        lat -
        grid.minLat
      ) /
        latRange,
      0,
      1
    );

  /*
   * Radar grid Y is stored from north to south.
   */
  const sourceX =
    normalizedX *
    (grid.width - 1);

  const sourceY =
    (
      1 -
      normalizedY
    ) *
    (
      grid.height - 1
    );

  const x0 =
    Math.floor(
      sourceX
    );

  const x1 =
    Math.min(
      grid.width - 1,
      x0 + 1
    );

  const y0 =
    Math.floor(
      sourceY
    );

  const y1 =
    Math.min(
      grid.height - 1,
      y0 + 1
    );

  const fx =
    sourceX - x0;

  const fy =
    sourceY - y0;

  const v00 =
    grid.values[
      y0 *
        grid.width +
      x0
    ] ?? 0;

  const v10 =
    grid.values[
      y0 *
        grid.width +
      x1
    ] ?? 0;

  const v01 =
    grid.values[
      y1 *
        grid.width +
      x0
    ] ?? 0;

  const v11 =
    grid.values[
      y1 *
        grid.width +
      x1
    ] ?? 0;

  const top =
    THREE.MathUtils.lerp(
      v00,
      v10,
      fx
    );

  const bottom =
    THREE.MathUtils.lerp(
      v01,
      v11,
      fx
    );

  return Math.max(
    0,
    THREE.MathUtils.lerp(
      top,
      bottom,
      fy
    )
  );
}

/* ================================================================
   CREATE CITY GRID
================================================================ */

export function createCityRainfallGrid(
  radarGrid: RainfallGrid,
  options: CityRainfallOptions = {}
): RainfallGrid {
  const width =
    Math.max(
      1,
      Math.floor(
        options.width ??
          DEFAULT_WIDTH
      )
    );

  const height =
    Math.max(
      1,
      Math.floor(
        options.height ??
          DEFAULT_HEIGHT
      )
    );

  const values =
    new Float32Array(
      width *
        height
    );

  for (
    let y = 0;
    y < height;
    y++
  ) {
    const vertical =
      height === 1
        ? 0.5
        : y /
          (height - 1);

    /*
     * Top row = maximum latitude.
     */
    const lat =
      MAX_LAT -
      vertical *
        (
          MAX_LAT -
          MIN_LAT
        );

    for (
      let x = 0;
      x < width;
      x++
    ) {
      const horizontal =
        width === 1
          ? 0.5
          : x /
            (width - 1);

      const lon =
        MIN_LON +
        horizontal *
          (
            MAX_LON -
            MIN_LON
          );

      values[
        y *
          width +
        x
      ] =
        sampleRainfall(
          radarGrid,
          lon,
          lat
        );
    }
  }

  return {
    width,
    height,
    values,

    /*
     * These are now the actual digital-twin bounds.
     */
    minLon:
      MIN_LON,

    maxLon:
      MAX_LON,

    minLat:
      MIN_LAT,

    maxLat:
      MAX_LAT,

    units:
      radarGrid.units,

    observedAt:
      radarGrid.observedAt,

    source:
      radarGrid.source,

    radarId:
      radarGrid.radarId,
  };
}

/* ================================================================
   CITY GRID STATISTICS
================================================================ */

export function getCityRainfallStats(
  grid: RainfallGrid
) {
  let minimum =
    Number.POSITIVE_INFINITY;

  let maximum =
    0;

  let total =
    0;

  let nonZeroCells =
    0;

  for (
    const value of
      grid.values
  ) {
    if (
      !Number.isFinite(
        value
      )
    ) {
      continue;
    }

    minimum =
      Math.min(
        minimum,
        value
      );

    maximum =
      Math.max(
        maximum,
        value
      );

    total +=
      value;

    if (
      value > 0
    ) {
      nonZeroCells++;
    }
  }

  if (
    minimum ===
    Number.POSITIVE_INFINITY
  ) {
    minimum = 0;
  }

  const cellCount =
    grid.values.length;

  return {
    width:
      grid.width,

    height:
      grid.height,

    minimumRainfallMmHr:
      minimum,

    maximumRainfallMmHr:
      maximum,

    meanRainfallMmHr:
      cellCount > 0
        ? total /
          cellCount
        : 0,

    nonZeroCells,

    nonZeroPercentage:
      cellCount > 0
        ? (
            nonZeroCells /
            cellCount
          ) *
          100
        : 0,
  };
}

/* ================================================================
   GET CITY RAINFALL AT LOCATION
================================================================ */

export function getCityRainfallAtLocation(
  grid: RainfallGrid,
  lon: number,
  lat: number
): number {
  if (
    lon < MIN_LON ||
    lon > MAX_LON ||
    lat < MIN_LAT ||
    lat > MAX_LAT
  ) {
    return 0;
  }

  return sampleRainfall(
    grid,
    lon,
    lat
  );
}