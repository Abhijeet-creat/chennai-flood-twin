"use client";

import type {
  RainNowcastState,
} from "./RainNowcast";

type RainfallPanelProps = {
  state: RainNowcastState;

  onLeadChange?: (
    minutes: number
  ) => void;
};

const LEADS = [
  30,
  60,
  90,
  120,
  150,
  180,
];

function formatTime(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  );
}

function getRainLabel(
  rainfall: number
) {
  if (rainfall <= 0) {
    return "No rain";
  }

  if (rainfall < 2.5) {
    return "Light";
  }

  if (rainfall < 7.6) {
    return "Moderate";
  }

  if (rainfall < 35.6) {
    return "Heavy";
  }

  if (rainfall < 64.5) {
    return "Very Heavy";
  }

  return "Extremely Heavy";
}

export default function RainfallPanel({
  state,
  onLeadChange,
}: RainfallPanelProps) {
  const {
    loading,
    error,
    lastUpdated,
    imd,
    nowcast,
    selectedLeadMinutes,
    currentRainfallMmHr,
    forecastRainfallMmHr,
    runoff,
    radarReady,
    terrainReady,
    confidencePercent,
  } = state;

  const selectedFrame =
    nowcast?.frames.find(
      (frame) =>
        frame.leadMinutes ===
        selectedLeadMinutes
    ) ?? null;

  const selectedConfidence =
    selectedFrame
      ? Math.round(
          selectedFrame.confidence *
            100
        )
      : confidencePercent;

  const rainLabel =
    getRainLabel(
      forecastRainfallMmHr
    );

  return (
    <div className="absolute right-6 top-6 z-30 w-[370px] max-w-[calc(100%-32px)] overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#050d15]/95 text-white shadow-2xl backdrop-blur-xl">
      
      {/* HEADER */}

      <div className="border-b border-white/10 px-5 py-4">

        <div className="flex items-center justify-between">

          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
              Live Rain Nowcast
            </div>

            <h2 className="mt-1 text-xl font-semibold">
              Chennai / Velachery
            </h2>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-green-400/10 px-3 py-1.5 text-[10px] font-semibold text-green-300">

            <span
              className={`h-2 w-2 rounded-full ${
                loading
                  ? "animate-pulse bg-yellow-300"
                  : "bg-green-400"
              }`}
            />

            {loading
              ? "UPDATING"
              : "LIVE"}
          </div>

        </div>

        <div className="mt-2 text-[10px] text-white/35">
          Source: India Meteorological Department
        </div>

      </div>

      <div className="p-5">

        {/* CURRENT OBSERVATION */}

        <div className="grid grid-cols-2 gap-3">

          <div className="rounded-xl bg-white/5 p-3">

            <div className="text-[10px] uppercase tracking-wider text-white/35">
              Current Rainfall
            </div>

            <div className="mt-1 font-mono text-2xl text-cyan-300">
              {currentRainfallMmHr.toFixed(1)}
            </div>

            <div className="text-[10px] text-white/35">
              mm/hr
            </div>

            <div className="mt-2 text-[10px] text-white/35">
              {rainLabel}
            </div>

          </div>

          <div className="rounded-xl bg-white/5 p-3">

            <div className="text-[10px] uppercase tracking-wider text-white/35">
              Forecast
            </div>

            <div className="mt-1 font-mono text-2xl text-orange-300">
              {forecastRainfallMmHr.toFixed(
                1
              )}
            </div>

            <div className="text-[10px] text-white/35">
              mm/hr
            </div>

            <div className="mt-2 text-[10px] text-white/35">
              +{selectedLeadMinutes} min
            </div>

          </div>

        </div>

        {/* FORECAST TIMELINE */}

        <div className="mt-5">

          <div className="mb-2 flex items-center justify-between">

            <div className="text-[10px] uppercase tracking-wider text-white/35">
              Forecast Horizon
            </div>

            <div className="font-mono text-xs text-cyan-300">
              +{selectedLeadMinutes} min
            </div>

          </div>

          <div className="grid grid-cols-3 gap-2">

            {LEADS.map(
              (lead) => {
                const frame =
                  nowcast?.frames.find(
                    (item) =>
                      item.leadMinutes ===
                      lead
                  );

                const maximum =
                  frame
                    ? frame.grid.values.reduce(
                        (
                          max,
                          value
                        ) =>
                          Math.max(
                            max,
                            Number.isFinite(
                              value
                            )
                              ? value
                              : 0
                          ),
                        0
                      )
                    : 0;

                const active =
                  selectedLeadMinutes ===
                  lead;

                return (
                  <button
                    key={lead}
                    type="button"
                    onClick={() =>
                      onLeadChange?.(
                        lead
                      )
                    }
                    className={`rounded-xl border p-2 text-left transition ${
                      active
                        ? "border-cyan-400/40 bg-cyan-400/10"
                        : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="text-[9px] text-white/35">
                      +{lead} min
                    </div>

                    <div className="mt-1 font-mono text-sm text-white/80">
                      {maximum.toFixed(
                        1
                      )}
                    </div>

                    <div className="text-[9px] text-white/30">
                      mm/hr max
                    </div>
                  </button>
                );
              }
            )}

          </div>

        </div>

        {/* NOWCAST CONFIDENCE */}

        <div className="mt-4 rounded-xl bg-white/5 p-3">

          <div className="flex items-center justify-between">

            <span className="text-xs text-white/45">
              Nowcast Confidence
            </span>

            <span className="font-mono text-sm text-cyan-300">
              {selectedConfidence}%
            </span>

          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">

            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{
                width: `${selectedConfidence}%`,
              }}
            />

          </div>

          <div className="mt-2 text-[9px] text-white/30">
            Confidence decreases as the
            forecast extends farther from the
            latest radar observations.
          </div>

        </div>

        {/* MODEL STATUS */}

        <div className="mt-4">

          <div className="mb-2 text-[10px] uppercase tracking-wider text-white/30">
            Model Pipeline
          </div>

          <div className="space-y-1.5">

            <StatusRow
              label="IMD observations"
              ready={imd !== null}
            />

            <StatusRow
              label="Quantitative radar"
              ready={radarReady}
            />

            <StatusRow
              label="DEM / terrain"
              ready={terrainReady}
            />

            <StatusRow
              label="Runoff model"
              ready={runoff !== null}
            />

            <StatusRow
              label="0–3 hr nowcast"
              ready={
                nowcast !== null &&
                nowcast.frames.length > 0
              }
            />

          </div>

        </div>

        {/* RUNOFF */}

        {runoff && (
          <div className="mt-4 rounded-xl bg-cyan-400/5 p-3">

            <div className="text-[10px] uppercase tracking-wider text-white/35">
              Surface Runoff
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">

              <Metric
                label="Rainfall"
                value={`${runoff.totalRainfallMm.toFixed(
                  1
                )} mm`}
              />

              <Metric
                label="Runoff"
                value={`${runoff.totalRunoffVolumeM3.toFixed(
                  1
                )} m³`}
              />

            </div>

          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/15 bg-red-400/5 p-3">

            <div className="text-[10px] uppercase tracking-wider text-red-300">
              Data Warning
            </div>

            <div className="mt-1 text-[10px] leading-5 text-red-200/60">
              {error}
            </div>

          </div>
        )}

        {/* FOOTER */}

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[9px] text-white/25">

          <span>
            Last update
          </span>

          <span className="font-mono">
            {formatTime(
              lastUpdated
            )}
          </span>

        </div>

      </div>
    </div>
  );
}

/* ================================================================
   STATUS ROW
================================================================ */

function StatusRow({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">

      <span className="text-[10px] text-white/45">
        {label}
      </span>

      <div className="flex items-center gap-1.5">

        <span
          className={`h-1.5 w-1.5 rounded-full ${
            ready
              ? "bg-green-400"
              : "bg-white/20"
          }`}
        />

        <span
          className={`text-[9px] font-medium ${
            ready
              ? "text-green-300"
              : "text-white/25"
          }`}
        >
          {ready
            ? "READY"
            : "WAITING"}
        </span>

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
    <div className="rounded-lg bg-black/10 p-2">

      <div className="text-[9px] text-white/30">
        {label}
      </div>

      <div className="mt-1 font-mono text-xs text-cyan-200">
        {value}
      </div>

    </div>
  );
}