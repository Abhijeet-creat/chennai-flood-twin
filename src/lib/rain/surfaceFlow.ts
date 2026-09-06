/* ================================================================
   URBAN SURFACE FLOW MODEL

   SIH Urban Flood Nowcasting

   INPUT:
     - RunoffGrid
     - Terrain elevation grid

   OUTPUT:
     - Surface water depth per cell
     - Surface water volume per cell
     - Flow direction
     - Accumulated water

   MODEL:
     - D8-style downhill routing
     - Water moves toward the lowest neighbouring cell
     - A small retention fraction is kept in each cell
     - Border cells can discharge out of the model domain

   IMPORTANT:
     This is the surface-routing stage only.

       rainfall
          ↓
       runoff.ts
          ↓
       surfaceFlow.ts
          ↓
       drainage.ts
          ↓
       flood depth

   It does NOT model:
     - underground pipes
     - manholes
     - hydraulic surcharge
     - pipe capacity

================================================================ */

import type {
  RunoffGrid,
} from "./runoff";

/* ================================================================
   TYPES
================================================================ */

export type ElevationGrid = {
  width: number;
  height: number;

  /*
   * Elevation in metres.
   */
  values: Float32Array;

  minLon: number;
  maxLon: number;

  minLat: number;
  maxLat: number;
};

export type SurfaceFlowCell = {
  /*
   * Ground elevation.
   */
  elevationM: number;

  /*
   * Incoming runoff before routing.
   */
  runoffVolumeM3: number;

  /*
   * Water remaining in this cell after routing.
   */
  surfaceWaterVolumeM3: number;

  /*
   * Water depth expressed in metres.
   */
  waterDepthM: number;

  /*
   * Index of downhill neighbour.
   *
   * -1 = local depression / no downhill neighbour.
   */
  flowTo: number;

  /*
   * Total upstream contribution reaching this cell.
   */
  accumulatedVolumeM3: number;

  /*
   * True when the cell is on the outer boundary.
   */
  outlet: boolean;
};

export type SurfaceFlowGrid = {
  width: number;
  height: number;

  cells: SurfaceFlowCell[];

  minLon: number;
  maxLon: number;

  minLat: number;
  maxLat: number;

  totalInputVolumeM3: number;

  totalStoredVolumeM3: number;

  totalOutletVolumeM3: number;

  maximumWaterDepthM: number;

  maximumAccumulatedVolumeM3: number;
};

export type SurfaceFlowOptions = {
  /*
   * Fraction of incoming water retained in a cell before
   * downstream routing.
   *
   * Example:
   * 0.10 = retain 10%, route 90%.
   */
  retentionFraction?: number;

  /*
   * Maximum number of routing passes.
   *
   * Higher values allow water to travel farther through
   * depressions, but increase computation.
   */
  maxPasses?: number;

  /*
   * Minimum elevation difference required to consider a
   * neighbour meaningfully downhill.
   */
  minimumSlopeM?: number;
};

/* ================================================================
   DEFAULTS
================================================================ */

const DEFAULT_RETENTION =
  0.10;

const DEFAULT_MAX_PASSES =
  6;

const DEFAULT_MIN_SLOPE_M =
  0.000001;

/* ================================================================
   VALIDATION
================================================================ */

export function isValidElevationGrid(
  grid: ElevationGrid
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
   CELL AREA
================================================================ */

function calculateCellAreaM2(
  grid: RunoffGrid
): number {
  const meanLat =
    (
      grid.minLat +
      grid.maxLat
    ) /
    2;

  const latitudeRadians =
    (
      meanLat *
      Math.PI
    ) /
    180;

  const metresPerDegreeLat =
    111_320;

  const metresPerDegreeLon =
    111_320 *
    Math.cos(
      latitudeRadians
    );

  const totalWidthM =
    (
      grid.maxLon -
      grid.minLon
    ) *
    metresPerDegreeLon;

  const totalHeightM =
    (
      grid.maxLat -
      grid.minLat
    ) *
    metresPerDegreeLat;

  if (
    grid.width <= 0 ||
    grid.height <= 0
  ) {
    return 0;
  }

  return (
    totalWidthM /
      grid.width *
    (
      totalHeightM /
      grid.height
    )
  );
}

/* ================================================================
   INDEX HELPERS
================================================================ */

function getX(
  index: number,
  width: number
): number {
  return (
    index %
    width
  );
}

function getY(
  index: number,
  width: number
): number {
  return Math.floor(
    index / width
  );
}

function isBoundary(
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  return (
    x === 0 ||
    y === 0 ||
    x === width - 1 ||
    y === height - 1
  );
}

/* ================================================================
   NEIGHBOURS
================================================================ */

/*
 * D8 neighbourhood.
 *
 * Each entry:
 *
 * [dx, dy]
 */

const NEIGHBOURS: readonly [
  number,
  number
][] = [
  [-1, -1],
  [0, -1],
  [1, -1],

  [-1, 0],
  [1, 0],

  [-1, 1],
  [0, 1],
  [1, 1],
];

/* ================================================================
   FIND DOWNHILL CELL
================================================================ */

function findDownhillCell(
  index: number,
  elevationValues: Float32Array,
  width: number,
  height: number,
  minimumSlopeM: number
): number {
  const x =
    getX(
      index,
      width
    );

  const y =
    getY(
      index,
      width
    );

  const currentElevation =
    elevationValues[
      index
    ] ?? 0;

  let bestIndex =
    -1;

  let bestElevation =
    currentElevation;

  for (
    const [
      dx,
      dy,
    ] of NEIGHBOURS
  ) {
    const nx =
      x + dx;

    const ny =
      y + dy;

    if (
      nx < 0 ||
      nx >= width ||
      ny < 0 ||
      ny >= height
    ) {
      continue;
    }

    const neighbourIndex =
      ny *
        width +
      nx;

    const neighbourElevation =
      elevationValues[
        neighbourIndex
      ] ?? currentElevation;

    /*
     * Only allow water to move downhill.
     */
    if (
      neighbourElevation <
      bestElevation -
        minimumSlopeM
    ) {
      bestElevation =
        neighbourElevation;

      bestIndex =
        neighbourIndex;
    }
  }

  return bestIndex;
}

/* ================================================================
   CREATE FLOW DIRECTIONS
================================================================ */

export function createFlowDirectionGrid(
  elevation: ElevationGrid,
  minimumSlopeM =
    DEFAULT_MIN_SLOPE_M
): Int32Array {
  if (
    !isValidElevationGrid(
      elevation
    )
  ) {
    throw new Error(
      "Invalid elevation grid."
    );
  }

  const total =
    elevation.width *
    elevation.height;

  const directions =
    new Int32Array(
      total
    );

  directions.fill(
    -1
  );

  for (
    let index = 0;
    index < total;
    index++
  ) {
    directions[index] =
      findDownhillCell(
        index,
        elevation.values,
        elevation.width,
        elevation.height,
        minimumSlopeM
      );
  }

  return directions;
}

/* ================================================================
   SORT CELLS HIGH -> LOW
================================================================ */

/*
 * Water should be routed from higher cells toward lower cells.
 *
 * Sorting by elevation allows upstream contributions to be
 * processed before lower downstream cells.
 */

function getElevationOrder(
  elevation: ElevationGrid
): number[] {
  const total =
    elevation.width *
    elevation.height;

  const indices =
    Array.from(
      {
        length: total,
      },
      (_, index) =>
        index
    );

  indices.sort(
    (a, b) => {
      const ea =
        elevation.values[a] ??
        0;

      const eb =
        elevation.values[b] ??
        0;

      return eb - ea;
    }
  );

  return indices;
}

/* ================================================================
   SURFACE FLOW
================================================================ */

export function calculateSurfaceFlow(
  runoff: RunoffGrid,
  elevation: ElevationGrid,
  options: SurfaceFlowOptions = {}
): SurfaceFlowGrid {
  /* ==============================================================
     VALIDATION
  ============================================================== */

  if (
    runoff.width !==
      elevation.width ||
    runoff.height !==
      elevation.height
  ) {
    throw new Error(
      "Runoff grid and elevation grid dimensions must match."
    );
  }

  if (
    !isValidElevationGrid(
      elevation
    )
  ) {
    throw new Error(
      "Invalid elevation grid."
    );
  }

  /* ==============================================================
     OPTIONS
  ============================================================== */

  const retentionFraction =
    Math.max(
      0,
      Math.min(
        1,
        options.retentionFraction ??
          DEFAULT_RETENTION
      )
    );

  const maxPasses =
    Math.max(
      1,
      Math.floor(
        options.maxPasses ??
          DEFAULT_MAX_PASSES
      )
    );

  const minimumSlopeM =
    Math.max(
      0,
      options.minimumSlopeM ??
        DEFAULT_MIN_SLOPE_M
    );

  /* ==============================================================
     GRID
  ============================================================== */

  const totalCells =
    runoff.width *
    runoff.height;

  const areaM2 =
    calculateCellAreaM2(
      runoff
    );

  if (
    areaM2 <= 0
  ) {
    throw new Error(
      "Unable to calculate runoff cell area."
    );
  }

  /* ==============================================================
     FLOW DIRECTIONS
  ============================================================== */

  const flowTo =
    createFlowDirectionGrid(
      elevation,
      minimumSlopeM
    );

  /* ==============================================================
     WATER ARRAYS
  ============================================================== */

  /*
   * Initial runoff volume.
   */
  const initialVolume =
    new Float64Array(
      totalCells
    );

  /*
   * Water currently stored.
   */
  const waterVolume =
    new Float64Array(
      totalCells
    );

  /*
   * Total accumulated upstream contribution.
   */
  const accumulatedVolume =
    new Float64Array(
      totalCells
    );

  /*
   * Water that leaves the domain.
   */
  const outletVolume =
    new Float64Array(
      totalCells
    );

  /* ==============================================================
     LOAD RUNOFF
  ============================================================== */

  let totalInputVolume =
    0;

  for (
    let index = 0;
    index < totalCells;
    index++
  ) {
    const cell =
      runoff.cells[index];

    const volume =
      cell?.runoffVolumeM3 ??
      0;

    initialVolume[index] =
      Math.max(
        0,
        volume
      );

    waterVolume[index] =
      Math.max(
        0,
        volume
      );

    accumulatedVolume[index] =
      Math.max(
        0,
        volume
      );

    totalInputVolume +=
      Math.max(
        0,
        volume
      );
  }

  /* ==============================================================
     ELEVATION ORDER
  ============================================================== */

  const order =
    getElevationOrder(
      elevation
    );

  /* ==============================================================
     ROUTING PASSES
  ============================================================== */

  /*
   * We process several passes.
   *
   * Each pass allows water to move farther downhill.
   *
   * This is a simplified surface-routing model, not a full
   * hydrodynamic shallow-water solver.
   */

  for (
    let pass = 0;
    pass < maxPasses;
    pass++
  ) {
    let movedAnyWater =
      false;

    for (
      const index of
        order
    ) {
      const volume =
        waterVolume[
          index
        ];

      if (
        volume <= 0
      ) {
        continue;
      }

      const destination =
        flowTo[index] ??
        -1;

      /* ========================================================
         LOCAL DEPRESSION
      ======================================================== */

      if (
        destination < 0
      ) {
        continue;
      }

      const [
        currentX,
        currentY,
      ] = [
        getX(
          index,
          runoff.width
        ),
        getY(
          index,
          runoff.width
        ),
      ];

      const boundary =
        isBoundary(
          currentX,
          currentY,
          runoff.width,
          runoff.height
        );

      /*
       * If the cell is on the outer boundary and points outward,
       * discharge it from the model.
       *
       * For now we use the simpler rule that water at a boundary
       * cell can leave the domain.
       */
      if (
        boundary
      ) {
        outletVolume[index] +=
          volume;

        waterVolume[index] =
          0;

        movedAnyWater =
          true;

        continue;
      }

      /* ========================================================
         ROUTE DOWNHILL
      ======================================================== */

      const retained =
        volume *
        retentionFraction;

      const routed =
        volume -
        retained;

      /*
       * Keep the retained water in this cell.
       */
      waterVolume[index] =
        retained;

      /*
       * Send the remaining water to the downhill neighbour.
       */
      waterVolume[
        destination
      ] += routed;

      accumulatedVolume[
        destination
      ] += routed;

      if (
        routed > 0
      ) {
        movedAnyWater =
          true;
      }
    }

    if (
      !movedAnyWater
    ) {
      break;
    }
  }

  /* ==============================================================
     BUILD OUTPUT CELLS
  ============================================================== */

  const cells: SurfaceFlowCell[] =
    new Array(
      totalCells
    );

  let totalStoredVolume =
    0;

  let totalOutletVolume =
    0;

  let maximumWaterDepth =
    0;

  let maximumAccumulatedVolume =
    0;

  for (
    let index = 0;
    index < totalCells;
    index++
  ) {
    const x =
      getX(
        index,
        runoff.width
      );

    const y =
      getY(
        index,
        runoff.width
      );

    const stored =
      Math.max(
        0,
        waterVolume[index] ??
          0
      );

    const accumulated =
      Math.max(
        0,
        accumulatedVolume[
          index
        ] ?? 0
      );

    const outlet =
      Math.max(
        0,
        outletVolume[index] ??
          0
      );

    /*
     * 1 m³ / m² = 1 m depth.
     *
     * So volume divided by cell area gives depth in metres.
     */
    const waterDepth =
      stored /
      areaM2;

    totalStoredVolume +=
      stored;

    totalOutletVolume +=
      outlet;

    maximumWaterDepth =
      Math.max(
        maximumWaterDepth,
        waterDepth
      );

    maximumAccumulatedVolume =
      Math.max(
        maximumAccumulatedVolume,
        accumulated
      );

    cells[index] = {
      elevationM:
        elevation.values[
          index
        ] ?? 0,

      runoffVolumeM3:
        initialVolume[
          index
        ] ?? 0,

      surfaceWaterVolumeM3:
        stored,

      waterDepthM:
        waterDepth,

      flowTo:
        flowTo[index] ??
        -1,

      accumulatedVolumeM3:
        accumulated,

      outlet:
        isBoundary(
          x,
          y,
          runoff.width,
          runoff.height
        ),
    };
  }

  /* ==============================================================
     RESULT
  ============================================================== */

  return {
    width:
      runoff.width,

    height:
      runoff.height,

    cells,

    minLon:
      runoff.minLon,

    maxLon:
      runoff.maxLon,

    minLat:
      runoff.minLat,

    maxLat:
      runoff.maxLat,

    totalInputVolumeM3:
      totalInputVolume,

    totalStoredVolumeM3:
      totalStoredVolume,

    totalOutletVolumeM3:
      totalOutletVolume,

    maximumWaterDepthM:
      maximumWaterDepth,

    maximumAccumulatedVolumeM3:
      maximumAccumulatedVolume,
  };
}

/* ================================================================
   WATER DEPTH GRID
================================================================ */

export function extractWaterDepthGrid(
  flow: SurfaceFlowGrid
): Float32Array {
  const values =
    new Float32Array(
      flow.width *
        flow.height
    );

  for (
    let index = 0;
    index < values.length;
    index++
  ) {
    values[index] =
      flow.cells[index]
        ?.waterDepthM ??
      0;
  }

  return values;
}

/* ================================================================
   WATER DEPTH IN CENTIMETRES
================================================================ */

export function getWaterDepthCm(
  flow: SurfaceFlowGrid,
  index: number
): number {
  if (
    index < 0 ||
    index >=
      flow.cells.length
  ) {
    return 0;
  }

  return (
    (
      flow.cells[index]
        ?.waterDepthM ??
      0
    ) *
    100
  );
}

/* ================================================================
   FLOW DIRECTION
================================================================ */

export function getFlowDirection(
  flow: SurfaceFlowGrid,
  index: number
): number {
  if (
    index < 0 ||
    index >=
      flow.cells.length
  ) {
    return -1;
  }

  return (
    flow.cells[index]
      ?.flowTo ??
    -1
  );
}

/* ================================================================
   SUMMARY
================================================================ */

export function getSurfaceFlowSummary(
  flow: SurfaceFlowGrid
) {
  let affectedCells =
    0;

  let criticalCells =
    0;

  for (
    const cell of
      flow.cells
  ) {
    if (
      cell.waterDepthM >
      0
    ) {
      affectedCells++;
    }

    /*
     * 15 cm threshold is only a visualization threshold
     * for the prototype.
     *
     * It is NOT an official hazard standard.
     */
    if (
      cell.waterDepthM >=
      0.15
    ) {
      criticalCells++;
    }
  }

  const totalCells =
    flow.cells.length;

  return {
    maximumWaterDepthM:
      flow.maximumWaterDepthM,

    maximumWaterDepthCm:
      flow.maximumWaterDepthM *
      100,

    affectedCells,

    affectedPercentage:
      totalCells > 0
        ? (
            affectedCells /
            totalCells
          ) *
          100
        : 0,

    criticalCells,

    criticalPercentage:
      totalCells > 0
        ? (
            criticalCells /
            totalCells
          ) *
          100
        : 0,

    totalInputVolumeM3:
      flow.totalInputVolumeM3,

    totalStoredVolumeM3:
      flow.totalStoredVolumeM3,

    totalOutletVolumeM3:
      flow.totalOutletVolumeM3,

    maximumAccumulatedVolumeM3:
      flow.maximumAccumulatedVolumeM3,
  };
}