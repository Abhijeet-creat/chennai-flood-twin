"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  decodeChennaiSRI,
} from "@/lib/rain/sriDecoder";

import type {
  RainfallGrid,
} from "@/lib/rain/radar";

/* ================================================================
   COMPONENT
================================================================ */

export default function SriDecodedMapTest() {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const [
    grid,
    setGrid,
  ] =
    useState<RainfallGrid | null>(
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

  /* ==============================================================
     LOAD
  ============================================================== */

  const runDecoder =
    async () => {
      setLoading(true);
      setError(null);

      try {
        const decoded =
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

        setGrid(decoded);
      } catch (decoderError) {
        setError(
          decoderError instanceof
            Error
            ? decoderError.message
            : "Decoder failed."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void runDecoder();
  }, []);

  /* ==============================================================
     DRAW DECODED GRID
  ============================================================== */

  useEffect(() => {
    if (!grid) {
      return;
    }

    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.width =
      grid.width;

    canvas.height =
      grid.height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    const imageData =
      context.createImageData(
        grid.width,
        grid.height
      );

    const pixels =
      imageData.data;

    for (
      let y = 0;
      y < grid.height;
      y++
    ) {
      for (
        let x = 0;
        x < grid.width;
        x++
      ) {
        const value =
          grid.values[
            y *
              grid.width +
            x
          ] ?? 0;

        const index =
          (
            y *
              grid.width +
            x
          ) *
          4;

        /*
         * No rainfall = transparent/black.
         */
        if (
          value <= 0
        ) {
          pixels[index] =
            5;

          pixels[
            index + 1
          ] = 10;

          pixels[
            index + 2
          ] = 18;

          pixels[
            index + 3
          ] = 255;

          continue;
        }

        let r = 0;
        let g = 0;
        let b = 0;

        /*
         * IMD warm SRI colours.
         */
        if (
          value >= 100
        ) {
          r = 130;
          g = 0;
          b = 0;
        } else if (
          value >= 50.1
        ) {
          r = 220;
          g = 15;
          b = 10;
        } else if (
          value >= 25.1
        ) {
          r = 255;
          g = 65;
          b = 10;
        } else if (
          value >= 12.6
        ) {
          r = 255;
          g = 145;
          b = 0;
        } else {
          r = 255;
          g = 225;
          b = 0;
        }

        pixels[index] =
          r;

        pixels[
          index + 1
        ] = g;

        pixels[
          index + 2
        ] = b;

        pixels[
          index + 3
        ] = 255;
      }
    }

    context.putImageData(
      imageData,
      0,
      0
    );
  }, [
    grid,
  ]);

  /* ==============================================================
     STATISTICS
  ============================================================== */

  let rainfallCells = 0;
  let maximum = 0;

  if (grid) {
    for (
      const value of
        grid.values
    ) {
      if (
        value > 0
      ) {
        rainfallCells++;
      }

      if (
        value >
        maximum
      ) {
        maximum =
          value;
      }
    }
  }

  const percentage =
    grid &&
    grid.values.length >
      0
      ? (
          rainfallCells /
          grid.values.length
        ) *
        100
      : 0;

  /* ==============================================================
     UI
  ============================================================== */

  return (
    <main className="min-h-screen overflow-y-auto bg-[#071522] p-8 text-white">

      <div className="mx-auto max-w-6xl">

        <div className="mb-6">

          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            SIH Rainfall Engine
          </div>

          <h1 className="mt-2 text-3xl font-semibold">
            Decoded Rainfall Map
          </h1>

          <p className="mt-2 text-sm text-white/50">
            This view shows ONLY what the SRI decoder
            thinks is rainfall.
          </p>

        </div>

        <button
          type="button"
          onClick={() =>
            void runDecoder()
          }
          disabled={loading}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading
            ? "Decoding..."
            : "Decode Again"}
        </button>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3">

          <Stat
            label="Maximum"
            value={`${maximum.toFixed(
              1
            )} mm/hr`}
          />

          <Stat
            label="Rain Cells"
            value={`${percentage.toFixed(
              2
            )}%`}
          />

          <Stat
            label="Grid"
            value={
              grid
                ? `${grid.width} × ${grid.height}`
                : "—"
            }
          />

        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">

          <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-white/35">
            Decoded rainfall only
          </div>

          <div className="overflow-auto rounded-xl border border-white/10 bg-black p-4">

            <canvas
              ref={canvasRef}
              className="block h-auto w-full max-w-full"
            />

          </div>

        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">

          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
            Interpretation
          </div>

          <div className="mt-3 text-sm leading-6 text-white/55">

            <p>
              Dark background means no rainfall was
              classified.
            </p>

            <p className="mt-2">
              Yellow, orange and red regions are
              the rainfall cells detected from the
              current IMD SRI screenshot.
            </p>

            <p className="mt-2">
              This diagnostic view must visually
              match the precipitation patches in
              the original SRI product before we
              use the values in the 3D flood model.
            </p>

          </div>

        </section>

      </div>

    </main>
  );
}

/* ================================================================
   STAT
================================================================ */

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-4">

      <div className="text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </div>

      <div className="mt-2 font-mono text-lg text-cyan-300">
        {value}
      </div>

    </div>
  );
}