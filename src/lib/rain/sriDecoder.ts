/* ================================================================
   IMD CHENNAI SRI DECODER

   Screenshot-based prototype decoder.

   IMPORTANT:
   The supplied IMD SRI file is a rendered radar image, not the
   raw radar raster. Therefore this decoder intentionally focuses
   on the visually distinctive warm SRI rainfall classes:

     6.3
     12.6
     25.1
     50.1
     100.0 mm/hr

   Blue radar background / map background is ignored.

   Once a raw quantitative radar feed is available, this file can
   be replaced with direct raster decoding.
================================================================ */

import type { RainfallGrid } from "./radar";

/* ================================================================
   TYPES
================================================================ */

export type SRIDecoderOptions = {
  minLon: number;
  maxLon: number;

  minLat: number;
  maxLat: number;

  cropLeft?: number;
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;

  outputWidth?: number;
  outputHeight?: number;

  observedAt?: string;
};

/* ================================================================
   SRI VALUES
================================================================ */

const RAIN_VALUES = {
  YELLOW: 6.3,
  ORANGE: 12.6,
  RED_ORANGE: 25.1,
  RED: 50.1,
  DARK_RED: 100.0,
} as const;

/* ================================================================
   DEFAULTS
================================================================ */

const DEFAULT_CROP = {
  cropLeft: 0,
  cropTop: 0,
  cropRight: 0.74,
  cropBottom: 0.96,
};

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 300;

/* ================================================================
   HELPERS
================================================================ */

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function rgbToHsv(
  r: number,
  g: number,
  b: number
) {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max =
    Math.max(
      rf,
      gf,
      bf
    );

  const min =
    Math.min(
      rf,
      gf,
      bf
    );

  const delta =
    max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === rf) {
      h =
        60 *
        (
          (
            (
              (gf - bf) /
              delta
            ) % 6
          )
        );
    } else if (
      max === gf
    ) {
      h =
        60 *
        (
          (bf - rf) /
            delta +
          2
        );
    } else {
      h =
        60 *
        (
          (rf - gf) /
            delta +
          4
        );
    }
  }

  if (h < 0) {
    h += 360;
  }

  const s =
    max === 0
      ? 0
      : delta / max;

  const v = max;

  return {
    h,
    s,
    v,
  };
}

/* ================================================================
   WARM RAIN CLASSIFICATION
================================================================ */

/*
 * Instead of requiring an exact RGB match, classify the warm
 * colours by hue + saturation + brightness.
 *
 * This is much more tolerant of:
 * - JPEG compression
 * - screenshot scaling
 * - anti-aliasing
 * - browser rendering
 */

function classifyWarmRain(
  r: number,
  g: number,
  b: number
): number {
  const {
    h,
    s,
    v,
  } = rgbToHsv(
    r,
    g,
    b
  );

  /*
   * Ignore very dark pixels.
   */
  if (v < 0.22) {
    return 0;
  }

  /*
   * Ignore low-saturation pixels:
   * radar rings, text, grey buildings, white labels.
   */
  if (s < 0.32) {
    return 0;
  }

  /*
   * Ignore green.
   *
   * Typical land colours occupy the green hue range.
   */
  if (
    h >= 65 &&
    h <= 175
  ) {
    return 0;
  }

  /*
   * Ignore blue/cyan.
   *
   * This is the critical fix for the giant blue regions.
   */
  if (
    h >= 175 &&
    h <= 285
  ) {
    return 0;
  }

  /*
   * The IMD warm rainfall scale is concentrated roughly in:
   *
   * yellow → orange → red.
   */
  const warm =
    h <= 65 ||
    h >= 330;

  if (!warm) {
    return 0;
  }

  /*
   * Protect against green/brown terrain pixels that can sometimes
   * look warm after screenshot rendering.
   */
  if (
    r < 70
  ) {
    return 0;
  }

  /*
   * DARK RED
   *
   * Highest rainfall class.
   */
  if (
    (
      h <= 15 ||
      h >= 345
    ) &&
    s >= 0.65 &&
    v <= 0.70
  ) {
    return RAIN_VALUES.DARK_RED;
  }

  /*
   * RED
   */
  if (
    (
      h <= 18 ||
      h >= 340
    ) &&
    s >= 0.62
  ) {
    return RAIN_VALUES.RED;
  }

  /*
   * RED / ORANGE
   */
  if (
    h <= 30 &&
    s >= 0.65
  ) {
    return RAIN_VALUES.RED_ORANGE;
  }

  /*
   * ORANGE
   */
  if (
    h <= 48 &&
    s >= 0.58
  ) {
    return RAIN_VALUES.ORANGE;
  }

  /*
   * YELLOW
   *
   * Yellow is the trickiest class because the map can contain
   * yellowish land. Require strong saturation and relatively
   * balanced red/green channels.
   */
  if (
    h <= 65 &&
    s >= 0.62 &&
    r >= 170 &&
    g >= 150 &&
    b <= 120
  ) {
    return RAIN_VALUES.YELLOW;
  }

  return 0;
}

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

      image.crossOrigin =
        "anonymous";

      image.onload = () => {
        resolve(
          image
        );
      };

      image.onerror = () => {
        reject(
          new Error(
            `Unable to load SRI image: ${url}`
          )
        );
      };

      image.src = url;
    }
  );
}

/* ================================================================
   DECODE
================================================================ */

export async function decodeChennaiSRI(
  imageUrl =
    "/radar/chennai-sri.jpg",
  options: SRIDecoderOptions
): Promise<RainfallGrid> {
  const image =
    await loadImage(
      imageUrl
    );

  /* ==============================================================
     CROP
  ============================================================== */

  const cropLeft =
    clamp(
      options.cropLeft ??
        DEFAULT_CROP.cropLeft,
      0,
      1
    );

  const cropTop =
    clamp(
      options.cropTop ??
        DEFAULT_CROP.cropTop,
      0,
      1
    );

  const cropRight =
    clamp(
      options.cropRight ??
        DEFAULT_CROP.cropRight,
      0,
      1
    );

  const cropBottom =
    clamp(
      options.cropBottom ??
        DEFAULT_CROP.cropBottom,
      0,
      1
    );

  if (
    cropRight <=
      cropLeft ||
    cropBottom <=
      cropTop
  ) {
    throw new Error(
      "Invalid SRI crop boundaries."
    );
  }

  /* ==============================================================
     SOURCE DIMENSIONS
  ============================================================== */

  const sourceLeft =
    Math.floor(
      image.width *
        cropLeft
    );

  const sourceTop =
    Math.floor(
      image.height *
        cropTop
    );

  const sourceWidth =
    Math.max(
      1,
      Math.floor(
        image.width *
          (
            cropRight -
            cropLeft
          )
      )
    );

  const sourceHeight =
    Math.max(
      1,
      Math.floor(
        image.height *
          (
            cropBottom -
            cropTop
          )
      )
    );

  /* ==============================================================
     OUTPUT GRID
  ============================================================== */

  const width =
    Math.max(
      1,
      Math.floor(
        options.outputWidth ??
          DEFAULT_WIDTH
      )
    );

  const height =
    Math.max(
      1,
      Math.floor(
        options.outputHeight ??
          DEFAULT_HEIGHT
      )
    );

  /* ==============================================================
     CANVAS
  ============================================================== */

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    sourceWidth;

  canvas.height =
    sourceHeight;

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
      "Unable to create SRI canvas context."
    );
  }

  context.drawImage(
    image,
    sourceLeft,
    sourceTop,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  const pixels =
    context.getImageData(
      0,
      0,
      sourceWidth,
      sourceHeight
    ).data;

  /* ==============================================================
     GRID
  ============================================================== */

  const values =
    new Float32Array(
      width *
        height
    );

  /* ==============================================================
     SAMPLE
  ============================================================== */

  for (
    let gy = 0;
    gy < height;
    gy++
  ) {
    for (
      let gx = 0;
      gx < width;
      gx++
    ) {
      const sourceX =
        Math.floor(
          (
            gx /
            Math.max(
              1,
              width - 1
            )
          ) *
          (
            sourceWidth - 1
          )
        );

      const sourceY =
        Math.floor(
          (
            gy /
            Math.max(
              1,
              height - 1
            )
          ) *
          (
            sourceHeight - 1
          )
        );

      /*
       * Sample a 5×5 neighbourhood.
       *
       * This makes rainfall regions survive screenshot scaling.
       */
      let strongestRain =
        0;

      for (
        let oy = -2;
        oy <= 2;
        oy++
      ) {
        for (
          let ox = -2;
          ox <= 2;
          ox++
        ) {
          const px =
            clamp(
              sourceX + ox,
              0,
              sourceWidth - 1
            );

          const py =
            clamp(
              sourceY + oy,
              0,
              sourceHeight - 1
            );

          const index =
            (
              py *
                sourceWidth +
              px
            ) *
            4;

          const r =
            pixels[
              index
            ] ?? 0;

          const g =
            pixels[
              index + 1
            ] ?? 0;

          const b =
            pixels[
              index + 2
            ] ?? 0;

          const rainfall =
            classifyWarmRain(
              r,
              g,
              b
            );

          if (
            rainfall >
            strongestRain
          ) {
            strongestRain =
              rainfall;
          }
        }
      }

      values[
        gy *
          width +
        gx
      ] =
        strongestRain;
    }
  }

  /* ==============================================================
     KEEP CONNECTED RAIN REGIONS
  ============================================================== */

  cleanSmallRegions(
    values,
    width,
    height
  );

  /* ==============================================================
     RESULT
  ============================================================== */

  return {
    width,
    height,
    values,

    minLon:
      options.minLon,

    maxLon:
      options.maxLon,

    minLat:
      options.minLat,

    maxLat:
      options.maxLat,

    units:
      "mm_per_hour",

    observedAt:
      options.observedAt ??
      new Date().toISOString(),

    source:
      "IMD",

    radarId:
      "imd-chennai",
  };
}

/* ================================================================
   CONNECTED REGION CLEANUP
================================================================ */

/*
 * Remove tiny isolated blobs.
 *
 * A real precipitation patch should contain multiple neighbouring
 * cells. Random screenshot pixels should not.
 */
function cleanSmallRegions(
  values: Float32Array,
  width: number,
  height: number
) {
  const visited =
    new Uint8Array(
      width *
        height
    );

  const MIN_REGION_SIZE = 6;

  for (
    let startY = 0;
    startY < height;
    startY++
  ) {
    for (
      let startX = 0;
      startX < width;
      startX++
    ) {
      const startIndex =
        startY *
          width +
        startX;

      if (
        visited[
          startIndex
        ] ||
        values[
          startIndex
        ] <= 0
      ) {
        continue;
      }

      const region: number[] =
        [];

      const queue: number[] =
        [
          startIndex,
        ];

      visited[
        startIndex
      ] = 1;

      while (
        queue.length > 0
      ) {
        const current =
          queue.shift();

        if (
          current ===
          undefined
        ) {
          continue;
        }

        region.push(
          current
        );

        const x =
          current %
          width;

        const y =
          Math.floor(
            current /
              width
          );

        const neighbours = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];

        for (
          const [
            nx,
            ny,
          ] of neighbours
        ) {
          if (
            nx < 0 ||
            nx >= width ||
            ny < 0 ||
            ny >= height
          ) {
            continue;
          }

          const nextIndex =
            ny *
              width +
            nx;

          if (
            visited[
              nextIndex
            ]
          ) {
            continue;
          }

          if (
            values[
              nextIndex
            ] <= 0
          ) {
            continue;
          }

          visited[
            nextIndex
          ] = 1;

          queue.push(
            nextIndex
          );
        }
      }

      /*
       * Remove tiny isolated regions.
       */
      if (
        region.length <
        MIN_REGION_SIZE
      ) {
        for (
          const index of
            region
        ) {
          values[index] =
            0;
        }
      }
    }
  }
}

/* ================================================================
   SUMMARY
================================================================ */

export function summarizeSRIGrid(
  grid: RainfallGrid
) {
  let minimum =
    Number.POSITIVE_INFINITY;

  let maximum =
    0;

  let nonZeroCells =
    0;

  let total =
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

    if (
      value > 0
    ) {
      nonZeroCells++;
    }

    total +=
      value;
  }

  if (
    minimum ===
    Number.POSITIVE_INFINITY
  ) {
    minimum = 0;
  }

  return {
    width:
      grid.width,

    height:
      grid.height,

    minimumRainfallMmHr:
      minimum,

    maximumRainfallMmHr:
      maximum,

    nonZeroCells,

    totalRainfallCellValue:
      total,

    nonZeroPercentage:
      grid.values.length > 0
        ? (
            nonZeroCells /
            grid.values.length
          ) *
          100
        : 0,
  };
}