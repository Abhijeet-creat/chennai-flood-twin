/* ================================================================
   RAIN NOWCAST
   IMD RADAR GRID -> 0–3 HOUR RAINFALL NOWCAST

   INPUT:
     Recent quantitative radar rainfall grids.

   OUTPUT:
     Forecast rainfall grids at:
       +30
       +60
       +90
       +120
       +150
       +180 minutes

   IMPORTANT:
     This module does NOT invent a rainfall scenario.

     It extrapolates the rainfall structures contained in the
     supplied radar grids.

     The upstream radar.ts adapter is responsible for converting
     the official IMD radar product into RainfallGrid objects.
================================================================ */

import {
  type RainfallGrid,
  isValidRainfallGrid,
  sampleRainfallGrid,
} from "./radar";

/* ================================================================
   TYPES
================================================================ */

export type RadarFrame = {
  grid: RainfallGrid;

  /*
   * Observation time of this radar frame.
   */
  observedAt: string;
};

export type RainfallForecastFrame = {
  leadMinutes: number;

  validAt: string;

  grid: RainfallGrid;

  /*
   * Estimated motion in grid cells per minute.
   */
  velocityX: number;

  velocityY: number;

  /*
   * Indicates how much the forecast is being
   * extrapolated away from the last observation.
   *
   * 1 = closest to observation
   * 0 = very uncertain
   */
  confidence: number;
};

export type RainfallNowcast = {
  source: "IMD";

  generatedAt: string;

  baseObservationTime: string;

  frames: RainfallForecastFrame[];

  motion: {
    xCellsPerMinute: number;
    yCellsPerMinute: number;
    speedCellsPerMinute: number;
  };

  confidence: number;

  errors: string[];
};

/* ================================================================
   CONSTANTS
================================================================ */

/*
 * Forecast steps required by the SIH 0–3 hour requirement.
 */
export const NOWCAST_LEAD_MINUTES = [
  30,
  60,
  90,
  120,
  150,
  180,
] as const;

/*
 * Radar motion can be noisy.

 * Limit the maximum estimated movement to avoid
 * physically unreasonable jumps caused by bad correlation.
 */
const MAX_MOTION_CELLS_PER_FRAME = 12;

/*
 * Search range for image/grid matching.
 */
const MOTION_SEARCH_RADIUS = 12;

/*
 * Coarse matching stride makes the correlation calculation
 * much cheaper than comparing every possible pixel.
 */
const MOTION_SAMPLE_STRIDE = 4;

/*
 * Downsampled minimum number of samples for a valid match.
 */
const MIN_MATCH_SAMPLES = 12;

/*
 * Rainfall below this threshold is ignored when estimating
 * storm movement. It prevents background zero-rain cells from
 * dominating the correlation.
 *
 * This is a data threshold, not a fabricated rainfall value.
 */
const MOTION_RAIN_THRESHOLD_MM_HR = 0.5;

/* ================================================================
   DATE HELPERS
================================================================ */

function parseTime(
  value: string
): number | null {
  const time =
    Date.parse(value);

  if (
    Number.isNaN(time)
  ) {
    return null;
  }

  return time;
}

/* ================================================================
   COMPATIBILITY CHECK
================================================================ */

function compatibleGrids(
  a: RainfallGrid,
  b: RainfallGrid
): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.minLon === b.minLon &&
    a.maxLon === b.maxLon &&
    a.minLat === b.minLat &&
    a.maxLat === b.maxLat
  );
}

/* ================================================================
   NORMALIZATION
================================================================ */

function normalizeValue(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value <=
      MOTION_RAIN_THRESHOLD_MM_HR
  ) {
    return 0;
  }

  return value;
}

/* ================================================================
   STORM SCORE
================================================================ */

function calculateMotionScore(
  previous: RainfallGrid,
  current: RainfallGrid,
  shiftX: number,
  shiftY: number
): number {
  let sumA = 0;
  let sumB = 0;
  let sumAA = 0;
  let sumBB = 0;
  let sumAB = 0;

  let count = 0;

  const startX =
    Math.max(
      0,
      shiftX > 0
        ? shiftX
        : 0
    );

  const endX =
    Math.min(
      previous.width,
      shiftX > 0
        ? previous.width
        : previous.width +
            shiftX
    );

  const startY =
    Math.max(
      0,
      shiftY > 0
        ? shiftY
        : 0
    );

  const endY =
    Math.min(
      previous.height,
      shiftY > 0
        ? previous.height
        : previous.height +
            shiftY
    );

  for (
    let y = startY;
    y < endY;
    y += MOTION_SAMPLE_STRIDE
  ) {
    for (
      let x = startX;
      x < endX;
      x += MOTION_SAMPLE_STRIDE
    ) {
      const previousX =
        x - shiftX;

      const previousY =
        y - shiftY;

      if (
        previousX < 0 ||
        previousX >=
          previous.width ||
        previousY < 0 ||
        previousY >=
          previous.height
      ) {
        continue;
      }

      const currentIndex =
        y *
          current.width +
        x;

      const previousIndex =
        previousY *
          previous.width +
        previousX;

      const a =
        normalizeValue(
          previous.values[
            previousIndex
          ] ?? 0
        );

      const b =
        normalizeValue(
          current.values[
            currentIndex
          ] ?? 0
        );

      /*
       * Ignore pure background.
       */
      if (
        a === 0 &&
        b === 0
      ) {
        continue;
      }

      sumA += a;
      sumB += b;

      sumAA +=
        a * a;

      sumBB +=
        b * b;

      sumAB +=
        a * b;

      count++;
    }
  }

  if (
    count <
    MIN_MATCH_SAMPLES
  ) {
    return -Infinity;
  }

  /*
   * Normalized correlation.
   *
   * We keep it zero-centered so a strong coherent
   * rainfall structure receives a higher score.
   */
  const numerator =
    count * sumAB -
    sumA * sumB;

  const left =
    count * sumAA -
    sumA * sumA;

  const right =
    count * sumBB -
    sumB * sumB;

  const denominator =
    Math.sqrt(
      Math.max(
        0,
        left * right
      )
    );

  if (
    denominator <=
    Number.EPSILON
  ) {
    return -Infinity;
  }

  return (
    numerator /
    denominator
  );
}

/* ================================================================
   ESTIMATE MOTION
================================================================ */

/*
 * Estimates movement between the last two radar frames.

 * +X = eastward on the rainfall grid
 * +Y = southward on the grid array

 * A positive shift means the rainfall structure has moved
 * in that direction between frames.
 */
export function estimateRainfallMotion(
  previous: RainfallGrid,
  current: RainfallGrid,
  minutesBetweenFrames: number
): {
  shiftX: number;
  shiftY: number;
  velocityX: number;
  velocityY: number;
  confidence: number;
} {
  if (
    !isValidRainfallGrid(
      previous
    ) ||
    !isValidRainfallGrid(
      current
    ) ||
    !compatibleGrids(
      previous,
      current
    )
  ) {
    return {
      shiftX: 0,
      shiftY: 0,
      velocityX: 0,
      velocityY: 0,
      confidence: 0,
    };
  }

  if (
    !Number.isFinite(
      minutesBetweenFrames
    ) ||
    minutesBetweenFrames <=
      0
  ) {
    return {
      shiftX: 0,
      shiftY: 0,
      velocityX: 0,
      velocityY: 0,
      confidence: 0,
    };
  }

  let bestScore =
    -Infinity;

  let bestX = 0;
  let bestY = 0;

  for (
    let shiftY =
      -MOTION_SEARCH_RADIUS;

    shiftY <=
    MOTION_SEARCH_RADIUS;

    shiftY++
  ) {
    for (
      let shiftX =
        -MOTION_SEARCH_RADIUS;

      shiftX <=
      MOTION_SEARCH_RADIUS;

      shiftX++
    ) {
      const score =
        calculateMotionScore(
          previous,
          current,
          shiftX,
          shiftY
        );

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        bestX =
          shiftX;

        bestY =
          shiftY;
      }
    }
  }

  /*
   * A correlation of:
   *
   * < 0.15 -> very weak match
   * 0.15..0.35 -> uncertain
   * > 0.35 -> usable
   *
   * We don't manufacture movement when the frames
   * don't contain enough common structure.
   */
  if (
    !Number.isFinite(
      bestScore
    ) ||
    bestScore <
      0.15
  ) {
    return {
      shiftX: 0,
      shiftY: 0,
      velocityX: 0,
      velocityY: 0,
      confidence: 0,
    };
  }

  const clampedX =
    Math.max(
      -MAX_MOTION_CELLS_PER_FRAME,
      Math.min(
        MAX_MOTION_CELLS_PER_FRAME,
        bestX
      )
    );

  const clampedY =
    Math.max(
      -MAX_MOTION_CELLS_PER_FRAME,
      Math.min(
        MAX_MOTION_CELLS_PER_FRAME,
        bestY
      )
    );

  /*
   * Convert the frame movement into movement per minute.
   */
  const velocityX =
    clampedX /
    minutesBetweenFrames;

  const velocityY =
    clampedY /
    minutesBetweenFrames;

  /* ==============================================================
     CONFIDENCE

     Confidence depends on:

     1. Quality of spatial correlation
     2. Time gap between observations

     Long observation gaps are less reliable for motion
     estimation because the rainfall structure may evolve,
     strengthen, weaken, split, or disappear between frames.
  ============================================================== */

  const correlationConfidence =
    Math.max(
      0,
      Math.min(
        1,
        (bestScore - 0.15) /
          0.55
      )
    );

  /*
   * Temporal reliability:
   *
   * <= 15 min  -> 100%
   * 30 min      -> ~90%
   * 60 min      -> ~75%
   * 120 min     -> ~50%
   * 180 min     -> ~25%
   *
   * This is an uncertainty penalty, not a rainfall value.
   */
  const temporalConfidence =
    Math.max(
      0.25,
      Math.min(
        1,
        1 -
          (
            minutesBetweenFrames /
            240
          )
      )
    );

  const confidence =
    correlationConfidence *
    temporalConfidence;

  return {
    shiftX: clampedX,
    shiftY: clampedY,

    velocityX,

    velocityY,

    confidence,
  };
}

/* ================================================================
   GRID SHIFT
================================================================ */

/*
 * Moves a rainfall field according to the estimated storm motion.

 * We use bilinear interpolation so forecast rain doesn't
 * jump from cell to cell.
 */
function advectGrid(
  source: RainfallGrid,
  shiftX: number,
  shiftY: number,
  validAt: string
): RainfallGrid {
  const values =
    new Float32Array(
      source.width *
        source.height
    );

  for (
    let y = 0;
    y < source.height;
    y++
  ) {
    for (
      let x = 0;
      x < source.width;
      x++
    ) {
      /*
       * Backtrace:
       *
       * Where did this forecast cell come from?
       */
      const sourceX =
        x - shiftX;

      const sourceY =
        y - shiftY;

      if (
        sourceX < 0 ||
        sourceX >
          source.width - 1 ||
        sourceY < 0 ||
        sourceY >
          source.height - 1
      ) {
        values[
          y *
            source.width +
          x
        ] = 0;

        continue;
      }

      const x0 =
        Math.floor(
          sourceX
        );

      const y0 =
        Math.floor(
          sourceY
        );

      const x1 =
        Math.min(
          source.width -
            1,
          x0 + 1
        );

      const y1 =
        Math.min(
          source.height -
            1,
          y0 + 1
        );

      const tx =
        sourceX - x0;

      const ty =
        sourceY - y0;

      const i00 =
        y0 *
          source.width +
        x0;

      const i10 =
        y0 *
          source.width +
        x1;

      const i01 =
        y1 *
          source.width +
        x0;

      const i11 =
        y1 *
          source.width +
        x1;

      const v00 =
        source.values[
          i00
        ] ?? 0;

      const v10 =
        source.values[
          i10
        ] ?? 0;

      const v01 =
        source.values[
          i01
        ] ?? 0;

      const v11 =
        source.values[
          i11
        ] ?? 0;

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

      values[
        y *
          source.width +
        x
      ] =
        top +
        (
          bottom -
          top
        ) *
          ty;
    }
  }

  return {
    ...source,

    values,

    observedAt:
      validAt,
  };
}

/* ================================================================
   FORECAST FRAME
================================================================ */

function createForecastFrame(
  source: RainfallGrid,
  leadMinutes: number,
  baseTimeMs: number,
  velocityX: number,
  velocityY: number
): RainfallForecastFrame {
  const shiftX =
    velocityX *
    leadMinutes;

  const shiftY =
    velocityY *
    leadMinutes;

  const validAt =
    new Date(
      baseTimeMs +
        leadMinutes *
          60 *
          1000
    ).toISOString();

  const grid =
    advectGrid(
      source,
      shiftX,
      shiftY,
      validAt
    );

  /*
   * Confidence decays as we extrapolate farther
   * from the last observed radar image.

   * This does not modify rainfall values.
   * It only describes forecast uncertainty.
   */
  const confidence =
    Math.max(
      0,
      1 -
        leadMinutes /
          240
    );

  return {
    leadMinutes,

    validAt,

    grid,

    velocityX,

    velocityY,

    confidence,
  };
}

/* ================================================================
   NOWCAST
================================================================ */

/**
 * Create a 0–3 hour rainfall nowcast from the two latest
 * quantitative radar frames.
 *
 * Both frames must use the same geographic grid.
 */
export function createRainfallNowcast(
  previousFrame: RadarFrame,
  currentFrame: RadarFrame
): RainfallNowcast {
  const errors: string[] =
    [];

  const previous =
    previousFrame.grid;

  const current =
    currentFrame.grid;

  if (
    !isValidRainfallGrid(
      previous
    )
  ) {
    errors.push(
      "Previous radar grid is invalid."
    );
  }

  if (
    !isValidRainfallGrid(
      current
    )
  ) {
    errors.push(
      "Current radar grid is invalid."
    );
  }

  if (
    !compatibleGrids(
      previous,
      current
    )
  ) {
    errors.push(
      "Previous and current radar grids do not cover the same spatial extent."
    );
  }

  const previousTime =
    parseTime(
      previousFrame.observedAt
    );

  const currentTime =
    parseTime(
      currentFrame.observedAt
    );

  if (
    previousTime ===
      null ||
    currentTime ===
      null
  ) {
    errors.push(
      "Radar observation times could not be parsed."
    );
  }

  if (
    errors.length > 0
  ) {
    return {
      source: "IMD",

      generatedAt:
        new Date().toISOString(),

      baseObservationTime:
        currentFrame.observedAt,

      frames: [],

      motion: {
        xCellsPerMinute: 0,
        yCellsPerMinute: 0,
        speedCellsPerMinute: 0,
      },

      confidence: 0,

      errors,
    };
  }

  const minutesBetweenFrames =
    (
      (currentTime as number) -
      (previousTime as number)
    ) /
    (60 * 1000);

  if (
    minutesBetweenFrames <=
      0 ||
    minutesBetweenFrames >
      180
  ) {
    return {
      source: "IMD",

      generatedAt:
        new Date().toISOString(),

      baseObservationTime:
        currentFrame.observedAt,

      frames: [],

      motion: {
        xCellsPerMinute: 0,
        yCellsPerMinute: 0,
        speedCellsPerMinute: 0,
      },

      confidence: 0,

      errors: [
        "The radar frames are too close together or too far apart for a reliable nowcast.",
      ],
    };
  }

  /* ==============================================================
     ESTIMATE MOTION
  ============================================================== */

  const motion =
    estimateRainfallMotion(
      previous,
      current,
      minutesBetweenFrames
    );

  /* ==============================================================
     CREATE FORECAST FRAMES
  ============================================================== */

  const frames =
    NOWCAST_LEAD_MINUTES.map(
      (leadMinutes) =>
        createForecastFrame(
          current,
          leadMinutes,
          currentTime as number,
          motion.velocityX,
          motion.velocityY
        )
    );

  /*
   * Aggregate confidence.
   *
   * Motion confidence is the most important component.
   * Forecast horizon confidence is already included in each frame.
   */
  const confidence =
    Math.max(
      0,
      Math.min(
        1,
        motion.confidence
      )
    );

  return {
    source: "IMD",

    generatedAt:
      new Date().toISOString(),

    baseObservationTime:
      currentFrame.observedAt,

    frames,

    motion: {
      xCellsPerMinute:
        motion.velocityX,

      yCellsPerMinute:
        motion.velocityY,

      speedCellsPerMinute:
        Math.sqrt(
          motion.velocityX *
            motion.velocityX +
            motion.velocityY *
              motion.velocityY
        ),
    },

    confidence,

    errors: [],
  };
}

/* ================================================================
   GET FORECAST BY LEAD TIME
================================================================ */

export function getNowcastFrame(
  nowcast: RainfallNowcast,
  leadMinutes: number
): RainfallForecastFrame | null {
  if (
    nowcast.frames.length ===
    0
  ) {
    return null;
  }

  /*
   * Exact match first.
   */
  const exact =
    nowcast.frames.find(
      (frame) =>
        frame.leadMinutes ===
        leadMinutes
    );

  if (exact) {
    return exact;
  }

  /*
   * Otherwise choose the nearest forecast.
   */
  let best =
    nowcast.frames[0];

  let bestDistance =
    Math.abs(
      best.leadMinutes -
        leadMinutes
    );

  for (
    const frame of
      nowcast.frames
  ) {
    const distance =
      Math.abs(
        frame.leadMinutes -
          leadMinutes
      );

    if (
      distance <
      bestDistance
    ) {
      best =
        frame;

      bestDistance =
        distance;
    }
  }

  return best;
}

/* ================================================================
   TOTAL RAINFALL FROM A FORECAST
================================================================ */

/*
 * Converts rainfall-rate grids into approximate accumulated
 * rainfall over a forecast interval using the trapezoidal rule.
 *
 * This should be used for water-balance calculations rather
 * than simply adding rainfall-rate values.
 */

export function integrateRainfallRate(
  earlier: RainfallGrid,
  later: RainfallGrid,
  minutesBetweenFrames: number
): RainfallGrid | null {
  if (
    !isValidRainfallGrid(
      earlier
    ) ||
    !isValidRainfallGrid(
      later
    )
  ) {
    return null;
  }

  if (
    !compatibleGrids(
      earlier,
      later
    )
  ) {
    return null;
  }

  if (
    minutesBetweenFrames <=
    0
  ) {
    return null;
  }

  const values =
    new Float32Array(
      earlier.width *
        earlier.height
    );

  /*
   * Rainfall rate:
   * mm/hour
   *
   * interval:
   * hours
   *
   * result:
   * mm
   */
  const hours =
    minutesBetweenFrames /
    60;

  for (
    let i = 0;
    i <
    values.length;
    i++
  ) {
    const a =
      Math.max(
        0,
        earlier.values[
          i
        ] ?? 0
      );

    const b =
      Math.max(
        0,
        later.values[
          i
        ] ?? 0
      );

    /*
     * Trapezoidal integration.
     */
    values[i] =
      (
        (a + b) /
        2
      ) *
      hours;
  }

  return {
    ...earlier,

    values,

    units: "mm",

    observedAt:
      later.observedAt,
  };
}

/* ================================================================
   NOWCAST SUMMARY
================================================================ */

export function getNowcastSummary(
  nowcast: RainfallNowcast
): {
  maxRainfallMmPerHour: number;
  maxForecastLeadMinutes: number;
  confidencePercent: number;
} {
  let maxRainfall =
    0;

  let maxLead =
    0;

  for (
    const frame of
      nowcast.frames
  ) {
    for (
      let i = 0;
      i <
      frame.grid.values.length;
      i++
    ) {
      const rainfall =
        frame.grid.values[
          i
        ] ?? 0;

      if (
        rainfall >
        maxRainfall
      ) {
        maxRainfall =
          rainfall;

        maxLead =
          frame.leadMinutes;
      }
    }
  }

  return {
    maxRainfallMmPerHour:
      maxRainfall,

    maxForecastLeadMinutes:
      maxLead,

    confidencePercent:
      Math.round(
        nowcast.confidence *
          100
      ),
  };
}