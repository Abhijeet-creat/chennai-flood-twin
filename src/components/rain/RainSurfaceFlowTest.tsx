"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  decodeChennaiSRI,
} from "@/lib/rain/sriDecoder";

import type {
  RainfallGrid,
} from "@/lib/rain/radar";

import {
  calculateRunoffGrid,
  type RunoffGrid,
} from "@/lib/rain/runoff";

import {
  createCityRainfallGrid,
} from "@/lib/rain/cityRainfall";

import {
  createTerrainElevationGrid,
  getTerrainElevationStats,
} from "@/lib/rain/terrainElevation";

import {
  calculateSurfaceFlow,
  getSurfaceFlowSummary,
  type ElevationGrid,
  type SurfaceFlowGrid,
} from "@/lib/rain/surfaceFlow";

/* ================================================================
   RESULT
================================================================ */

type TestResult = {
  rainfall: RainfallGrid;
  runoff: RunoffGrid;
  elevation: ElevationGrid;
  surface: SurfaceFlowGrid;
};

/* ================================================================
   COMPONENT
================================================================ */

export default function RainSurfaceFlowTest() {
  const [result, setResult] =
    useState<TestResult | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  /* ==============================================================
     RUN COMPLETE CHAIN
  ============================================================== */

  const runModel = async () => {
    setLoading(true);
    setError(null);

    try {
      /* ==========================================================
         1. REAL IMD RAINFALL
      ========================================================== */

      const radarGrid =
        await decodeChennaiSRI(
          "/radar/chennai-sri.jpg",
          {
            minLon: 80.0,
            maxLon: 81.0,

            minLat: 12.0,
            maxLat: 14.0,

            cropLeft: 0,
            cropTop: 0,

            cropRight: 0.74,
            cropBottom: 0.96,

            outputWidth: 300,
            outputHeight: 300,

            observedAt:
              new Date().toISOString(),
          }
        );

      /* ==========================================================
         2. CROP TO ACTUAL DIGITAL TWIN
      ========================================================== */

      const cityRainfall =
        createCityRainfallGrid(
          radarGrid,
          {
            width: 120,
            height: 120,
          }
        );

      /* ==========================================================
         3. RAINFALL -> RUNOFF
      ========================================================== */

      const runoff =
        calculateRunoffGrid(
          cityRainfall,
          {
            /*
             * 15-minute timestep.
             */
            timestepMinutes: 15,

            /*
             * Temporary urban fallback.
             */
            defaultImperviousness:
              0.72,

            /*
             * Temporary infiltration fallback.
             */
            defaultInfiltrationRateMmHr:
              8,
          }
        );

      /* ==========================================================
         4. EXISTING REAL TERRAIN / DEM
      ========================================================== */

      const elevation =
        await createTerrainElevationGrid(
          {
            width: 120,
            height: 120,

            imageUrl:
              "/velachery-heightmap.png",
          }
        );

      /* ==========================================================
         5. RUN SURFACE FLOW
      ========================================================== */

      const surface =
        calculateSurfaceFlow(
          runoff,
          elevation,
          {
            /*
             * Retain 10% locally and route 90% downhill.
             */
            retentionFraction:
              0.10,

            /*
             * Several routing passes allow water to travel
             * across multiple cells.
             */
            maxPasses: 6,

            /*
             * Very small threshold because the DEM is compressed
             * visually but processed here in real metres.
             */
            minimumSlopeM:
              0.000001,
          }
        );

      setResult({
        rainfall:
          cityRainfall,

        runoff,

        elevation,

        surface,
      });
    } catch (modelError) {
      setError(
        modelError instanceof Error
          ? modelError.message
          : "Surface-flow model failed."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==============================================================
     INITIAL RUN
  ============================================================== */

  useEffect(() => {
    void runModel();
  }, []);

  /* ==============================================================
     SUMMARIES
  ============================================================== */

  const surfaceSummary =
    result
      ? getSurfaceFlowSummary(
          result.surface
        )
      : null;

  const elevationSummary =
    result
      ? getTerrainElevationStats(
          result.elevation
        )
      : null;

  /* ==============================================================
     RENDER
  ============================================================== */

  return (
    <main className="min-h-screen overflow-y-auto bg-[#071522] px-6 py-8 text-white">

      <div className="mx-auto w-full max-w-6xl">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-7">

          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            SIH Rainfall Engine
          </div>

          <h1 className="mt-2 text-3xl font-semibold">
            Rainfall → Surface Flow
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
            Real IMD rainfall is converted into runoff
            and routed downhill across the existing
            Velachery terrain elevation grid.
          </p>

        </div>

        {/* ======================================================
            RUN BUTTON
        ====================================================== */}

        <button
          type="button"
          onClick={() =>
            void runModel()
          }
          disabled={loading}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Running Surface Model..."
            : "Run Surface Flow"}
        </button>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4">

            <div className="text-sm font-semibold text-red-300">
              Model Error
            </div>

            <div className="mt-2 text-xs leading-5 text-red-200/70">
              {error}
            </div>

          </div>
        )}

        {/* ======================================================
            RESULTS
        ====================================================== */}

        {result &&
          surfaceSummary &&
          elevationSummary && (
            <div className="mt-6 space-y-5">

              {/* ==================================================
                  MAIN RESULT
              ================================================== */}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                <Metric
                  label="Max Rainfall"
                  value={`${getMaximumRainfall(
                    result.rainfall
                  ).toFixed(
                    1
                  )} mm/hr`}
                />

                <Metric
                  label="Max Water Depth"
                  value={`${surfaceSummary.maximumWaterDepthCm.toFixed(
                    2
                  )} cm`}
                />

                <Metric
                  label="Affected Cells"
                  value={`${surfaceSummary.affectedPercentage.toFixed(
                    2
                  )}%`}
                />

                <Metric
                  label="Stored Water"
                  value={`${surfaceSummary.totalStoredVolumeM3.toFixed(
                    2
                  )} m³`}
                />

              </div>

              {/* ==================================================
                  TERRAIN
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Terrain Input
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="Grid"
                    value={`${result.elevation.width} × ${result.elevation.height}`}
                  />

                  <Info
                    label="Minimum Elevation"
                    value={`${elevationSummary.minimumElevationM.toFixed(
                      3
                    )} m`}
                  />

                  <Info
                    label="Maximum Elevation"
                    value={`${elevationSummary.maximumElevationM.toFixed(
                      3
                    )} m`}
                  />

                  <Info
                    label="Elevation Range"
                    value={`${elevationSummary.elevationRangeM.toFixed(
                      3
                    )} m`}
                  />

                </div>

              </section>

              {/* ==================================================
                  RAINFALL
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Rainfall Input
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="Grid"
                    value={`${result.rainfall.width} × ${result.rainfall.height}`}
                  />

                  <Info
                    label="Longitude"
                    value={`${result.rainfall.minLon.toFixed(
                      6
                    )} – ${result.rainfall.maxLon.toFixed(
                      6
                    )}`}
                  />

                  <Info
                    label="Latitude"
                    value={`${result.rainfall.minLat.toFixed(
                      6
                    )} – ${result.rainfall.maxLat.toFixed(
                      6
                    )}`}
                  />

                  <Info
                    label="Maximum"
                    value={`${getMaximumRainfall(
                      result.rainfall
                    ).toFixed(
                      1
                    )} mm/hr`}
                  />

                </div>

              </section>

              {/* ==================================================
                  RUNOFF
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Runoff
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="Rainfall Depth"
                    value={`${result.runoff.totalRainfallMm.toFixed(
                      2
                    )} mm`}
                  />

                  <Info
                    label="Infiltration"
                    value={`${result.runoff.totalInfiltrationMm.toFixed(
                      2
                    )} mm`}
                  />

                  <Info
                    label="Runoff"
                    value={`${result.runoff.totalRunoffMm.toFixed(
                      2
                    )} mm`}
                  />

                  <Info
                    label="Runoff Volume"
                    value={`${result.runoff.totalRunoffVolumeM3.toFixed(
                      2
                    )} m³`}
                  />

                </div>

              </section>

              {/* ==================================================
                  SURFACE FLOW
              ================================================== */}

              <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">
                  Surface Water Routing
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="Maximum Depth"
                    value={`${surfaceSummary.maximumWaterDepthCm.toFixed(
                      2
                    )} cm`}
                  />

                  <Info
                    label="Affected Cells"
                    value={`${surfaceSummary.affectedCells}`}
                  />

                  <Info
                    label="Critical Cells"
                    value={`${surfaceSummary.criticalCells}`}
                  />

                  <Info
                    label="Outlet Volume"
                    value={`${surfaceSummary.totalOutletVolumeM3.toFixed(
                      2
                    )} m³`}
                  />

                </div>

              </section>

              {/* ==================================================
                  SAMPLE LOWEST CELLS
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Highest Water Cells
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">

                  {getHighestWaterCells(
                    result.surface,
                    10
                  ).map(
                    (
                      cell,
                      index
                    ) => (
                      <div
                        key={index}
                        className="rounded-xl bg-black/20 p-3"
                      >

                        <div className="text-[9px] uppercase tracking-wider text-white/30">
                          Cell{" "}
                          {index + 1}
                        </div>

                        <div className="mt-2 font-mono text-sm text-cyan-300">
                          {cell.depthCm.toFixed(
                            2
                          )} cm
                        </div>

                        <div className="mt-1 text-[10px] text-white/35">
                          Ground{" "}
                          {cell.elevationM.toFixed(
                            2
                          )} m
                        </div>

                        <div className="mt-1 text-[10px] text-white/30">
                          Water{" "}
                          {cell.volumeM3.toFixed(
                            3
                          )} m³
                        </div>

                      </div>
                    )
                  )}

                </div>

              </section>

              {/* ==================================================
                  PIPELINE
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  SIH Flood Pipeline
                </div>

                <div className="mt-5 grid gap-2 md:grid-cols-5">

                  <PipelineStep
                    number="01"
                    text="IMD Rainfall"
                  />

                  <PipelineStep
                    number="02"
                    text="City Rain Grid"
                  />

                  <PipelineStep
                    number="03"
                    text="Runoff"
                  />

                  <PipelineStep
                    number="04"
                    text="DEM Flow"
                  />

                  <PipelineStep
                    number="05"
                    text="Water Depth"
                  />

                </div>

                <p className="mt-5 text-xs leading-5 text-white/40">
                  The next stage will connect these
                  surface-flow cells to the stormwater
                  drainage network and calculate
                  surcharge and flood accumulation.
                </p>

              </section>

            </div>
          )}

      </div>

    </main>
  );
}

/* ================================================================
   MAXIMUM RAINFALL
================================================================ */

function getMaximumRainfall(
  grid: RainfallGrid
): number {
  let maximum = 0;

  for (
    const value of
      grid.values
  ) {
    if (
      Number.isFinite(
        value
      ) &&
      value > maximum
    ) {
      maximum =
        value;
    }
  }

  return maximum;
}

/* ================================================================
   HIGHEST WATER CELLS
================================================================ */

function getHighestWaterCells(
  grid: SurfaceFlowGrid,
  count: number
) {
  return grid.cells
    .map(
      (
        cell,
        index
      ) => ({
        index,
        depthCm:
          cell.waterDepthM *
          100,
        elevationM:
          cell.elevationM,
        volumeM3:
          cell.surfaceWaterVolumeM3,
      })
    )
    .filter(
      (cell) =>
        cell.depthCm > 0
    )
    .sort(
      (a, b) =>
        b.depthCm -
        a.depthCm
    )
    .slice(
      0,
      count
    );
}

/* ================================================================
   METRIC
================================================================ */

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4">

      <div className="text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </div>

      <div className="mt-2 font-mono text-lg text-cyan-300">
        {value}
      </div>

    </div>
  );
}

/* ================================================================
   INFO
================================================================ */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-black/20 p-3">

      <div className="text-[10px] uppercase tracking-wider text-white/30">
        {label}
      </div>

      <div className="mt-1 text-sm text-white/75">
        {value}
      </div>

    </div>
  );
}

/* ================================================================
   PIPELINE STEP
================================================================ */

function PipelineStep({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">

      <div className="font-mono text-[10px] text-cyan-400/60">
        {number}
      </div>

      <div className="mt-2 text-sm font-semibold text-white/75">
        {text}
      </div>

    </div>
  );
}