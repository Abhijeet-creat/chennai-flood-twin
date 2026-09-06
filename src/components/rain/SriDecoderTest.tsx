"use client";

import { useEffect, useState } from "react";

import {
  decodeChennaiSRI,
  summarizeSRIGrid,
} from "@/lib/rain/sriDecoder";

import type { RainfallGrid } from "@/lib/rain/radar";

type DecoderResult = {
  grid: RainfallGrid;
  summary: ReturnType<typeof summarizeSRIGrid>;
};

export default function SriDecoderTest() {
  const [result, setResult] =
    useState<DecoderResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const runDecoder = async () => {
    setLoading(true);
    setError(null);

    try {
      const grid = await decodeChennaiSRI(
        "/radar/chennai-sri.jpg",
        {
          /*
           * Temporary geographic bounds for decoder testing.
           * We will replace these with proper radar
           * georeferencing when the live radar grid is connected.
           */
          minLon: 80.0,
          maxLon: 81.0,
          minLat: 12.0,
          maxLat: 14.0,

          /*
           * Exclude the lower/right product whitespace
           * from the rainfall decoding region.
           */
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

      setResult({
        grid,
        summary: summarizeSRIGrid(grid),
      });
    } catch (decoderError) {
      setError(
        decoderError instanceof Error
          ? decoderError.message
          : "SRI decoder failed."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runDecoder();
  }, []);

  return (
    <main className="min-h-screen w-full overflow-y-auto bg-[#071522] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-7">

          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            SIH Rainfall Engine
          </div>

          <h1 className="mt-2 text-3xl font-semibold">
            Chennai SRI Decoder Test
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
            This test reads the real IMD Chennai
            Surface Rainfall Intensity product and
            converts its rainfall colour classes into
            quantitative rainfall values.
          </p>

        </div>

        {/* ======================================================
            ACTION
        ====================================================== */}

        <button
          type="button"
          onClick={() => void runDecoder()}
          disabled={loading}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Decoding..."
            : "Run SRI Decoder"}
        </button>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4">

            <div className="text-sm font-semibold text-red-300">
              Decoder Error
            </div>

            <div className="mt-2 text-xs leading-5 text-red-200/70">
              {error}
            </div>

          </div>
        )}

        {/* ======================================================
            RESULTS
        ====================================================== */}

        {result && (
          <div className="mt-6 space-y-5">

            {/* ==================================================
                SUMMARY
            ================================================== */}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

              <Metric
                label="Maximum Rainfall"
                value={`${result.summary.maximumRainfallMmHr.toFixed(
                  1
                )} mm/hr`}
              />

              <Metric
                label="Minimum Rainfall"
                value={`${result.summary.minimumRainfallMmHr.toFixed(
                  1
                )} mm/hr`}
              />

              <Metric
                label="Rain Cells"
                value={`${result.summary.nonZeroPercentage.toFixed(
                  1
                )}%`}
              />

              <Metric
                label="Grid"
                value={`${result.summary.width} × ${result.summary.height}`}
              />

            </div>

            {/* ==================================================
                STATUS
            ================================================== */}

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                Decoder Status
              </div>

              <div className="mt-2 flex items-center gap-2">

                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />

                <span className="text-sm font-semibold text-green-300">
                  Radar image decoded
                </span>

              </div>

              <div className="mt-3 max-w-3xl text-xs leading-5 text-white/45">
                The SRI colour bands are being converted
                into rainfall intensity values for the
                nowcasting pipeline.
              </div>

            </section>

            {/* ==================================================
                SOURCE IMAGE
            ================================================== */}

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

              <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-white/35">
                Source SRI Product
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-white p-2">

                <img
                  src="/radar/chennai-sri.jpg"
                  alt="IMD Chennai Surface Rainfall Intensity"
                  className="block h-auto w-full max-w-full object-contain"
                />

              </div>

            </section>

            {/* ==================================================
                DECODED SAMPLE
            ================================================== */}

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                Decoded Rainfall Sample
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">

                {Array.from(
                  { length: 50 },
                  (_, index) => {

                    const sourceX =
                      Math.min(
                        result.grid.width - 1,
                        Math.floor(
                          (index % 10) *
                            (
                              result.grid.width /
                              10
                            )
                        )
                      );

                    const sourceY =
                      Math.min(
                        result.grid.height - 1,
                        Math.floor(
                          Math.floor(
                            index / 10
                          ) *
                            (
                              result.grid.height /
                              5
                            )
                        )
                      );

                    const gridIndex =
                      sourceY *
                        result.grid.width +
                      sourceX;

                    const rainfall =
                      result.grid.values[
                        gridIndex
                      ] ?? 0;

                    return (
                      <div
                        key={index}
                        className="flex aspect-square items-center justify-center rounded-lg border border-white/5 bg-black/25 font-mono text-[10px] text-cyan-200"
                        title={`${rainfall.toFixed(
                          1
                        )} mm/hr`}
                      >
                        {rainfall.toFixed(
                          1
                        )}
                      </div>
                    );
                  }
                )}

              </div>

              <div className="mt-4 text-[10px] leading-5 text-white/30">
                Diagnostic values only. These will later
                be replaced by the properly georeferenced
                rainfall grid from the live radar feed.
              </div>

            </section>

            {/* ==================================================
                RADAR INFORMATION
            ================================================== */}

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">

              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                Radar Product Information
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">

                <Info
                  label="Source"
                  value="IMD Chennai DWR"
                />

                <Info
                  label="Product"
                  value="Surface Rainfall Intensity"
                />

                <Info
                  label="Resolution"
                  value="0.400 km/pixel"
                />

                <Info
                  label="Radar Range"
                  value="120 km"
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
    <div className="rounded-xl bg-black/15 p-3">

      <div className="text-[10px] uppercase tracking-wider text-white/30">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-white/75">
        {value}
      </div>

    </div>
  );
}