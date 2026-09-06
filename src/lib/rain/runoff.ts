/* ================================================================
   URBAN RAINFALL -> SURFACE RUNOFF MODEL

   SIH Urban Flood Nowcasting

   INPUT:
     - Rainfall intensity / rainfall grid
     - Surface imperviousness
     - Optional infiltration rate

   OUTPUT:
     - Rainfall depth
     - Infiltrated depth
     - Runoff depth
     - Runoff volume

   IMPORTANT:
     This module does not model the underground drainage system.
     Drainage.ts will consume the runoff produced here.

   It also does not create artificial rainfall.
   Rainfall must come from the IMD/radar nowcast pipeline.
================================================================ */

import type {
  RainfallGrid,
} from "./radar";

/* ================================================================
   TYPES
================================================================ */

export type RunoffCell = {
  /*
   * Rainfall during this timestep.
   */
  rainfallMm: number;

  /*
   * Portion that infiltrates into the ground.
   */
  infiltrationMm: number;

  /*
   * Water remaining as surface runoff.
   */
  runoffMm: number;

  /*
   * Surface area represented by this grid cell.
   */
  areaM2: number;

  /*
   * Runoff volume represented by this cell.
   */
  runoffVolumeM3: number;

  /*
   * Effective runoff coefficient.
   *
   * 0 = almost all rainfall infiltrates
   * 1 = almost all rainfall becomes runoff
   */
  runoffCoefficient: number;
};

export type RunoffGrid = {
  width: number;
  height: number;

  cells: RunoffCell[];

  minLon: number;
  maxLon: number;

  minLat: number;
  maxLat: number;

  observedAt: string;

  totalRainfallMm: number;

  totalInfiltrationMm: number;

  totalRunoffMm: number;

  totalRunoffVolumeM3: number;
};

/* ================================================================
   DEFAULT URBAN PARAMETERS
================================================================ */

/*
 * These are starting engineering assumptions for the prototype.
 *
 * We should replace these with land-cover / soil-specific values
 * when we obtain the required local datasets.
 */

/*
 * Typical imperviousness for dense urban Chennai.
 *
 * IMPORTANT:
 * This is a fallback only.
 * The final SIH model should use a real land-cover map.
 */
export const DEFAULT_IMPERVIOUSNESS =
  0.72;

/*
 * Infiltration capacity.
 *
 * Units: mm/hour.
 *
 * Again, this is a fallback parameter.
 * Later we can derive it from soil / land-cover data.
 */
export const DEFAULT_INFILTRATION_RATE_MM_HR =
  8;

/*
 * Maximum effective infiltration during one timestep.
 */
export const MAX_PRACTICAL_INFILTRATION_MM =
  12;

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
    Math.min(max, value)
  );
}

/* ================================================================
   GRID CELL AREA
================================================================ */

/*
 * Convert geographic grid spacing into approximate cell area.
 *
 * The area varies slightly with latitude.
 *
 * This is adequate for our current gridded runoff calculation.
 */
export function calculateCellAreaM2(
  minLon: number,
  maxLon: number,
  minLat: number,
  maxLat: number,
  width: number,
  height: number
): number {
  if (
    width <= 0 ||
    height <= 0
  ) {
    return 0;
  }

  const meanLat =
    (
      minLat +
      maxLat
    ) /
    2;

  const latRadians =
    (meanLat * Math.PI) /
    180;

  /*
   * Approximate metres per degree.
   */
  const metresPerDegreeLat =
    111_320;

  const metresPerDegreeLon =
    111_320 *
    Math.cos(
      latRadians
    );

  const totalWidthM =
    (
      maxLon -
      minLon
    ) *
    metresPerDegreeLon;

  const totalHeightM =
    (
      maxLat -
      minLat
    ) *
    metresPerDegreeLat;

  return (
    (totalWidthM /
      width) *
    (totalHeightM /
      height)
  );
}

/* ================================================================
   RAINFALL RATE -> RAINFALL DEPTH
================================================================ */

/*
 * Convert mm/hour into millimetres during a timestep.
 */
export function rainfallRateToDepthMm(
  rainfallMmPerHour: number,
  timestepMinutes: number
): number {
  if (
    !Number.isFinite(
      rainfallMmPerHour
    ) ||
    rainfallMmPerHour <= 0 ||
    !Number.isFinite(
      timestepMinutes
    ) ||
    timestepMinutes <= 0
  ) {
    return 0;
  }

  return (
    rainfallMmPerHour *
    (timestepMinutes /
      60)
  );
}

/* ================================================================
   IMPERVIOUSNESS -> RUNOFF COEFFICIENT
================================================================ */

/*
 * A simple but explicit conversion:
 *
 * impervious = 0.0
 *     -> low runoff coefficient
 *
 * impervious = 1.0
 *     -> high runoff coefficient
 *
 * This is intentionally kept separate so we can later replace
 * it with a land-cover-specific hydrologic model.
 */
export function getRunoffCoefficient(
  imperviousness: number
): number {
  const impervious =
    clamp(
      imperviousness,
      0,
      1
    );

  /*
   * Base pervious runoff.
   */
  const perviousCoefficient =
    0.18;

  /*
   * Impervious surfaces approach 0.95.
   */
  const imperviousCoefficient =
    0.95;

  return (
    perviousCoefficient *
      (1 - impervious) +
    imperviousCoefficient *
      impervious
  );
}

/* ================================================================
   INFILTRATION
================================================================ */

/*
 * Calculate infiltration during a timestep.
 *
 * We limit infiltration by:
 *
 * 1. rainfall available
 * 2. infiltration capacity
 * 3. practical upper bound
 */
export function calculateInfiltrationMm(
  rainfallDepthMm: number,
  infiltrationRateMmHr: number,
  timestepMinutes: number
): number {
  if (
    rainfallDepthMm <= 0
  ) {
    return 0;
  }

  const potentialInfiltration =
    Math.max(
      0,
      infiltrationRateMmHr
    ) *
    (
      Math.max(
        0,
        timestepMinutes
      ) /
      60
    );

  return Math.min(
    rainfallDepthMm,
    potentialInfiltration,
    MAX_PRACTICAL_INFILTRATION_MM
  );
}

/* ================================================================
   SINGLE CELL RUNOFF
================================================================ */

export function calculateCellRunoff(
  rainfallMmPerHour: number,
  imperviousness: number,
  infiltrationRateMmHr: number,
  timestepMinutes: number,
  areaM2: number
): RunoffCell {
  const rainfallMm =
    rainfallRateToDepthMm(
      rainfallMmPerHour,
      timestepMinutes
    );

  const runoffCoefficient =
    getRunoffCoefficient(
      imperviousness
    );

  /*
   * Potential infiltration before applying the runoff coefficient.
   */
  const infiltrationMm =
    calculateInfiltrationMm(
      rainfallMm,
      infiltrationRateMmHr,
      timestepMinutes
    );

  /*
   * Hydrologically effective rainfall.
   *
   * The imperviousness/runoff coefficient determines how much
   * rainfall immediately becomes surface response.
   */
  const effectiveRainfallMm =
    rainfallMm *
    runoffCoefficient;

  /*
   * Combine infiltration and runoff accounting conservatively.
   *
   * We never allow runoff to become negative.
   */
  const runoffMm =
    Math.max(
      0,
      effectiveRainfallMm -
        infiltrationMm *
          (1 -
            imperviousness)
    );

  /*
   * 1 mm over 1 m² = 0.001 m³.
   */
  const runoffVolumeM3 =
    runoffMm *
    0.001 *
    Math.max(
      0,
      areaM2
    );

  return {
    rainfallMm,

    infiltrationMm,

    runoffMm,

    areaM2,

    runoffVolumeM3,

    runoffCoefficient,
  };
}

/* ================================================================
   IMPERVIOUSNESS GRID
================================================================ */

export type ScalarGrid = {
  width: number;
  height: number;

  values: Float32Array;

  minLon: number;
  maxLon: number;

  minLat: number;
  maxLat: number;
};

/* ================================================================
   VALIDATE SCALAR GRID
================================================================ */

export function isValidScalarGrid(
  grid: ScalarGrid
): boolean {
  return (
    grid.width > 0 &&
    grid.height > 0 &&
    grid.values.length ===
      grid.width *
        grid.height &&
    Number.isFinite(
      grid.minLon
    ) &&
    Number.isFinite(
      grid.maxLon
    ) &&
    Number.isFinite(
      grid.minLat
    ) &&
    Number.isFinite(
      grid.maxLat
    )
  );
}

/* ================================================================
   CREATE UNIFORM GRID
================================================================ */

/*
 * Temporary fallback:
 * every cell receives the same imperviousness.
 *
 * This is here because the real land-cover grid will be plugged
 * into the exact same interface later.
 */
export function createUniformScalarGrid(
  width: number,
  height: number,
  value: number,
  minLon: number,
  maxLon: number,
  minLat: number,
  maxLat: number
): ScalarGrid {
  const values =
    new Float32Array(
      width * height
    );

  values.fill(
    clamp(value, 0, 1)
  );

  return {
    width,
    height,

    values,

    minLon,
    maxLon,

    minLat,
    maxLat,
  };
}

/* ================================================================
   GRID RUNOFF
================================================================ */

export type RunoffModelOptions = {
  timestepMinutes: number;

  imperviousnessGrid?: ScalarGrid;

  defaultImperviousness?: number;

  defaultInfiltrationRateMmHr?: number;
};

/*
 * Convert one real rainfall radar frame into runoff.
 *
 * The rainfall grid is expected to be in:
 *
 * mm/hour
 */
export function calculateRunoffGrid(
  rainfallGrid: RainfallGrid,
  options: RunoffModelOptions
): RunoffGrid {
  const width =
    rainfallGrid.width;

  const height =
    rainfallGrid.height;

  const cells: RunoffCell[] =
    new Array(
      width * height
    );

  const areaM2 =
    calculateCellAreaM2(
      rainfallGrid.minLon,
      rainfallGrid.maxLon,
      rainfallGrid.minLat,
      rainfallGrid.maxLat,
      width,
      height
    );

  const defaultImperviousness =
    clamp(
      options.defaultImperviousness ??
        DEFAULT_IMPERVIOUSNESS,
      0,
      1
    );

  const defaultInfiltrationRate =
    Math.max(
      0,
      options.defaultInfiltrationRateMmHr ??
        DEFAULT_INFILTRATION_RATE_MM_HR
    );

  let totalRainfallMm =
    0;

  let totalInfiltrationMm =
    0;

  let totalRunoffMm =
    0;

  let totalRunoffVolumeM3 =
    0;

  for (
    let index = 0;
    index <
    width * height;
    index++
  ) {
    const rainfallRate =
      Math.max(
        0,
        rainfallGrid
          .values[index] ??
          0
      );

    let imperviousness =
      defaultImperviousness;

    /*
     * Use real land-cover values whenever available.
     */
    if (
      options.imperviousnessGrid &&
      isValidScalarGrid(
        options.imperviousnessGrid
      ) &&
      options.imperviousnessGrid
          .width === width &&
      options.imperviousnessGrid
          .height === height
    ) {
      imperviousness =
        clamp(
          options
            .imperviousnessGrid
            .values[index] ??
            defaultImperviousness,
          0,
          1
        );
    }

    const cell =
      calculateCellRunoff(
        rainfallRate,
        imperviousness,
        defaultInfiltrationRate,
        options.timestepMinutes,
        areaM2
      );

    cells[index] =
      cell;

    totalRainfallMm +=
      cell.rainfallMm;

    totalInfiltrationMm +=
      cell.infiltrationMm;

    totalRunoffMm +=
      cell.runoffMm;

    totalRunoffVolumeM3 +=
      cell.runoffVolumeM3;
  }

  /*
   * These totals are spatial sums.
   *
   * totalRunoffMm should generally be interpreted as the summed
   * cell runoff depths, not the physical average depth over the
   * entire domain.
   */
  return {
    width,
    height,

    cells,

    minLon:
      rainfallGrid.minLon,

    maxLon:
      rainfallGrid.maxLon,

    minLat:
      rainfallGrid.minLat,

    maxLat:
      rainfallGrid.maxLat,

    observedAt:
      rainfallGrid.observedAt,

    totalRainfallMm,

    totalInfiltrationMm,

    totalRunoffMm,

    totalRunoffVolumeM3,
  };
}

/* ================================================================
   RUNOFF DEPTH GRID
================================================================ */

/*
 * Extract only runoff depth for the surface-routing model.
 */
export function extractRunoffDepthGrid(
  runoff: RunoffGrid
): ScalarGrid {
  const values =
    new Float32Array(
      runoff.width *
        runoff.height
    );

  for (
    let i = 0;
    i <
    values.length;
    i++
  ) {
    values[i] =
      runoff.cells[i]
        ?.runoffMm ??
      0;
  }

  return {
    width:
      runoff.width,

    height:
      runoff.height,

    values,

    minLon:
      runoff.minLon,

    maxLon:
      runoff.maxLon,

    minLat:
      runoff.minLat,

    maxLat:
      runoff.maxLat,
  };
}

/* ================================================================
   RUNOFF VOLUME AT CELL
================================================================ */

export function getCellRunoffVolume(
  runoff: RunoffGrid,
  x: number,
  y: number
): number {
  if (
    x < 0 ||
    y < 0 ||
    x >= runoff.width ||
    y >= runoff.height
  ) {
    return 0;
  }

  const index =
    y *
      runoff.width +
    x;

  return (
    runoff.cells[index]
      ?.runoffVolumeM3 ??
    0
  );
}

/* ================================================================
   DOMAIN SUMMARY
================================================================ */

export function getRunoffSummary(
  runoff: RunoffGrid
) {
  let maximumRunoffMm =
    0;

  let affectedCells =
    0;

  for (
    const cell of
      runoff.cells
  ) {
    if (
      cell.runoffMm >
      maximumRunoffMm
    ) {
      maximumRunoffMm =
        cell.runoffMm;
    }

    if (
      cell.runoffMm >
      0
    ) {
      affectedCells++;
    }
  }

  const totalCells =
    runoff.width *
    runoff.height;

  return {
    maximumRunoffMm,

    affectedCells,

    totalCells,

    affectedPercentage:
      totalCells > 0
        ? (
            affectedCells /
            totalCells
          ) *
          100
        : 0,

    totalRunoffVolumeM3:
      runoff.totalRunoffVolumeM3,
  };
}