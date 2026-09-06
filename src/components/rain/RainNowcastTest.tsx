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
  createRainfallNowcast,
  getNowcastFrame,
  getNowcastSummary,
  type RadarFrame,
  type RainfallNowcast,
} from "@/lib/rain/nowcast";

/* ================================================================
   REAL IMD FILES
================================================================ */

const PREVIOUS_IMAGE =
  "/radar/chennai-sri-previous.jpg";

const CURRENT_IMAGE =
  "/radar/chennai-sri.jpg";

/* ================================================================
   REAL OBSERVATION TIMES
================================================================ */

/*
 * These timestamps correspond to the timestamps printed
 * on the actual IMD Chennai SRI images.
 *
 * Chennai uses IST = UTC+05:30.
 *
 * Previous:
 *   02:54 / 27-Aug-2026
 *
 * Current:
 *   05:53 / 27-Aug-2026
 */

const PREVIOUS_OBSERVED_AT =
  "2026-08-27T02:54:00+05:30";

const CURRENT_OBSERVED_AT =
  "2026-08-27T05:53:00+05:30";

/* ================================================================
   COMPONENT
================================================================ */

export default function RainNowcastTest() {
  const [
    nowcast,
    setNowcast,
  ] = useState<RainfallNowcast | null>(
    null
  );

  const [
    previousGrid,
    setPreviousGrid,
  ] =
    useState<RainfallGrid | null>(
      null
    );

  const [
    currentGrid,
    setCurrentGrid,
  ] =
    useState<RainfallGrid | null>(
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

  const [
    selectedLead,
    setSelectedLead,
  ] = useState(30);

  /* ==============================================================
     DECODE ONE REAL IMD FRAME
  ============================================================== */

  async function decodeFrame(
    imageUrl: string,
    observedAt: string
  ): Promise<RainfallGrid> {
    return decodeChennaiSRI(
      imageUrl,
      {
        /*
         * Radar geographic domain.
         */
        minLon: 80.0,
        maxLon: 81.0,

        minLat: 12.0,
        maxLat: 14.0,

        /*
         * Remove the right-side legend/metadata area.
         */
        cropLeft: 0,
        cropTop: 0,
        cropRight: 0.74,
        cropBottom: 0.96,

        /*
         * Both frames MUST have the same grid dimensions.
         */
        outputWidth: 300,
        outputHeight: 300,

        /*
         * IMPORTANT:
         * This is the ACTUAL observation time of the image.
         */
        observedAt,
      }
    );
  }

  /* ==============================================================
     RUN REAL NOWCAST
  ============================================================== */

  async function runNowcast() {
    setLoading(true);
    setError(null);

    try {
      /* ==========================================================
         1. DECODE PREVIOUS FRAME
      ========================================================== */

      const previous =
        await decodeFrame(
          PREVIOUS_IMAGE,
          PREVIOUS_OBSERVED_AT
        );

      /* ==========================================================
         2. DECODE CURRENT FRAME
      ========================================================== */

      const current =
        await decodeFrame(
          CURRENT_IMAGE,
          CURRENT_OBSERVED_AT
        );

      setPreviousGrid(
        previous
      );

      setCurrentGrid(
        current
      );

      /* ==========================================================
         3. CREATE RADAR FRAME OBJECTS
      ========================================================== */

      const previousFrame:
        RadarFrame = {
        grid: previous,

        /*
         * Actual IMD timestamp.
         */
        observedAt:
          PREVIOUS_OBSERVED_AT,
      };

      const currentFrame:
        RadarFrame = {
        grid: current,

        /*
         * Actual IMD timestamp.
         */
        observedAt:
          CURRENT_OBSERVED_AT,
      };

      /* ==========================================================
         4. GENERATE 0–3 HOUR NOWCAST
      ========================================================== */

      const forecast =
        createRainfallNowcast(
          previousFrame,
          currentFrame
        );

      /* ==========================================================
         5. HANDLE ENGINE VALIDATION ERRORS
      ========================================================== */

      if (
        forecast.errors.length >
        0
      ) {
        throw new Error(
          forecast.errors.join(
            " "
          )
        );
      }

      setNowcast(
        forecast
      );
    } catch (
      nowcastError
    ) {
      setNowcast(
        null
      );

      setError(
        nowcastError instanceof
          Error
          ? nowcastError.message
          : "Unable to generate rainfall nowcast."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==============================================================
     INITIAL RUN
  ============================================================== */

  useEffect(() => {
    void runNowcast();
  }, []);

  /* ==============================================================
     SUMMARY
  ============================================================== */

  const summary =
    nowcast
      ? getNowcastSummary(
          nowcast
        )
      : null;

  const selectedFrame =
    nowcast
      ? getNowcastFrame(
          nowcast,
          selectedLead
        )
      : null;

  /* ==============================================================
     FRAME INTERVAL
  ============================================================== */

  const frameIntervalMinutes =
    Math.round(
      (
        Date.parse(
          CURRENT_OBSERVED_AT
        ) -
        Date.parse(
          PREVIOUS_OBSERVED_AT
        )
      ) /
        60000
    );

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
            0–3 Hour Rainfall Nowcast
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
            Real IMD Chennai SRI observations are used
            to estimate rainfall movement and generate
            a forward rainfall nowcast.
          </p>

        </div>

        {/* ======================================================
            ACTION
        ====================================================== */}

        <button
          type="button"
          onClick={() =>
            void runNowcast()
          }
          disabled={loading}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Generating Nowcast..."
            : "Generate Nowcast"}
        </button>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <section className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-5">

            <div className="text-sm font-semibold text-red-300">
              Nowcast Error
            </div>

            <div className="mt-2 text-xs leading-5 text-red-200/70">
              {error}
            </div>

            <div className="mt-4 rounded-xl bg-black/20 p-3 font-mono text-xs leading-6 text-white/45">
              Previous:
              <br />
              {PREVIOUS_IMAGE}
              <br />
              {PREVIOUS_OBSERVED_AT}
              <br />
              <br />
              Current:
              <br />
              {CURRENT_IMAGE}
              <br />
              {CURRENT_OBSERVED_AT}
            </div>

          </section>
        )}

        {/* ======================================================
            RESULTS
        ====================================================== */}

        {nowcast &&
          summary && (
            <div className="mt-6 space-y-5">

              {/* ==================================================
                  MAIN SUMMARY
              ================================================== */}

              <section className="grid grid-cols-2 gap-3 md:grid-cols-4">

                <Metric
                  label="Maximum Forecast Rain"
                  value={`${summary.maxRainfallMmPerHour.toFixed(
                    1
                  )} mm/hr`}
                />

                <Metric
                  label="Radar Interval"
                  value={`${frameIntervalMinutes} min`}
                />

                <Metric
                  label="Confidence"
                  value={`${summary.confidencePercent}%`}
                />

                <Metric
                  label="Forecast Frames"
                  value={`${nowcast.frames.length}`}
                />

              </section>

              {/* ==================================================
                  REAL INPUTS
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Real IMD Radar Inputs
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">

                  <InputCard
                    title="Previous Observation"
                    time={PREVIOUS_OBSERVED_AT}
                    file={PREVIOUS_IMAGE}
                    grid={previousGrid}
                  />

                  <InputCard
                    title="Current Observation"
                    time={CURRENT_OBSERVED_AT}
                    file={CURRENT_IMAGE}
                    grid={currentGrid}
                  />

                </div>

              </section>

              {/* ==================================================
                  MOTION
              ================================================== */}

              <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">
                  Estimated Rainfall Motion
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="X Velocity"
                    value={`${nowcast.motion.xCellsPerMinute.toFixed(
                      5
                    )} cells/min`}
                  />

                  <Info
                    label="Y Velocity"
                    value={`${nowcast.motion.yCellsPerMinute.toFixed(
                      5
                    )} cells/min`}
                  />

                  <Info
                    label="Speed"
                    value={`${nowcast.motion.speedCellsPerMinute.toFixed(
                      5
                    )} cells/min`}
                  />

                  <Info
                    label="Confidence"
                    value={`${Math.round(
                      nowcast.confidence *
                        100
                    )}%`}
                  />

                </div>

              </section>

              {/* ==================================================
                  FORECAST TIMELINE
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                  <div>

                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                      Forecast Timeline
                    </div>

                    <div className="mt-1 text-lg font-semibold">
                      +{selectedLead} minutes
                    </div>

                  </div>

                  {selectedFrame && (
                    <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] text-cyan-300">
                      Forecast confidence{" "}
                      {Math.round(
                        selectedFrame.confidence *
                          100
                      )}
                      %
                    </div>
                  )}

                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">

                  {[
                    30,
                    60,
                    90,
                    120,
                    150,
                    180,
                  ].map(
                    (
                      lead
                    ) => {
                      const frame =
                        getNowcastFrame(
                          nowcast,
                          lead
                        );

                      return (
                        <button
                          key={lead}
                          type="button"
                          onClick={() =>
                            setSelectedLead(
                              lead
                            )
                          }
                          disabled={
                            !frame
                          }
                          className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                            selectedLead ===
                            lead
                              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
                              : "border-white/10 bg-black/20 text-white/45 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          +{lead}m
                        </button>
                      );
                    }
                  )}

                </div>

              </section>

              {/* ==================================================
                  SELECTED FORECAST
              ================================================== */}

              {selectedFrame && (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                    Selected Forecast Frame
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                    <Info
                      label="Lead Time"
                      value={`${selectedFrame.leadMinutes} minutes`}
                    />

                    <Info
                      label="Valid At"
                      value={formatDate(
                        selectedFrame.validAt
                      )}
                    />

                    <Info
                      label="Velocity X"
                      value={`${selectedFrame.velocityX.toFixed(
                        5
                      )}`}
                    />

                    <Info
                      label="Velocity Y"
                      value={`${selectedFrame.velocityY.toFixed(
                        5
                      )}`}
                    />

                  </div>

                </section>
              )}

              {/* ==================================================
                  FORECAST TABLE
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  0–3 Hour Forecast
                </div>

                <div className="mt-4 overflow-x-auto">

                  <table className="w-full min-w-[600px] border-collapse text-left">

                    <thead>

                      <tr className="border-b border-white/10">

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Lead
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Valid Time
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Confidence
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Motion X
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Motion Y
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {nowcast.frames.map(
                        (
                          frame
                        ) => (
                          <tr
                            key={
                              frame.leadMinutes
                            }
                            className="border-b border-white/5"
                          >

                            <td className="px-3 py-3 font-mono text-sm text-cyan-300">
                              +{" "}
                              {
                                frame.leadMinutes
                              }
                              m
                            </td>

                            <td className="px-3 py-3 text-xs text-white/55">
                              {formatDate(
                                frame.validAt
                              )}
                            </td>

                            <td className="px-3 py-3 text-xs text-white/55">
                              {Math.round(
                                frame.confidence *
                                  100
                              )}
                              %
                            </td>

                            <td className="px-3 py-3 font-mono text-xs text-white/45">
                              {frame.velocityX.toFixed(
                                5
                              )}
                            </td>

                            <td className="px-3 py-3 font-mono text-xs text-white/45">
                              {frame.velocityY.toFixed(
                                5
                              )}
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </section>

              {/* ==================================================
                  NEXT PIPELINE
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Next SIH Pipeline Stage
                </div>

                <div className="mt-5 grid gap-2 md:grid-cols-5">

                  <Pipeline
                    number="01"
                    text="IMD Radar"
                  />

                  <Pipeline
                    number="02"
                    text="Nowcast"
                  />

                  <Pipeline
                    number="03"
                    text="City Rainfall"
                  />

                  <Pipeline
                    number="04"
                    text="Runoff"
                  />

                  <Pipeline
                    number="05"
                    text="Flood Depth"
                  />

                </div>

              </section>

            </div>
          )}

      </div>

    </main>
  );
}

/* ================================================================
   INPUT CARD
================================================================ */

function InputCard({
  title,
  time,
  file,
  grid,
}: {
  title: string;
  time: string;
  file: string;
  grid: RainfallGrid | null;
}) {
  return (
    <div className="rounded-xl bg-black/20 p-4">

      <div className="text-sm font-semibold text-white/75">
        {title}
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-wider text-white/30">
        Observation Time
      </div>

      <div className="mt-1 font-mono text-sm text-cyan-300">
        {formatDate(time)}
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-wider text-white/30">
        Source File
      </div>

      <div className="mt-1 break-all font-mono text-xs text-white/45">
        {file}
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-wider text-white/30">
        Decoded Grid
      </div>

      <div className="mt-1 text-sm text-white/65">
        {grid
          ? `${grid.width} × ${grid.height}`
          : "—"}
      </div>

    </div>
  );
}

/* ================================================================
   DATE FORMAT
================================================================ */

function formatDate(
  value: string
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone:
        "Asia/Kolkata",
    }
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

      <div className="mt-1 break-all text-sm text-white/75">
        {value}
      </div>

    </div>
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
   PIPELINE
================================================================ */

function Pipeline({
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

      <div className="mt-2 text-xs font-semibold text-white/70">
        {text}
      </div>

    </div>
  );
}