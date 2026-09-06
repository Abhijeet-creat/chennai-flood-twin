/* ================================================================
   TERRAIN ELEVATION GRID

   Converts the existing Velachery DEM / heightmap into the
   ElevationGrid used by the rainfall surface-flow model.

   IMPORTANT:
   This uses the SAME heightmap already used by Terrain.tsx:

       /velachery-heightmap.png

   It does not create a new terrain dataset.
================================================================ */

import * as THREE from "three";

import {
  ELEVATION_SCALE,
  MIN_ELEVATION,
  MAX_ELEVATION,
  MIN_LON,
  MAX_LON,
  MIN_LAT,
  MAX_LAT,
} from "@/lib/terrain";

import type {
  ElevationGrid,
} from "./surfaceFlow";

/* ================================================================
   DEFAULT GRID SIZE
================================================================ */

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 120;

/* ================================================================
   LOAD IMAGE
================================================================ */

function loadImage(
  url: string
): Promise<HTMLImageElement> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error(
            `Unable to load terrain heightmap: ${url}`
          )
        );
      };

      image.src = url;
    }
  );
}

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
   READ HEIGHTMAP
================================================================ */

function createHeightSampler(
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
      "2d",
      {
        willReadFrequently:
          true,
      }
    );

  if (!context) {
    throw new Error(
      "Unable to create terrain canvas context."
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

  const pixels =
    imageData.data;

  return (
    x: number,
    y: number
  ) => {
    const px =
      clamp(
        Math.round(x),
        0,
        image.width - 1
      );

    const py =
      clamp(
        Math.round(y),
        0,
        image.height - 1
      );

    const index =
      (
        py *
          image.width +
        px
      ) *
      4;

    /*
     * Terrain.tsx uses the red channel.
     */
    const value =
      pixels[
        index
      ] ?? 0;

    return value;
  };
}

/* ================================================================
   PIXEL -> REAL ELEVATION
================================================================ */

/*
 * The existing Terrain.tsx converts:
 *
 *   pixel 0   -> 0 visual height
 *   pixel 255 -> ELEVATION_SCALE visual height
 *
 * We reverse that normalization and convert it into the
 * real elevation range used by terrain.ts.
 */

export function heightmapPixelToElevation(
  pixelValue: number
): number {
  const normalized =
    clamp(
      pixelValue / 255,
      0,
      1
    );

  return (
    MIN_ELEVATION +
    normalized *
      (
        MAX_ELEVATION -
        MIN_ELEVATION
      )
  );
}

/* ================================================================
   CREATE ELEVATION GRID
================================================================ */

export async function createTerrainElevationGrid(
  options: {
    width?: number;
    height?: number;
    imageUrl?: string;
  } = {}
): Promise<ElevationGrid> {
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

  const imageUrl =
    options.imageUrl ??
    "/velachery-heightmap.png";

  const image =
    await loadImage(
      imageUrl
    );

  const sample =
    createHeightSampler(
      image
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
    /*
     * Top of the grid corresponds to maximum latitude,
     * matching the existing Terrain.tsx orientation.
     */
    const normalizedY =
      height === 1
        ? 0.5
        : y /
          (height - 1);

    for (
      let x = 0;
      x < width;
      x++
    ) {
      const normalizedX =
        width === 1
          ? 0.5
          : x /
            (width - 1);

      /*
       * Map the city grid position to the source heightmap.
       */
      const pixelX =
        normalizedX *
        (
          image.width - 1
        );

      const pixelY =
        normalizedY *
        (
          image.height - 1
        );

      const pixel =
        sample(
          pixelX,
          pixelY
        );

      values[
        y *
          width +
        x
      ] =
        heightmapPixelToElevation(
          pixel
        );
    }
  }

  return {
    width,
    height,
    values,

    /*
     * EXACT SAME geographic extent as terrain.ts.
     */
    minLon:
      MIN_LON,

    maxLon:
      MAX_LON,

    minLat:
      MIN_LAT,

    maxLat:
      MAX_LAT,
  };
}

/* ================================================================
   ELEVATION GRID STATISTICS
================================================================ */

export function getTerrainElevationStats(
  grid: ElevationGrid
) {
  let minimum =
    Number.POSITIVE_INFINITY;

  let maximum =
    Number.NEGATIVE_INFINITY;

  let total =
    0;

  for (
    const elevation of
      grid.values
  ) {
    if (
      !Number.isFinite(
        elevation
      )
    ) {
      continue;
    }

    minimum =
      Math.min(
        minimum,
        elevation
      );

    maximum =
      Math.max(
        maximum,
        elevation
      );

    total +=
      elevation;
  }

  const count =
    grid.values.length;

  if (
    minimum ===
    Number.POSITIVE_INFINITY
  ) {
    minimum =
      MIN_ELEVATION;
  }

  if (
    maximum ===
    Number.NEGATIVE_INFINITY
  ) {
    maximum =
      MIN_ELEVATION;
  }

  return {
    width:
      grid.width,

    height:
      grid.height,

    minimumElevationM:
      minimum,

    maximumElevationM:
      maximum,

    meanElevationM:
      count > 0
        ? total / count
        : minimum,

    elevationRangeM:
      maximum -
      minimum,
  };
}

/* ================================================================
   ELEVATION AT GRID CELL
================================================================ */

export function getElevationAtCell(
  grid: ElevationGrid,
  x: number,
  y: number
): number {
  if (
    x < 0 ||
    y < 0 ||
    x >= grid.width ||
    y >= grid.height
  ) {
    return MIN_ELEVATION;
  }

  return (
    grid.values[
      y *
        grid.width +
      x
    ] ??
    MIN_ELEVATION
  );
}

/* ================================================================
   VISUAL HEIGHT
================================================================ */

export function elevationToVisualHeight(
  elevation: number
): number {
  const normalized =
    clamp(
      (
        elevation -
        MIN_ELEVATION
      ) /
        (
          MAX_ELEVATION -
          MIN_ELEVATION
        ),
      0,
      1
    );

  return (
    normalized *
    ELEVATION_SCALE
  );
}

/* ================================================================
   ELEVATION INTERPOLATION
================================================================ */

export function interpolateElevation(
  grid: ElevationGrid,
  x: number,
  y: number
): number {
  if (
    grid.width <= 0 ||
    grid.height <= 0
  ) {
    return MIN_ELEVATION;
  }

  const fx =
    clamp(
      x,
      0,
      grid.width - 1
    );

  const fy =
    clamp(
      y,
      0,
      grid.height - 1
    );

  const x0 =
    Math.floor(
      fx
    );

  const y0 =
    Math.floor(
      fy
    );

  const x1 =
    Math.min(
      grid.width - 1,
      x0 + 1
    );

  const y1 =
    Math.min(
      grid.height - 1,
      y0 + 1
    );

  const tx =
    fx - x0;

  const ty =
    fy - y0;

  const v00 =
    getElevationAtCell(
      grid,
      x0,
      y0
    );

  const v10 =
    getElevationAtCell(
      grid,
      x1,
      y0
    );

  const v01 =
    getElevationAtCell(
      grid,
      x0,
      y1
    );

  const v11 =
    getElevationAtCell(
      grid,
      x1,
      y1
    );

  const top =
    THREE.MathUtils.lerp(
      v00,
      v10,
      tx
    );

  const bottom =
    THREE.MathUtils.lerp(
      v01,
      v11,
      tx
    );

  return THREE.MathUtils.lerp(
    top,
    bottom,
    ty
  );
}