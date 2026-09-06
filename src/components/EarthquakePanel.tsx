"use client";

import type { EarthquakeOrigin } from "@/lib/earthquake";

type EarthquakePanelProps = {
  point: EarthquakeOrigin | null;
  active: boolean;
  magnitude: number;

  onSimulate: (magnitude: number) => void;
  onCancel: () => void;
  onReset: () => void;
};

export default function EarthquakePanel({
  point,
  active,
  magnitude,
  onSimulate,
  onCancel,
  onReset,
}: EarthquakePanelProps) {
  const canStart = point !== null && !active;

  return (
    <div className="absolute right-6 top-6 z-40 w-[360px] overflow-hidden rounded-2xl border border-orange-400/20 bg-[#050b12]/95 text-white shadow-2xl backdrop-blur-xl">

      {/* =========================================================
          HEADER
      ========================================================= */}

      <div className="border-b border-white/10 px-5 py-4">

        <div className="text-[10px] uppercase tracking-[0.22em] text-orange-300">
          Earthquake Simulation
        </div>

        <div className="mt-1 text-xl font-semibold">
          {active
            ? "Earthquake Active"
            : "Configure Earthquake"}
        </div>

      </div>

      {/* =========================================================
          EPICENTER
      ========================================================= */}

      <div className="p-5">

        <div className="text-xs uppercase tracking-wider text-white/40">
          Epicenter
        </div>

        {!point ? (
          <div className="mt-2 rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-400/15 text-lg">
                📍
              </div>

              <div>
                <div className="text-sm font-semibold text-orange-300">
                  Select a location
                </div>

                <div className="mt-1 text-xs leading-5 text-white/45">
                  Click anywhere on the city map to choose the earthquake epicenter.
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-orange-400/20 bg-orange-400/5 p-3">

            <div className="flex items-center justify-between">

              <span className="text-xs text-white/50">
                Epicenter selected
              </span>

              <span className="rounded-full bg-orange-400/10 px-2 py-1 text-[10px] font-semibold text-orange-300">
                READY
              </span>

            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">

              <div className="rounded-lg bg-black/20 p-2.5">

                <div className="text-[9px] uppercase tracking-wider text-white/30">
                  X
                </div>

                <div className="mt-1 font-mono text-sm text-orange-200">
                  {point.x.toFixed(2)}
                </div>

              </div>

              <div className="rounded-lg bg-black/20 p-2.5">

                <div className="text-[9px] uppercase tracking-wider text-white/30">
                  Z
                </div>

                <div className="mt-1 font-mono text-sm text-orange-200">
                  {point.z.toFixed(2)}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* =======================================================
            MAGNITUDE
        ======================================================= */}

        <div className="mt-6">

          <div className="flex items-center justify-between">

            <span className="text-sm text-white/60">
              Earthquake Magnitude
            </span>

            <span className="font-mono text-2xl font-semibold text-orange-300">
              M{magnitude.toFixed(1)}
            </span>

          </div>

          <input
            type="range"
            min="3"
            max="9"
            step="0.1"
            value={magnitude}
            disabled={active}
            onChange={(event) =>
              onSimulate(
                Number(event.target.value)
              )
            }
            className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="mt-2 flex justify-between text-[10px] text-white/30">
            <span>M3.0</span>
            <span>M6.0</span>
            <span>M9.0</span>
          </div>

        </div>

        {/* =======================================================
            MAGNITUDE DESCRIPTION
        ======================================================= */}

        <div className="mt-4 rounded-xl bg-white/[0.03] p-3">

          <div className="text-[10px] uppercase tracking-wider text-white/30">
            Expected impact
          </div>

          <div className="mt-1 text-xs leading-5 text-white/55">
            {magnitude < 4
              ? "Minor shaking. Most buildings should remain stable."
              : magnitude < 5
              ? "Light to moderate shaking. Some structures may experience minor damage."
              : magnitude < 6
              ? "Strong shaking. Vulnerable buildings may begin to deform."
              : magnitude < 7
              ? "Severe shaking. Significant structural damage is expected near the epicenter."
              : magnitude < 8
              ? "Major earthquake. Many vulnerable structures may partially collapse."
              : "Extreme earthquake. Severe structural destruction is possible across the affected area."}
          </div>

        </div>

        {/* =======================================================
            ACTIVE STATUS
        ======================================================= */}

        {active && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4">

            <div className="flex items-center gap-2">

              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" />

              <span className="text-sm font-semibold text-red-300">
                EARTHQUAKE IN PROGRESS
              </span>

            </div>

            <div className="mt-2 text-xs leading-5 text-white/50">
              Buildings are being affected according to the earthquake magnitude and their distance from the epicenter.
            </div>

          </div>
        )}

        {/* =======================================================
            BUTTONS
        ======================================================= */}

        <div className="mt-5 flex gap-2">

          {!active && (
            <button
              type="button"
              disabled={!canStart}
              onClick={() =>
                onSimulate(magnitude)
              }
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                canStart
                  ? "bg-orange-500 text-white hover:bg-orange-400"
                  : "cursor-not-allowed bg-white/10 text-white/25"
              }`}
            >
              {point
                ? "Start Earthquake"
                : "Select Epicenter First"}
            </button>
          )}

          {active && (
            <button
              type="button"
              onClick={onReset}
              className="flex-1 rounded-xl bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/25"
            >
              Reset Simulation
            </button>
          )}

          {!active && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl bg-white/5 px-4 py-3 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
          )}

        </div>

        {/* =======================================================
            ACTIVE HELP
        ======================================================= */}

        {active && (
          <div className="mt-3 text-center text-[10px] text-white/25">
            You can still click buildings to inspect them.
          </div>
        )}

      </div>
    </div>
  );
}