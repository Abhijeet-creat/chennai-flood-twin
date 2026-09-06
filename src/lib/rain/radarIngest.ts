/* ================================================================
   RADAR INGESTION ADAPTER

   SIH URBAN FLOOD NOWCASTING

   PURPOSE
   -------
   Convert a quantitative rainfall radar raster into the normalized
   RainfallGrid used by:

     nowcast.ts
     runoff.ts
     surfaceFlow.ts

   IMPORTANT
   ----------
   This module does NOT invent rainfall values.

   It requires:
     1. A real radar raster/image
     2. The geographic extent of that raster
     3. A verified radar color/value calibration

   The calibration MUST come from the actual IMD radar product
   legend/metadata that we use.

   We intentionally do not hard-code an unverified
   "color -> mm/hr" table here.
================================================================ */

import type {
  RainfallGrid,
} from "./radar";

/* ================================================================
   TYPES
================================================================ */

export type RGBAImage = {
  width: number;
  height: number;

  /*
   * RGBA bytes:
   *
   * [R,G,B,A,R,G,B,A,...]
   */
  pixels: Uint8ClampedArray;
};

export type RadarRasterBounds = {
  minLon: number;
  maxLon: number;

  minLat: number;
  maxLat: number;
};

export type RadarColorStop = {
  r: number;
  g: number;
  b: number;

  /*
   * Rainfall value represented by this color.
   *
   * Example:
   *
   * 0       -> no rain
   * 5       -> 5 mm/hr
   * 20      -> 20 mm/hr
   *
   * The actual values MUST come from the verified IMD legend.
   */
  rainfallMmHr: number;
};

export type RadarCalibration = {
  /*
   * Ordered from lowest to highest rainfall.
   */
  stops: RadarColorStop[];

  /*
   * Maximum allowed distance in RGB space for a pixel
   * to be considered a rainfall pixel.
   */
  maxColorDistance: number;

  /*
   * Pixels that don't match the rainfall legend are treated
   * as missing/no-data rather than being assigned an invented
   * rainfall value.
   */
  noDataValue?: number;
};

export type RadarRasterInput = {
  image: RGBAImage;

  bounds: RadarRasterBounds;

  observedAt: string;

  radarId: string;

  calibration: RadarCalibration;
};

export type RadarIngestResult = {
  grid: RainfallGrid;

  matchedPixels: number;

  noDataPixels: number;

  maximumRainfallMmHr: number;

  minimumRainfallMmHr: number;

  warnings: string[];
};

/* ================================================================
   BASIC HELPERS
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

function rgbDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr =
    r1 - r2;

  const dg =
    g1 - g2;

  const db =
    b1 - b2;

  return Math.sqrt(
    dr * dr +
      dg * dg +
      db * db
  );
}

/* ================================================================
   CLOSEST LEGEND COLOR
================================================================ */

function findNearestColorStop(
  r: number,
  g: number,
  b: number,
  calibration: RadarCalibration
): {
  rainfallMmHr: number;
  distance: number;
} | null {
  if (
    calibration.stops.length ===
    0
  ) {
    return null;
  }

  let best:
    RadarColorStop | null =
    null;

  let bestDistance =
    Infinity;

  for (
    const stop of
      calibration.stops
  ) {
    const distance =
      rgbDistance(
        r,
        g,
        b,
        stop.r,
        stop.g,
        stop.b
      );

    if (
      distance <
      bestDistance
    ) {
      best =
        stop;

      bestDistance =
        distance;
    }
  }

  if (!best) {
    return null;
  }

  return {
    rainfallMmHr:
      best.rainfallMmHr,

    distance:
      bestDistance,
  };
}

/* ================================================================
   RASTER -> RAINFALL GRID
================================================================ */

/**
 * Convert an RGBA radar image into RainfallGrid.
 *
 * This function is quantitative only when the supplied
 * calibration table is verified against the actual radar
 * product legend.
 */
export function radarRasterToRainfallGrid(
  input: RadarRasterInput
): RadarIngestResult {
  const {
    image,
    bounds,
    observedAt,
    radarId,
    calibration,
  } = input;

  if (
    image.width <= 0 ||
    image.height <= 0
  ) {
    throw new Error(
      "Radar raster dimensions are invalid."
    );
  }

  if (
    image.pixels.length !==
    image.width *
      image.height *
      4
  ) {
    throw new Error(
      "Radar raster pixel buffer has an invalid length."
    );
  }

  if (
    !Number.isFinite(
      bounds.minLon
    ) ||
    !Number.isFinite(
      bounds.maxLon
    ) ||
    !Number.isFinite(
      bounds.minLat
    ) ||
    !Number.isFinite(
      bounds.maxLat
    )
  ) {
    throw new Error(
      "Radar raster geographic bounds are invalid."
    );
  }

  if (
    bounds.minLon >=
      bounds.maxLon ||
    bounds.minLat >=
      bounds.maxLat
  ) {
    throw new Error(
      "Radar raster geographic bounds are reversed."
    );
  }

  if (
    calibration.stops.length ===
    0
  ) {
    throw new Error(
      "Radar calibration contains no verified color stops."
    );
  }

  const noDataValue =
    calibration.noDataValue ??
    0;

  const values =
    new Float32Array(
      image.width *
        image.height
    );

  let matchedPixels =
    0;

  let noDataPixels =
    0;

  let minimumRainfall =
    Infinity;

  let maximumRainfall =
    -Infinity;

  for (
    let y = 0;
    y < image.height;
    y++
  ) {
    for (
      let x = 0;
      x < image.width;
      x++
    ) {
      const index =
        (
          y *
            image.width +
          x
        ) *
        4;

      const r =
        image.pixels[
          index
        ] ?? 0;

      const g =
        image.pixels[
          index + 1
        ] ?? 0;

      const b =
        image.pixels[
          index + 2
        ] ?? 0;

      const a =
        image.pixels[
          index + 3
        ] ?? 255;

      /*
       * Transparent radar pixels are not rainfall observations.
       */
      if (a === 0) {
        values[
          y *
            image.width +
          x
        ] = noDataValue;

        noDataPixels++;

        continue;
      }

      const match =
        findNearestColorStop(
          r,
          g,
          b,
          calibration
        );

      if (
        !match ||
        match.distance >
          calibration.maxColorDistance
      ) {
        values[
          y *
            image.width +
          x
        ] = noDataValue;

        noDataPixels++;

        continue;
      }

      const rainfall =
        Math.max(
          0,
          match.rainfallMmHr
        );

      values[
        y *
          image.width +
        x
      ] = rainfall;

      matchedPixels++;

      minimumRainfall =
        Math.min(
          minimumRainfall,
          rainfall
        );

      maximumRainfall =
        Math.max(
          maximumRainfall,
          rainfall
        );
    }
  }

  if (
    minimumRainfall ===
    Infinity
  ) {
    minimumRainfall = 0;
  }

  if (
    maximumRainfall ===
    -Infinity
  ) {
    maximumRainfall = 0;
  }

  const warnings: string[] =
    [];

  const totalPixels =
    image.width *
    image.height;

  const matchedFraction =
    totalPixels > 0
      ? matchedPixels /
        totalPixels
      : 0;

  /*
   * If almost the entire image failed to match the legend,
   * this is usually a calibration/product problem.
   */
  if (
    matchedFraction <
    0.01
  ) {
    warnings.push(
      "Very few radar pixels matched the supplied calibration. Verify the IMD radar product legend and raster rendering."
    );
  }

  if (
    noDataPixels >
    totalPixels * 0.75
  ) {
    warnings.push(
      "More than 75% of radar pixels are no-data/background."
    );
  }

  return {
    grid: {
      width:
        image.width,

      height:
        image.height,

      values,

      minLon:
        bounds.minLon,

      maxLon:
        bounds.maxLon,

      minLat:
        bounds.minLat,

      maxLat:
        bounds.maxLat,

      units:
        "mm_per_hour",

      observedAt,

      source:
        "IMD",

      radarId,
    },

    matchedPixels,

    noDataPixels,

    minimumRainfallMmHr:
      minimumRainfall,

    maximumRainfallMmHr:
      maximumRainfall,

    warnings,
  };
}

/* ================================================================
   RESAMPLE RAINFALL GRID
================================================================ */

/*
 * Convert the source radar grid to the spatial resolution required
 * by the urban flood model.

 * This is important because the radar raster and DEM will probably
 * have different dimensions.
 */
export function resampleRainfallGrid(
  source: RainfallGrid,
  targetWidth: number,
  targetHeight: number,
  minLon: number,
  maxLon: number,
  minLat: number,
  maxLat: number
): RainfallGrid {
  if (
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    throw new Error(
      "Target rainfall-grid dimensions are invalid."
    );
  }

  const values =
    new Float32Array(
      targetWidth *
        targetHeight
    );

  for (
    let y = 0;
    y < targetHeight;
    y++
  ) {
    const normalizedY =
      targetHeight === 1
        ? 0
        : y /
          (
            targetHeight -
            1
          );

    const latitude =
      maxLat -
      normalizedY *
        (
          maxLat -
          minLat
        );

    for (
      let x = 0;
      x < targetWidth;
      x++
    ) {
      const normalizedX =
        targetWidth === 1
          ? 0
          : x /
            (
              targetWidth -
              1
            );

      const longitude =
        minLon +
        normalizedX *
          (
            maxLon -
            minLon
          );

      const value =
        sampleSourceGridBilinear(
          source,
          longitude,
          latitude
        );

      values[
        y *
          targetWidth +
        x
      ] =
        value;
    }
  }

  return {
    width:
      targetWidth,

    height:
      targetHeight,

    values,

    minLon,
    maxLon,

    minLat,
    maxLat,

    units:
      source.units,

    observedAt:
      source.observedAt,

    source:
      source.source,

    radarId:
      source.radarId,
  };
}

/* ================================================================
   BILINEAR SAMPLE
================================================================ */

function sampleSourceGridBilinear(
  grid: RainfallGrid,
  longitude: number,
  latitude: number
): number {
  const nx =
    clamp(
      (
        longitude -
        grid.minLon
      ) /
        (
          grid.maxLon -
          grid.minLon
        ),
      0,
      1
    );

  const ny =
    clamp(
      (
        latitude -
        grid.minLat
      ) /
        (
          grid.maxLat -
          grid.minLat
        ),
      0,
      1
    );

  const px =
    nx *
    (
      grid.width -
      1
    );

  const py =
    (
      1 - ny
    ) *
    (
      grid.height -
      1
    );

  const x0 =
    Math.floor(px);

  const y0 =
    Math.floor(py);

  const x1 =
    Math.min(
      grid.width -
        1,
      x0 + 1
    );

  const y1 =
    Math.min(
      grid.height -
        1,
      y0 + 1
    );

  const tx =
    px - x0;

  const ty =
    py - y0;

  const i00 =
    y0 *
      grid.width +
    x0;

  const i10 =
    y0 *
      grid.width +
    x1;

  const i01 =
    y1 *
      grid.width +
    x0;

  const i11 =
    y1 *
      grid.width +
    x1;

  const v00 =
    grid.values[i00] ??
    0;

  const v10 =
    grid.values[i10] ??
    0;

  const v01 =
    grid.values[i01] ??
    0;

  const v11 =
    grid.values[i11] ??
    0;

  const top =
    v00 +
    (
      v10 -
      v00
    ) *
      tx;

  const bottom =
    v01 +
    (
      v11 -
      v01
    ) *
      tx;

  return Math.max(
    0,
    top +
      (
        bottom -
        top
      ) *
        ty
  );
}

/* ================================================================
   BUILD RAINFALL GRID FROM NUMERIC MATRIX
================================================================ */

/*
 * Useful for server-side radar decoders.

 * Once we have a real IMD quantitative raster decoder, it can pass
 * its numeric rainfall matrix into this helper.
 */
export function createRainfallGridFromMatrix(
  values: number[] | Float32Array,
  width: number,
  height: number,
  bounds: RadarRasterBounds,
  observedAt: string,
  radarId: string
): RainfallGrid {
  if (
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      "Rainfall matrix dimensions are invalid."
    );
  }

  if (
    values.length !==
    width *
      height
  ) {
    throw new Error(
      "Rainfall matrix length does not match its dimensions."
    );
  }

  const output =
    new Float32Array(
      width *
        height
    );

  for (
    let i = 0;
    i <
    output.length;
    i++
  ) {
    const value =
      Number(
        values[i]
      );

    output[i] =
      Number.isFinite(
        value
      )
        ? Math.max(
            0,
            value
          )
        : 0;
  }

  return {
    width,

    height,

    values:
      output,

    minLon:
      bounds.minLon,

    maxLon:
      bounds.maxLon,

    minLat:
      bounds.minLat,

    maxLat:
      bounds.maxLat,

    units:
      "mm_per_hour",

    observedAt,

    source:
      "IMD",

    radarId,
  };
}