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
  getRunoffSummary,
  type RunoffCell,
  type RunoffGrid,
} from "@/lib/rain/runoff";

import {
  createCityRainfallGrid,
  getCityRainfallStats,
} from "@/lib/rain/cityRainfall";

/* ================================================================
   TYPES
================================================================ */

type TestResult = {
  radarRainfall: RainfallGrid;
  cityRainfall: RainfallGrid;
  runoff: RunoffGrid;
};

/* ================================================================
   MAIN COMPONENT
================================================================ */

export default function RainRunoffTest() {
  const [
    result,
    setResult,
  ] = useState<TestResult | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  /* ==============================================================
     RUN MODEL
  ============================================================== */

  const runModel = async () => {
    setLoading(true);
    setError(null);

    try {
      /* ==========================================================
         STEP 1
         Decode real IMD SRI image
      ========================================================== */

      const radarRainfall =
        await decodeChennaiSRI(
          "/radar/chennai-sri.jpg",
          {
            /*
             * Current radar-domain bounds used by the
             * screenshot decoder.
             */
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
         STEP 2
         Extract EXACT digital-twin area
      ========================================================== */

      const cityRainfall =
        createCityRainfallGrid(
          radarRainfall,
          {
            width: 120,
            height: 120,
          }
        );

      /* ==========================================================
         STEP 3
         Calculate runoff ONLY for city area
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
             * Temporary fallback.
             *
             * Replace later with actual land-cover data.
             */
            defaultImperviousness: 0.72,

            /*
             * Temporary fallback infiltration.
             */
            defaultInfiltrationRateMmHr: 8,
          }
        );

      setResult({
        radarRainfall,
        cityRainfall,
        runoff,
      });
    } catch (modelError) {
      setError(
        modelError instanceof Error
          ? modelError.message
          : "Rainfall-runoff model failed."
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

  const runoffSummary =
    result
      ? getRunoffSummary(
          result.runoff
        )
      : null;

  const cityRainfallSummary =
    result
      ? getCityRainfallStats(
          result.cityRainfall
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
            Rainfall → City Runoff Test
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
            Real IMD rainfall is first extracted to the
            exact Chennai digital-twin area and then
            converted into surface runoff.
          </p>

        </div>

        {/* ======================================================
            ACTION
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
            ? "Running Model..."
            : "Run Rainfall → Runoff"}
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
          runoffSummary &&
          cityRainfallSummary && (
            <div className="mt-6 space-y-5">

              {/* ==================================================
                  MAIN SUMMARY
              ================================================== */}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                <Metric
                  label="City Maximum Rainfall"
                  value={`${cityRainfallSummary.maximumRainfallMmHr.toFixed(
                    1
                  )} mm/hr`}
                />

                <Metric
                  label="Maximum Runoff"
                  value={`${runoffSummary.maximumRunoffMm.toFixed(
                    2
                  )} mm`}
                />

                <Metric
                  label="Affected Cells"
                  value={`${runoffSummary.affectedPercentage.toFixed(
                    2
                  )}%`}
                />

                <Metric
                  label="Runoff Volume"
                  value={`${runoffSummary.totalRunoffVolumeM3.toFixed(
                    2
                  )} m³`}
                />

              </div>

              {/* ==================================================
                  RADAR DOMAIN
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Original Radar Domain
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="Grid"
                    value={`${result.radarRainfall.width} × ${result.radarRainfall.height}`}
                  />

                  <Info
                    label="Longitude"
                    value={`${result.radarRainfall.minLon.toFixed(
                      3
                    )} – ${result.radarRainfall.maxLon.toFixed(
                      3
                    )}`}
                  />

                  <Info
                    label="Latitude"
                    value={`${result.radarRainfall.minLat.toFixed(
                      3
                    )} – ${result.radarRainfall.maxLat.toFixed(
                      3
                    )}`}
                  />

                  <Info
                    label="Source"
                    value="IMD Chennai"
                  />

                </div>

              </section>

              {/* ==================================================
                  CITY DOMAIN
              ================================================== */}

              <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

                <div className="flex items-center justify-between">

                  <div>

                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">
                      Digital Twin Rainfall
                    </div>

                    <div className="mt-1 text-sm font-semibold">
                      Exact Chennai Model Area
                    </div>

                  </div>

                  <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold text-cyan-300">
                    {result.cityRainfall.width} ×{" "}
                    {result.cityRainfall.height}
                  </div>

                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="Longitude"
                    value={`${result.cityRainfall.minLon.toFixed(
                      6
                    )} – ${result.cityRainfall.maxLon.toFixed(
                      6
                    )}`}
                  />

                  <Info
                    label="Latitude"
                    value={`${result.cityRainfall.minLat.toFixed(
                      6
                    )} – ${result.cityRainfall.maxLat.toFixed(
                      6
                    )}`}
                  />

                  <Info
                    label="Maximum Rainfall"
                    value={`${cityRainfallSummary.maximumRainfallMmHr.toFixed(
                      1
                    )} mm/hr`}
                  />

                  <Info
                    label="Rain Cells"
                    value={`${cityRainfallSummary.nonZeroPercentage.toFixed(
                      2
                    )}%`}
                  />

                </div>

              </section>

              {/* ==================================================
                  RUNOFF RESULT
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  City Runoff Result
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
                    label="Runoff Depth"
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
                  SAMPLE CELLS
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Sample City Runoff Cells
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">

                  {getSampleCells(
                    result.runoff
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
                          Rain{" "}
                          {cell.rainfallMm.toFixed(
                            2
                          )} mm
                        </div>

                        <div className="mt-1 font-mono text-sm text-orange-300">
                          Runoff{" "}
                          {cell.runoffMm.toFixed(
                            2
                          )} mm
                        </div>

                        <div className="mt-1 text-[10px] text-white/35">
                          Volume{" "}
                          {cell.runoffVolumeM3.toFixed(
                            4
                          )} m³
                        </div>

                        <div className="mt-1 text-[10px] text-white/30">
                          Coefficient{" "}
                          {cell.runoffCoefficient.toFixed(
                            2
                          )}
                        </div>

                      </div>
                    )
                  )}

                </div>

              </section>

              {/* ==================================================
                  MODEL PIPELINE
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Current Pipeline
                </div>

                <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center">

                  <PipelineStep text="IMD SRI" />

                  <Arrow />

                  <PipelineStep text="Radar Grid" />

                  <Arrow />

                  <PipelineStep text="City Grid" />

                  <Arrow />

                  <PipelineStep text="Runoff" />

                </div>

                <div className="mt-5 text-xs leading-5 text-white/40">
                  The next stage will take this city runoff
                  grid and route the water across the DEM
                  toward the drainage network.
                </div>

              </section>

            </div>
          )}

      </div>

    </main>
  );
}

/* ================================================================
   SAMPLE CELLS
================================================================ */

function getSampleCells(
  grid: RunoffGrid
): RunoffCell[] {
  const result: RunoffCell[] =
    [];

  const total =
    grid.cells.length;

  if (total === 0) {
    return result;
  }

  const positions: number[] = [
    0,
    Math.floor(total * 0.2),
    Math.floor(total * 0.4),
    Math.floor(total * 0.6),
    Math.floor(total * 0.8),
  ];

  for (
    const position of positions
  ) {
    const index =
      Math.min(
        total - 1,
        Math.max(
          0,
          position
        )
      );

    const cell =
      grid.cells[index];

    if (cell) {
      result.push(
        cell
      );
    }
  }

  return result;
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
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center">

      <div className="text-xs font-semibold text-white/75">
        {text}
      </div>

    </div>
  );
}

/* ================================================================
   ARROW
================================================================ */

function Arrow() {
  return (
    <div className="hidden text-white/20 md:block">
      →
    </div>
  );
}