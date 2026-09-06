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

const IMAGE_URL =
  "/radar/chennai-sri.jpg";

const CROP_RIGHT = 0.74;
const CROP_BOTTOM = 0.96;

/* ================================================================
   RAINFALL COLORS
================================================================ */

function rainfallColor(
  rainfall: number
): [number, number, number, number] {
  if (rainfall <= 0) {
    return [0, 0, 0, 0];
  }

  if (rainfall <= 0.1) {
    return [20, 50, 180, 110];
  }

  if (rainfall <= 0.2) {
    return [20, 100, 220, 120];
  }

  if (rainfall <= 0.4) {
    return [20, 155, 235, 125];
  }

  if (rainfall <= 0.8) {
    return [70, 195, 240, 135];
  }

  if (rainfall <= 1.6) {
    return [130, 225, 245, 145];
  }

  if (rainfall <= 3.2) {
    return [245, 245, 220, 150];
  }

  if (rainfall <= 6.3) {
    return [255, 230, 20, 165];
  }

  if (rainfall <= 12.6) {
    return [255, 160, 0, 175];
  }

  if (rainfall <= 25.1) {
    return [245, 70, 20, 185];
  }

  if (rainfall <= 50.1) {
    return [220, 20, 10, 195];
  }

  return [150, 0, 0, 210];
}

/* ================================================================
   COMPONENT
================================================================ */

export default function SriRainfallOverlayTest() {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const [
    grid,
    setGrid,
  ] = useState<RainfallGrid | null>(
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
    opacity,
    setOpacity,
  ] = useState(0.55);

  /* ==============================================================
     DECODE
  ============================================================== */

  const decode = async () => {
    setLoading(true);
    setError(null);

    try {
      const result =
        await decodeChennaiSRI(
          IMAGE_URL,
          {
            minLon: 80.0,
            maxLon: 81.0,

            minLat: 12.0,
            maxLat: 14.0,

            cropLeft: 0,
            cropTop: 0,

            cropRight: CROP_RIGHT,
            cropBottom: CROP_BOTTOM,

            outputWidth: 300,
            outputHeight: 300,

            observedAt:
              new Date().toISOString(),
          }
        );

      setGrid(result);
    } catch (decoderError) {
      setError(
        decoderError instanceof Error
          ? decoderError.message
          : "Unable to decode SRI image."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==============================================================
     INITIAL LOAD
  ============================================================== */

  useEffect(() => {
    void decode();
  }, []);

  /* ==============================================================
     DRAW TRANSPARENT OVERLAY
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

    const image =
      new Image();

    image.src =
      IMAGE_URL;

    image.onload = () => {
      /*
       * Canvas uses the exact natural dimensions of
       * the displayed image.
       */
      const width =
        image.naturalWidth;

      const height =
        image.naturalHeight;

      if (
        width <= 0 ||
        height <= 0
      ) {
        return;
      }

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      canvas.width =
        width;

      canvas.height =
        height;

      /*
       * VERY IMPORTANT:
       *
       * Do NOT draw the source image into the canvas.
       *
       * The source image is already displayed underneath.
       *
       * The canvas contains ONLY the transparent
       * decoded-rainfall overlay.
       */
      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      /*
       * Only the radar plotting area receives decoded
       * rainfall. The legend/metadata on the right stays
       * completely untouched.
       */
      const plotWidth =
        width * CROP_RIGHT;

      const plotHeight =
        height * CROP_BOTTOM;

      const cellWidth =
        plotWidth /
        grid.width;

      const cellHeight =
        plotHeight /
        grid.height;

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
          const rainfall =
            grid.values[
              y *
                grid.width +
              x
            ] ?? 0;

          if (
            rainfall <= 0
          ) {
            continue;
          }

          const [
            r,
            g,
            b,
            alpha,
          ] =
            rainfallColor(
              rainfall
            );

          ctx.fillStyle =
            `rgba(${r},${g},${b},${
              (alpha / 255) *
              opacity
            })`;

          ctx.fillRect(
            x * cellWidth,
            y * cellHeight,
            Math.ceil(
              cellWidth + 1
            ),
            Math.ceil(
              cellHeight + 1
            )
          );
        }
      }
    };

    image.onerror = () => {
      setError(
        "Unable to load the SRI image."
      );
    };
  }, [
    grid,
    opacity,
  ]);

  /* ==============================================================
     UI
  ============================================================== */

  return (
    <main className="min-h-screen w-full overflow-y-auto bg-[#071522] px-6 py-8 text-white">

      <div className="mx-auto w-full max-w-6xl">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-6">

          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            SIH Rainfall Engine
          </div>

          <h1 className="mt-2 text-3xl font-semibold">
            SRI Rainfall Overlay Test
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
            Original IMD Chennai Surface Rainfall
            Intensity product with the decoded
            rainfall field overlaid.
          </p>

        </div>

        {/* ======================================================
            CONTROLS
        ====================================================== */}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <button
              type="button"
              onClick={() =>
                void decode()
              }
              disabled={loading}
              className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Decoding..."
                : "Decode Again"}
            </button>

            <div className="flex items-center gap-4">

              <span className="text-xs text-white/45">
                Overlay opacity
              </span>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(event) =>
                  setOpacity(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="w-48 accent-cyan-400"
              />

              <span className="w-12 font-mono text-xs text-cyan-300">
                {Math.round(
                  opacity * 100
                )}
                %
              </span>

            </div>

          </div>

        </div>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4">

            <div className="text-sm font-semibold text-red-300">
              Overlay Error
            </div>

            <div className="mt-2 text-xs leading-5 text-red-200/65">
              {error}
            </div>

          </div>
        )}

        {/* ======================================================
            RADAR COMPARISON
        ====================================================== */}

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">

          <div className="mb-4 flex items-center justify-between">

            <div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                Radar comparison
              </div>

              <div className="mt-1 text-sm font-semibold">
                IMD SRI + Decoded Rainfall
              </div>

            </div>

            {grid && (
              <div className="rounded-full bg-green-400/10 px-3 py-1 text-[10px] font-semibold text-green-300">
                {grid.width} ×{" "}
                {grid.height}
              </div>
            )}

          </div>

          {/* ====================================================
              IMAGE + TRANSPARENT OVERLAY

              The IMG controls the size.

              The canvas is absolute and transparent.

              Therefore the canvas can NEVER create extra
              black/white space.
          ==================================================== */}

<div className="overflow-hidden rounded-xl border border-white/10 bg-transparent">

  <div className="relative w-full">

    <img
      src={IMAGE_URL}
      alt="IMD Chennai Surface Rainfall Intensity"
      className="block h-auto w-full max-w-full object-contain"
    />

    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />

  </div>

</div>

        </section>

        {/* ======================================================
            LEGEND
        ====================================================== */}

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">

          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
            Decoded rainfall scale
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11">

            {[
              0.1,
              0.2,
              0.4,
              0.8,
              1.6,
              3.2,
              6.3,
              12.6,
              25.1,
              50.1,
              100,
            ].map(
              (value) => {

                const [
                  r,
                  g,
                  b,
                ] =
                  rainfallColor(
                    value
                  );

                return (
                  <div
                    key={value}
                    className="overflow-hidden rounded-lg border border-white/10"
                  >

                    <div
                      className="h-8"
                      style={{
                        backgroundColor:
                          `rgb(${r},${g},${b})`,
                      }}
                    />

                    <div className="bg-black/20 px-2 py-1 text-center font-mono text-[9px] text-white/60">
                      {value} mm/hr
                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>

      </div>

    </main>
  );
}