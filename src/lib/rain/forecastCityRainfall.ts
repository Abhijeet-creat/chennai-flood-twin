/* ================================================================
   FORECAST CITY RAINFALL

   Converts each 0–3 hour nowcast frame from the larger
   IMD radar domain into the exact Chennai Digital Twin area.

   PIPELINE:

     IMD radar
         ↓
     nowcast.ts
         ↓
     RainfallForecastFrame
         ↓
     forecastCityRainfall.ts
         ↓
     CityRainfallForecast
         ↓
     runoff.ts
         ↓
     surfaceFlow.ts
================================================================ */

import type {
  RainfallGrid,
} from "./radar";

import type {
  RainfallForecastFrame,
  RainfallNowcast,
} from "./nowcast";

import {
  createCityRainfallGrid,
  getCityRainfallStats,
} from "./cityRainfall";

/* ================================================================
   TYPES
================================================================ */

export type CityRainfallForecastFrame = {
  leadMinutes: number;

  validAt: string;

  grid: RainfallGrid;

  confidence: number;

  velocityX: number;

  velocityY: number;

  maximumRainfallMmHr: number;

  meanRainfallMmHr: number;

  affectedPercentage: number;
};

export type CityRainfallForecast = {
  source: "IMD";

  generatedAt: string;

  baseObservationTime: string;

  frames: CityRainfallForecastFrame[];

  maximumForecastRainfallMmHr: number;

  maximumForecastLeadMinutes: number;

  confidence: number;
};

/* ================================================================
   DEFAULT CITY GRID
================================================================ */

const DEFAULT_CITY_WIDTH =
  120;

const DEFAULT_CITY_HEIGHT =
  120;

/* ================================================================
   CONVERT ONE FORECAST FRAME
================================================================ */

export function convertForecastFrameToCity(
  frame: RainfallForecastFrame,
  width =
    DEFAULT_CITY_WIDTH,
  height =
    DEFAULT_CITY_HEIGHT
): CityRainfallForecastFrame {
  const cityGrid =
    createCityRainfallGrid(
      frame.grid,
      {
        width,
        height,
      }
    );

  const stats =
    getCityRainfallStats(
      cityGrid
    );

  return {
    leadMinutes:
      frame.leadMinutes,

    validAt:
      frame.validAt,

    grid:
      cityGrid,

    confidence:
      frame.confidence,

    velocityX:
      frame.velocityX,

    velocityY:
      frame.velocityY,

    maximumRainfallMmHr:
      stats.maximumRainfallMmHr,

    meanRainfallMmHr:
      stats.meanRainfallMmHr,

    affectedPercentage:
      stats.nonZeroPercentage,
  };
}

/* ================================================================
   CONVERT ENTIRE NOWCAST
================================================================ */

export function createCityRainfallForecast(
  nowcast: RainfallNowcast,
  options: {
    width?: number;
    height?: number;
  } = {}
): CityRainfallForecast {
  const width =
    Math.max(
      1,
      Math.floor(
        options.width ??
          DEFAULT_CITY_WIDTH
      )
    );

  const height =
    Math.max(
      1,
      Math.floor(
        options.height ??
          DEFAULT_CITY_HEIGHT
      )
    );

  const frames =
    nowcast.frames.map(
      (frame) =>
        convertForecastFrameToCity(
          frame,
          width,
          height
        )
    );

  let maximumForecastRainfall =
    0;

  let maximumForecastLead =
    0;

  for (
    const frame of frames
  ) {
    if (
      frame.maximumRainfallMmHr >
      maximumForecastRainfall
    ) {
      maximumForecastRainfall =
        frame.maximumRainfallMmHr;

      maximumForecastLead =
        frame.leadMinutes;
    }
  }

  return {
    source: "IMD",

    generatedAt:
      new Date().toISOString(),

    baseObservationTime:
      nowcast.baseObservationTime,

    frames,

    maximumForecastRainfallMmHr:
      maximumForecastRainfall,

    maximumForecastLeadMinutes:
      maximumForecastLead,

    confidence:
      nowcast.confidence,
  };
}

/* ================================================================
   GET CITY FORECAST FRAME
================================================================ */

export function getCityForecastFrame(
  forecast: CityRainfallForecast,
  leadMinutes: number
): CityRainfallForecastFrame | null {
  if (
    forecast.frames.length ===
    0
  ) {
    return null;
  }

  const exact =
    forecast.frames.find(
      (frame) =>
        frame.leadMinutes ===
        leadMinutes
    );

  if (exact) {
    return exact;
  }

  let nearest =
    forecast.frames[0];

  let nearestDistance =
    Math.abs(
      nearest.leadMinutes -
        leadMinutes
    );

  for (
    const frame of
      forecast.frames
  ) {
    const distance =
      Math.abs(
        frame.leadMinutes -
          leadMinutes
      );

    if (
      distance <
      nearestDistance
    ) {
      nearest =
        frame;

      nearestDistance =
        distance;
    }
  }

  return nearest;
}

/* ================================================================
   GET CITY FORECAST TIMELINE
================================================================ */

export function getCityForecastTimeline(
  forecast: CityRainfallForecast
): {
  leadMinutes: number;
  validAt: string;
  maximumRainfallMmHr: number;
  meanRainfallMmHr: number;
  affectedPercentage: number;
  confidence: number;
}[] {
  return forecast.frames.map(
    (frame) => ({
      leadMinutes:
        frame.leadMinutes,

      validAt:
        frame.validAt,

      maximumRainfallMmHr:
        frame.maximumRainfallMmHr,

      meanRainfallMmHr:
        frame.meanRainfallMmHr,

      affectedPercentage:
        frame.affectedPercentage,

      confidence:
        frame.confidence,
    })
  );
}

/* ================================================================
   GET RAINFALL AT CITY CELL
================================================================ */

export function getForecastRainfallAtCell(
  frame:
    CityRainfallForecastFrame,
  x: number,
  y: number
): number {
  if (
    x < 0 ||
    y < 0 ||
    x >= frame.grid.width ||
    y >= frame.grid.height
  ) {
    return 0;
  }

  const index =
    y *
      frame.grid.width +
    x;

  return (
    frame.grid.values[
      index
    ] ?? 0
  );
}

/* ================================================================
   GET RAINFALL AT GEOGRAPHIC LOCATION
================================================================ */

export function getForecastRainfallAtLocation(
  frame:
    CityRainfallForecastFrame,
  lon: number,
  lat: number
): number {
  const grid =
    frame.grid;

  if (
    lon < grid.minLon ||
    lon > grid.maxLon ||
    lat < grid.minLat ||
    lat > grid.maxLat
  ) {
    return 0;
  }

  const normalizedX =
    (
      lon -
      grid.minLon
    ) /
    (
      grid.maxLon -
      grid.minLon
    );

  const normalizedY =
    (
      lat -
      grid.minLat
    ) /
    (
      grid.maxLat -
      grid.minLat
    );

  const x =
    Math.max(
      0,
      Math.min(
        grid.width - 1,
        Math.round(
          normalizedX *
          (
            grid.width - 1
          )
        )
      )
    );

  /*
   * Rainfall grid is stored top-to-bottom,
   * so invert latitude.
   */
  const y =
    Math.max(
      0,
      Math.min(
        grid.height - 1,
        Math.round(
          (
            1 -
            normalizedY
          ) *
          (
            grid.height - 1
          )
        )
      )
    );

  return getForecastRainfallAtCell(
    frame,
    x,
    y
  );
}

/* ================================================================
   FIND WORST FORECAST FRAME
================================================================ */

export function getWorstCityRainfallFrame(
  forecast: CityRainfallForecast
): CityRainfallForecastFrame | null {
  if (
    forecast.frames.length ===
    0
  ) {
    return null;
  }

  let worst =
    forecast.frames[0];

  for (
    const frame of
      forecast.frames
  ) {
    if (
      frame.maximumRainfallMmHr >
      worst.maximumRainfallMmHr
    ) {
      worst =
        frame;
    }
  }

  return worst;
}

/* ================================================================
   SUMMARY
================================================================ */

export function getCityRainfallForecastSummary(
  forecast: CityRainfallForecast
) {
  let totalAffectedPercentage =
    0;

  let maximumMeanRainfall =
    0;

  for (
    const frame of
      forecast.frames
  ) {
    totalAffectedPercentage +=
      frame.affectedPercentage;

    maximumMeanRainfall =
      Math.max(
        maximumMeanRainfall,
        frame.meanRainfallMmHr
      );
  }

  const frameCount =
    forecast.frames.length;

  return {
    frameCount,

    maximumForecastRainfallMmHr:
      forecast.maximumForecastRainfallMmHr,

    maximumForecastLeadMinutes:
      forecast.maximumForecastLeadMinutes,

    maximumMeanRainfallMmHr:
      maximumMeanRainfall,

    averageAffectedPercentage:
      frameCount > 0
        ? totalAffectedPercentage /
          frameCount
        : 0,

    confidencePercent:
      Math.round(
        forecast.confidence *
          100
      ),
  };
}