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
  createCityRainfallGrid,
  getCityRainfallStats,
} from "@/lib/rain/cityRainfall";

/* ================================================================
   RADAR DOMAIN
================================================================ */

const RADAR_MIN_LON = 80.0;
const RADAR_MAX_LON = 81.0;

const RADAR_MIN_LAT = 12.0;
const RADAR_MAX_LAT = 14.0;

/* ================================================================
   CITY DOMAIN
================================================================ */

const CITY_MIN_LON = 80.210972;
const CITY_MAX_LON = 80.229028;

const CITY_MIN_LAT = 12.970972;
const CITY_MAX_LAT = 12.989028;

/* ================================================================
   COMPONENT
================================================================ */

export default function RainCityOverlapTest() {
  const [radar, setRadar] =
    useState<RainfallGrid | null>(
      null
    );

  const [city, setCity] =
    useState<RainfallGrid | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  /* ==============================================================
     RUN
  ============================================================== */

  async function runTest() {
    setLoading(true);
    setError(null);

    try {
      const decoded =
        await decodeChennaiSRI(
          "/radar/chennai-sri.jpg",
          {
            minLon:
              RADAR_MIN_LON,

            maxLon:
              RADAR_MAX_LON,

            minLat:
              RADAR_MIN_LAT,

            maxLat:
              RADAR_MAX_LAT,

            cropLeft: 0,
            cropTop: 0,

            cropRight: 0.74,
            cropBottom: 0.96,

            outputWidth: 300,
            outputHeight: 300,

            observedAt:
              "2026-08-27T05:53:00+05:30",
          }
        );

      const cityGrid =
        createCityRainfallGrid(
          decoded,
          {
            width: 120,
            height: 120,
          }
        );

      setRadar(decoded);
      setCity(cityGrid);
    } catch (
      testError
    ) {
      setError(
        testError instanceof
          Error
          ? testError.message
          : "Rainfall overlap test failed."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runTest();
  }, []);

  const radarStats =
    radar
      ? getStats(radar)
      : null;

  const cityStats =
    city
      ? getCityRainfallStats(
          city
        )
      : null;

  return (
    <main className="min-h-screen overflow-y-auto bg-[#071522] p-8 text-white">

      <div className="mx-auto max-w-6xl">

        <div className="mb-7">

          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            SIH Rainfall Diagnostic
          </div>

          <h1 className="mt-2 text-3xl font-semibold">
            Radar → City Overlap Test
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
            This page checks whether rainfall detected in
            the IMD radar grid actually intersects the
            Chennai Digital Twin geographic bounds.
          </p>

        </div>

        <button
          type="button"
          onClick={() =>
            void runTest()
          }
          disabled={loading}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading
            ? "Testing..."
            : "Run Overlap Test"}
        </button>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {radar &&
          city &&
          radarStats &&
          cityStats && (
            <div className="mt-6 space-y-5">

              {/* ==================================================
                  RADAR
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-wider text-white/30">
                  IMD Radar Grid
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">

                  <Metric
                    label="Grid"
                    value={`${radar.width} × ${radar.height}`}
                  />

                  <Metric
                    label="Longitude"
                    value={`${radar.minLon} – ${radar.maxLon}`}
                  />

                  <Metric
                    label="Latitude"
                    value={`${radar.minLat} – ${radar.maxLat}`}
                  />

                  <Metric
                    label="Max Rain"
                    value={`${radarStats.maximum.toFixed(1)} mm/hr`}
                  />

                  <Metric
                    label="Rain Cells"
                    value={`${radarStats.percentage.toFixed(2)}%`}
                  />

                </div>

              </section>

              {/* ==================================================
                  CITY
              ================================================== */}

              <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

                <div className="text-[10px] uppercase tracking-wider text-cyan-300/60">
                  Chennai Digital Twin
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">

                  <Metric
                    label="Grid"
                    value={`${city.width} × ${city.height}`}
                  />

                  <Metric
                    label="Longitude"
                    value={`${CITY_MIN_LON} – ${CITY_MAX_LON}`}
                  />

                  <Metric
                    label="Latitude"
                    value={`${CITY_MIN_LAT} – ${CITY_MAX_LAT}`}
                  />

                  <Metric
                    label="Max Rain"
                    value={`${cityStats.maximumRainfallMmHr.toFixed(1)} mm/hr`}
                  />

                  <Metric
                    label="Rain Cells"
                    value={`${cityStats.nonZeroPercentage.toFixed(2)}%`}
                  />

                </div>

              </section>

              {/* ==================================================
                  OVERLAP DIAGRAM
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-wider text-white/30">
                  Geographic Relationship
                </div>

                <div className="mt-5 rounded-xl bg-black/30 p-6">

                  <div className="relative mx-auto aspect-[1/2] max-w-md rounded-xl border border-cyan-400/30 bg-cyan-400/[0.03]">

                    <div className="absolute inset-3 rounded-lg border border-white/10">

                      <div className="absolute left-[20%] top-[47%] h-[8%] w-[12%] rounded border border-orange-400 bg-orange-400/20" />

                      <div className="absolute left-[20%] top-[47%] -translate-x-1/2 -translate-y-full whitespace-nowrap text-[9px] text-orange-300">
                        Your City Area
                      </div>

                    </div>

                    <div className="absolute left-3 top-3 text-[9px] text-white/30">
                      81°E
                    </div>

                    <div className="absolute bottom-3 left-3 text-[9px] text-white/30">
                      12°N
                    </div>

                    <div className="absolute bottom-3 right-3 text-[9px] text-white/30">
                      Radar domain
                    </div>

                  </div>

                </div>

                <p className="mt-4 text-xs leading-5 text-white/40">
                  The orange rectangle represents the small
                  digital-twin area inside the much larger
                  Chennai radar domain.
                </p>

              </section>

              {/* ==================================================
                  DIAGNOSIS
              ================================================== */}

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

                <div className="text-[10px] uppercase tracking-wider text-white/30">
                  Diagnosis
                </div>

                <div className="mt-4 rounded-xl bg-black/20 p-4">

                  {cityStats.maximumRainfallMmHr >
                    0 ? (
                    <div className="text-sm text-emerald-300">
                      ✅ Rainfall is reaching the
                      digital-twin area.
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-300">
                      ⚠️ No decoded rainfall cell
                      currently intersects the
                      digital-twin area.
                    </div>
                  )}

                  <div className="mt-3 text-xs leading-6 text-white/45">

                    Radar maximum:
                    {" "}
                    {radarStats.maximum.toFixed(
                      1
                    )}
                    {" "}
                    mm/hr

                    <br />

                    Radar affected cells:
                    {" "}
                    {radarStats.percentage.toFixed(
                      2
                    )}
                    %

                    <br />

                    City maximum:
                    {" "}
                    {cityStats.maximumRainfallMmHr.toFixed(
                      1
                    )}
                    {" "}
                    mm/hr

                    <br />

                    City affected cells:
                    {" "}
                    {cityStats.nonZeroPercentage.toFixed(
                      2
                    )}
                    %

                  </div>

                </div>

              </section>

            </div>
          )}

      </div>

    </main>
  );
}

/* ================================================================
   GRID STATS
================================================================ */

function getStats(
  grid: RainfallGrid
) {
  let maximum = 0;
  let nonZero = 0;

  for (
    const value of
      grid.values
  ) {
    if (
      value > maximum
    ) {
      maximum = value;
    }

    if (
      value > 0
    ) {
      nonZero++;
    }
  }

  return {
    maximum,

    percentage:
      grid.values.length >
      0
        ? (
            nonZero /
            grid.values.length
          ) *
          100
        : 0,
  };
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
    <div className="rounded-xl bg-black/20 p-3">

      <div className="text-[9px] uppercase tracking-wider text-white/30">
        {label}
      </div>

      <div className="mt-1 font-mono text-sm text-cyan-300">
        {value}
      </div>

    </div>
  );
}