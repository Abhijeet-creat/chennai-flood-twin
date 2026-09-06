"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  decodeChennaiSRI,
} from "@/lib/rain/sriDecoder";

import {
  createRainfallNowcast,
  getNowcastFrame,
  type RadarFrame,
  type RainfallNowcast,
} from "@/lib/rain/nowcast";

import {
  createCityRainfallForecast,
  getCityRainfallForecastSummary,
  type CityRainfallForecast,
} from "@/lib/rain/forecastCityRainfall";

/* ================================================================
   REAL IMD RADAR FILES
================================================================ */

const PREVIOUS_IMAGE =
  "/radar/chennai-sri-previous.jpg";

const CURRENT_IMAGE =
  "/radar/chennai-sri.jpg";

/* ================================================================
   REAL OBSERVATION TIMES
================================================================ */

const PREVIOUS_OBSERVED_AT =
  "2026-08-27T02:54:00+05:30";

const CURRENT_OBSERVED_AT =
  "2026-08-27T05:53:00+05:30";

/* ================================================================
   FORECAST STEPS
================================================================ */

const FORECAST_LEADS = [
  30,
  60,
  90,
  120,
  150,
  180,
] as const;

/* ================================================================
   MAIN COMPONENT
================================================================ */

export default function RainForecastCityTest() {
  const [
    nowcast,
    setNowcast,
  ] =
    useState<RainfallNowcast | null>(
      null
    );

  const [
    cityForecast,
    setCityForecast,
  ] =
    useState<CityRainfallForecast | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    selectedLead,
    setSelectedLead,
  ] =
    useState(30);

  /* ==============================================================
     DECODE ONE RADAR FRAME
  ============================================================== */

  async function decodeFrame(
    imageUrl: string,
    observedAt: string
  ) {
    return decodeChennaiSRI(
      imageUrl,
      {
        /*
         * Radar-domain coordinates.
         */
        minLon: 80.0,
        maxLon: 81.0,

        minLat: 12.0,
        maxLat: 14.0,

        /*
         * Remove legend / metadata area.
         */
        cropLeft: 0,
        cropTop: 0,
        cropRight: 0.74,
        cropBottom: 0.96,

        /*
         * Same source grid for both observations.
         */
        outputWidth: 300,
        outputHeight: 300,

        observedAt,
      }
    );
  }

  /* ==============================================================
     RUN COMPLETE FORECAST
  ============================================================== */

  async function runForecast() {
    setLoading(true);
    setError(null);

    try {
      /* ==========================================================
         1. PREVIOUS REAL IMD FRAME
      ========================================================== */

      const previous =
        await decodeFrame(
          PREVIOUS_IMAGE,
          PREVIOUS_OBSERVED_AT
        );

      /* ==========================================================
         2. CURRENT REAL IMD FRAME
      ========================================================== */

      const current =
        await decodeFrame(
          CURRENT_IMAGE,
          CURRENT_OBSERVED_AT
        );

      /* ==========================================================
         3. CREATE RADAR FRAMES
      ========================================================== */

      const previousFrame:
        RadarFrame = {
        grid: previous,
        observedAt:
          PREVIOUS_OBSERVED_AT,
      };

      const currentFrame:
        RadarFrame = {
        grid: current,
        observedAt:
          CURRENT_OBSERVED_AT,
      };

      /* ==========================================================
         4. CREATE 0–3 HOUR NOWCAST
      ========================================================== */

      const forecast =
        createRainfallNowcast(
          previousFrame,
          currentFrame
        );

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

      /* ==========================================================
         5. CONVERT EVERY NOWCAST FRAME TO CITY AREA
      ========================================================== */

      const city =
        createCityRainfallForecast(
          forecast,
          {
            width: 120,
            height: 120,
          }
        );

      setCityForecast(
        city
      );
    } catch (forecastError) {
      setNowcast(null);
      setCityForecast(null);

      setError(
        forecastError instanceof
          Error
          ? forecastError.message
          : "Unable to create city rainfall forecast."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==============================================================
     INITIAL RUN
  ============================================================== */

  useEffect(() => {
    void runForecast();
  }, []);

  /* ==============================================================
     SUMMARY
  ============================================================== */

  const summary =
    cityForecast
      ? getCityRainfallForecastSummary(
          cityForecast
        )
      : null;

  const selectedFrame =
    cityForecast
      ? cityForecast.frames.find(
          (frame) =>
            frame.leadMinutes ===
            selectedLead
        ) ?? null
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
            Forecast → Chennai City Rainfall
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
            The 0–3 hour IMD rainfall nowcast is
            converted from the radar domain into the
            exact Chennai Digital Twin area.
          </p>

        </div>

        {/* ======================================================
            ACTION
        ====================================================== */}

        <button
          type="button"
          onClick={() =>
            void runForecast()
          }
          disabled={loading}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Processing Forecast..."
            : "Run City Forecast"}
        </button>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <section className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-5">

            <div className="text-sm font-semibold text-red-300">
              Forecast Error
            </div>

            <div className="mt-2 text-xs leading-5 text-red-200/70">
              {error}
            </div>

          </section>
        )}

        {/* ======================================================
            RESULTS
        ====================================================== */}

        {cityForecast &&
          summary && (
            <div className="mt-6 space-y-5">

              {/* ==================================================
                  SUMMARY
              ================================================== */}

              <section className="grid grid-cols-2 gap-3 md:grid-cols-4">

                <Metric
                  label="Maximum City Rain"
                  value={`${summary.maximumForecastRainfallMmHr.toFixed(
                    1
                  )} mm/hr`}
                />

                <Metric
                  label="Peak Forecast"
                  value={`+${summary.maximumForecastLeadMinutes} min`}
                />

                <Metric
                  label="Average Affected"
                  value={`${summary.averageAffectedPercentage.toFixed(
                    2
                  )}%`}
                />

                <Metric
                  label="Confidence"
                  value={`${summary.confidencePercent}%`}
                />

              </section>

              {/* ==================================================
                  CITY DOMAIN
              ================================================== */}

              <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">
                  Digital Twin Rainfall Domain
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                  <Info
                    label="Grid"
                    value={`${cityForecast.frames[0]?.grid.width ?? 0} × ${
                      cityForecast.frames[0]?.grid.height ?? 0
                    }`}
                  />

                  <Info
                    label="Longitude"
                    value="80.210972 – 80.229028"
                  />

                  <Info
                    label="Latitude"
                    value="12.970972 – 12.989028"
                  />

                  <Info
                    label="Source"
                    value="IMD Chennai"
                  />

                </div>

              </section>

              {/* ==================================================
                  FORECAST TIMELINE
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  City Forecast Timeline
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">

                  {FORECAST_LEADS.map(
                    (lead) => {
                      const frame =
                        cityForecast.frames.find(
                          (
                            item
                          ) =>
                            item.leadMinutes ===
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
                          className={`rounded-xl border px-3 py-4 transition ${
                            selectedLead ===
                            lead
                              ? "border-cyan-400/50 bg-cyan-400/10"
                              : "border-white/10 bg-black/20 hover:bg-white/5"
                          }`}
                        >

                          <div className="text-sm font-semibold">
                            +{lead}m
                          </div>

                          <div className="mt-2 font-mono text-xs text-cyan-300">
                            {frame
                              ? `${frame.maximumRainfallMmHr.toFixed(
                                  1
                                )}`
                              : "0.0"}
                          </div>

                          <div className="mt-1 text-[9px] text-white/30">
                            mm/hr
                          </div>

                        </button>
                      );
                    }
                  )}

                </div>

              </section>

              {/* ==================================================
                  SELECTED FRAME
              ================================================== */}

              {selectedFrame && (
                <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

                  <div className="flex items-center justify-between">

                    <div>

                      <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">
                        Selected City Forecast
                      </div>

                      <div className="mt-1 text-lg font-semibold">
                        +{selectedFrame.leadMinutes} minutes
                      </div>

                    </div>

                    <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] text-cyan-300">
                      Confidence{" "}
                      {Math.round(
                        selectedFrame.confidence *
                          100
                      )}
                      %
                    </div>

                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">

                    <Info
                      label="Maximum Rain"
                      value={`${selectedFrame.maximumRainfallMmHr.toFixed(
                        2
                      )} mm/hr`}
                    />

                    <Info
                      label="Mean Rain"
                      value={`${selectedFrame.meanRainfallMmHr.toFixed(
                        2
                      )} mm/hr`}
                    />

                    <Info
                      label="Affected Area"
                      value={`${selectedFrame.affectedPercentage.toFixed(
                        2
                      )}%`}
                    />

                    <Info
                      label="Grid"
                      value={`${selectedFrame.grid.width} × ${selectedFrame.grid.height}`}
                    />

                  </div>

                </section>
              )}

              {/* ==================================================
                  TABLE
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  City Rainfall Forecast
                </div>

                <div className="mt-4 overflow-x-auto">

                  <table className="w-full min-w-[700px] border-collapse text-left">

                    <thead>

                      <tr className="border-b border-white/10">

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Lead
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Valid Time
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Max Rain
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Mean Rain
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Affected
                        </th>

                        <th className="px-3 py-3 text-[10px] uppercase tracking-wider text-white/30">
                          Confidence
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {cityForecast.frames.map(
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
                              +{
                                frame.leadMinutes
                              }m
                            </td>

                            <td className="px-3 py-3 text-xs text-white/55">
                              {formatDate(
                                frame.validAt
                              )}
                            </td>

                            <td className="px-3 py-3 font-mono text-xs text-white/65">
                              {frame.maximumRainfallMmHr.toFixed(
                                2
                              )}
                            </td>

                            <td className="px-3 py-3 font-mono text-xs text-white/65">
                              {frame.meanRainfallMmHr.toFixed(
                                2
                              )}
                            </td>

                            <td className="px-3 py-3 font-mono text-xs text-white/65">
                              {frame.affectedPercentage.toFixed(
                                2
                              )}
                              %
                            </td>

                            <td className="px-3 py-3 font-mono text-xs text-white/65">
                              {Math.round(
                                frame.confidence *
                                  100
                              )}
                              %
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </section>

              {/* ==================================================
                  NOWCAST -> CITY -> RUNOFF
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Next Model Connection
                </div>

                <div className="mt-5 grid gap-2 md:grid-cols-4">

                  <Pipeline
                    number="01"
                    text="0–3h Nowcast"
                  />

                  <Pipeline
                    number="02"
                    text="City Rainfall"
                  />

                  <Pipeline
                    number="03"
                    text="Runoff"
                  />

                  <Pipeline
                    number="04"
                    text="Surface Flow"
                  />

                </div>

                <p className="mt-5 text-xs leading-5 text-white/40">
                  The selected city forecast frame is now
                  ready to become the rainfall input for the
                  runoff model.
                </p>

              </section>

            </div>
          )}

        {/* ========================================================
            NOWCAST STATUS
        ======================================================== */}

        {nowcast && (
          <div className="mt-5 text-center text-[10px] text-white/25">
            Nowcast generated from the two real IMD Chennai
            radar observations.
          </div>
        )}

      </div>

    </main>
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

      <div className="mt-1 break-all text-sm text-white/75">
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