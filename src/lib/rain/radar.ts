/* ================================================================
   IMD CHENNAI DOPPLER RADAR
   Radar source definitions for the SIH Rain Nowcasting system.

   IMPORTANT:
   IMD currently exposes Chennai radar products through its official
   radar web service.

   Verified products include:
   - Surface Rainfall Intensity (SRI)
   - Precipitation Accumulation
   - Radar reflectivity products
   - 3-hour radar animation

   We keep the source URLs here.

   We do NOT assume that the public HTML page is itself a
   machine-readable rainfall raster API.

   The next server-side ingestion layer can fetch/parse the official
   radar product and convert it into our normalized rainfall grid.
================================================================ */

/* ================================================================
   RADAR SOURCE
================================================================ */

export type RadarSource = {
  id: string;

  name: string;

  city: string;

  provider: "IMD";

  currentUrl: string;

  animationUrl: string;

  latitude: number;

  longitude: number;

  coverageKm: number;
};

/*
 * Chennai DWR source.

 * Chennai radar is the primary radar source for the Velachery
 * digital twin.
 *
 * Chennai radar location is used only as a metadata reference here.
 * Exact operational coordinates should come from the official
 * radar metadata when we build the geospatial ingestion layer.
 */
export const CHENNAI_RADAR: RadarSource = {
  id: "imd-chennai",

  name: "IMD Chennai DWR",

  city: "Chennai",

  provider: "IMD",

  currentUrl:
    "https://mausam.imd.gov.in/responsive/radar.php?id=Chennai",

  animationUrl:
    "https://mausam.imd.gov.in/responsive/radar_animation.php?id=Chennai",

  /*
   * Chennai / Velachery reference point.
   *
   * These coordinates are NOT used to reconstruct radar geometry.
   * They are only a convenient map reference.
   */
  latitude: 13.0827,

  longitude: 80.2707,

  /*
   * Keep this configurable.
   *
   * We should replace it with the official radar
   * effective coverage metadata when available.
   */
  coverageKm: 250,
};

/* ================================================================
   RADAR PRODUCTS
================================================================ */

export type RadarProductType =
  | "sri"
  | "accumulation"
  | "reflectivity"
  | "velocity"
  | "volume_velocity";

export type RadarProduct = {
  type: RadarProductType;

  label: string;

  description: string;

  source: RadarSource;
};

/* ================================================================
   SURFACE RAINFALL INTENSITY
================================================================ */

export const CHENNAI_SRI_PRODUCT: RadarProduct = {
  type: "sri",

  label:
    "Surface Rainfall Intensity",

  description:
    "Instantaneous rainfall intensity estimated from Doppler weather radar.",

  source:
    CHENNAI_RADAR,
};

/* ================================================================
   PRECIPITATION ACCUMULATION
================================================================ */

export const CHENNAI_ACCUMULATION_PRODUCT:
  RadarProduct = {
    type: "accumulation",

    label:
      "Precipitation Accumulation",

    description:
      "Accumulated precipitation estimated from the radar product.",

    source:
      CHENNAI_RADAR,
  };

/* ================================================================
   NORMALIZED RAINFALL GRID
================================================================ */

/*
 * This is the format our flood model will eventually consume.
 *
 * The radar ingestion adapter will convert the official radar
 * product into this grid.
 *
 * We keep the format independent of the radar provider so that
 * another rainfall source can be added later without changing
 * runoff.ts or nowcast.ts.
 */

export type RainfallGrid = {
  width: number;

  height: number;

  values: Float32Array;

  minLon: number;

  maxLon: number;

  minLat: number;

  maxLat: number;

  /*
   * Rainfall unit.
   *
   * SRI is normally represented as rainfall rate.
   * We normalize to millimetres/hour for our runoff model.
   */
  units:
    | "mm_per_hour"
    | "mm";

  observedAt: string;

  source: "IMD";

  radarId: string;
};

/* ================================================================
   RADAR OBSERVATION
================================================================ */

export type RadarObservation = {
  radarId: string;

  product:
    RadarProductType;

  observedAt: string;

  imageUrl: string | null;

  grid: RainfallGrid | null;

  /*
   * True when the value has actually been converted
   * into a georeferenced rainfall grid.
   *
   * False means we only have the official radar product
   * page/image and have NOT yet extracted quantitative
   * rainfall cells.
   */
  quantitative: boolean;
};

/* ================================================================
   SOURCE URL HELPERS
================================================================ */

export function getRadarSource(
  radarId = "imd-chennai"
): RadarSource | null {
  switch (radarId) {
    case "imd-chennai":
      return CHENNAI_RADAR;

    default:
      return null;
  }
}

/* ================================================================
   PRODUCT HELPERS
================================================================ */

export function getRadarProduct(
  product: RadarProductType
): RadarProduct | null {
  switch (product) {
    case "sri":
      return CHENNAI_SRI_PRODUCT;

    case "accumulation":
      return CHENNAI_ACCUMULATION_PRODUCT;

    case "reflectivity":
      return {
        type: "reflectivity",

        label:
          "Radar Reflectivity",

        description:
          "Radar reflectivity product used to identify precipitation echoes and storm structure.",

        source:
          CHENNAI_RADAR,
      };

    case "velocity":
      return {
        type: "velocity",

        label:
          "Radial Velocity",

        description:
          "Doppler radar velocity product.",

        source:
          CHENNAI_RADAR,
      };

    case "volume_velocity":
      return {
        type:
          "volume_velocity",

        label:
          "Volume Velocity Processing",

        description:
          "Radar volume/velocity processing product.",

        source:
          CHENNAI_RADAR,
      };

    default:
      return null;
  }
}

/* ================================================================
   PRODUCT URL
================================================================ */

/*
 * At this stage we return the official IMD page rather than
 * inventing a direct image filename.
 *
 * The server-side radar adapter will later resolve the actual
 * product image/data from this official service.
 */

export function getRadarProductPage(
  product:
    | RadarProductType
    | "animation" = "sri"
): string {
  const source =
    CHENNAI_RADAR;

  if (
    product ===
    "animation"
  ) {
    return source.animationUrl;
  }

  return source.currentUrl;
}

/* ================================================================
   RADAR COVERAGE CHECK
================================================================ */

/*
 * Simple geographical coverage check.
 *
 * This is NOT a replacement for the true radar beam geometry.
 * It only answers whether the point is reasonably close to the
 * Chennai radar source.
 */

export function isInsideRadarCoverage(
  longitude: number,
  latitude: number,
  radar:
    RadarSource = CHENNAI_RADAR
): boolean {
  const earthRadiusKm =
    6371;

  const lat1 =
    THREE_DEGREES_TO_RADIANS(
      radar.latitude
    );

  const lat2 =
    THREE_DEGREES_TO_RADIANS(
      latitude
    );

  const deltaLat =
    THREE_DEGREES_TO_RADIANS(
      latitude -
        radar.latitude
    );

  const deltaLon =
    THREE_DEGREES_TO_RADIANS(
      longitude -
        radar.longitude
    );

  const a =
    Math.sin(
      deltaLat / 2
    ) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(
        deltaLon / 2
      ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  const distanceKm =
    earthRadiusKm * c;

  return (
    distanceKm <=
    radar.coverageKm
  );
}

function THREE_DEGREES_TO_RADIANS(
  degrees: number
): number {
  return (
    degrees *
    Math.PI /
    180
  );
}

/* ================================================================
   RAINFALL GRID VALIDATION
================================================================ */

export function isValidRainfallGrid(
  grid: RainfallGrid
): boolean {
  if (
    grid.width <= 0 ||
    grid.height <= 0
  ) {
    return false;
  }

  if (
    grid.values.length !==
    grid.width *
      grid.height
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      grid.minLon
    ) ||
    !Number.isFinite(
      grid.maxLon
    ) ||
    !Number.isFinite(
      grid.minLat
    ) ||
    !Number.isFinite(
      grid.maxLat
    )
  ) {
    return false;
  }

  return true;
}

/* ================================================================
   GRID SAMPLE
================================================================ */

/*
 * Sample a rainfall grid at a geographic coordinate.
 *
 * Returns rainfall rate in the grid's declared unit.
 */

export function sampleRainfallGrid(
  grid: RainfallGrid,
  longitude: number,
  latitude: number
): number {
  if (
    !isValidRainfallGrid(
      grid
    )
  ) {
    return 0;
  }

  const nx =
    Math.min(
      1,
      Math.max(
        0,
        (
          longitude -
            grid.minLon
        ) /
          (
            grid.maxLon -
            grid.minLon
          )
      )
    );

  const ny =
    Math.min(
      1,
      Math.max(
        0,
        (
          latitude -
            grid.minLat
        ) /
          (
            grid.maxLat -
            grid.minLat
          )
      )
    );

  const x =
    Math.round(
      nx *
        (
          grid.width -
          1
        )
    );

  const y =
    Math.round(
      (
        1 - ny
      ) *
        (
          grid.height -
          1
        )
    );

  const index =
    y *
      grid.width +
    x;

  return (
    grid.values[index] ??
    0
  );
}

/* ================================================================
   RAINFALL RANGE
================================================================ */

export function getRainfallRange(
  grid: RainfallGrid
): {
  min: number;
  max: number;
} {
  if (
    !isValidRainfallGrid(
      grid
    )
  ) {
    return {
      min: 0,
      max: 0,
    };
  }

  let min =
    Infinity;

  let max =
    -Infinity;

  for (
    let i = 0;
    i <
    grid.values.length;
    i++
  ) {
    const value =
      grid.values[i];

    if (
      !Number.isFinite(
        value
      )
    ) {
      continue;
    }

    min =
      Math.min(
        min,
        value
      );

    max =
      Math.max(
        max,
        value
      );
  }

  if (
    min === Infinity
  ) {
    return {
      min: 0,
      max: 0,
    };
  }

  return {
    min,
    max,
  };
}

/* ================================================================
   EMPTY OBSERVATION
================================================================ */

export function createEmptyRadarObservation(
  product:
    RadarProductType = "sri"
): RadarObservation {
  return {
    radarId:
      CHENNAI_RADAR.id,

    product,

    observedAt:
      new Date().toISOString(),

    imageUrl:
      null,

    grid:
      null,

    quantitative:
      false,
  };
}