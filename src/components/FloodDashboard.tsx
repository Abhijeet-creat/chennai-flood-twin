"use client";

import { useMemo, useState } from "react";

type FloodDashboardProps = {
  waterLevel: number;
  totalBuildings: number;
  floodedBuildings: number;
  atRiskBuildings: number;
  totalRoads: number;
  affectedRoads: number;
  affectedVehicles: number;
};

type ForecastStep = {
  minute: number;
  depth: number;
  rainfall: number;
  drainageStress: number;
  nearestDrain: number;
  risk: "LOW" | "MODERATE" | "HIGH" | "FLOODED";
};

type LayerKey =
  | "forecast"
  | "historical"
  | "drainage"
  | "roads"
  | "affectedRoads";

const FORECAST_STEPS: ForecastStep[] = [
  {
    minute: 0,
    depth: 0.18,
    rainfall: 8,
    drainageStress: 0.22,
    nearestDrain: 18,
    risk: "LOW",
  },
  {
    minute: 30,
    depth: 0.24,
    rainfall: 12,
    drainageStress: 0.25,
    nearestDrain: 17,
    risk: "LOW",
  },
  {
    minute: 60,
    depth: 0.31,
    rainfall: 17,
    drainageStress: 0.28,
    nearestDrain: 17,
    risk: "MODERATE",
  },
  {
    minute: 90,
    depth: 0.42,
    rainfall: 24,
    drainageStress: 0.31,
    nearestDrain: 16,
    risk: "MODERATE",
  },
  {
    minute: 120,
    depth: 0.58,
    rainfall: 31,
    drainageStress: 0.36,
    nearestDrain: 15,
    risk: "HIGH",
  },
  {
    minute: 150,
    depth: 0.76,
    rainfall: 39,
    drainageStress: 0.43,
    nearestDrain: 14,
    risk: "HIGH",
  },
  {
    minute: 180,
    depth: 1.02,
    rainfall: 48,
    drainageStress: 0.51,
    nearestDrain: 13,
    risk: "FLOODED",
  },
];

const LAYER_LABELS: {
  key: LayerKey;
  label: string;
}[] = [
  {
    key: "forecast",
    label: "Flood forecast",
  },
  {
    key: "historical",
    label: "Historical hotspots",
  },
  {
    key: "drainage",
    label: "Drainage network",
  },
  {
    key: "roads",
    label: "Road network",
  },
  {
    key: "affectedRoads",
    label: "Affected roads",
  },
];

function formatTime(minute: number) {
  if (minute === 0) {
    return "NOW";
  }

  return `+${minute}`;
}

function riskClasses(risk: ForecastStep["risk"]) {
  switch (risk) {
    case "LOW":
      return {
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        dot: "bg-emerald-600",
      };

    case "MODERATE":
      return {
        text: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
        dot: "bg-amber-500",
      };

    case "HIGH":
      return {
        text: "text-orange-700",
        bg: "bg-orange-50",
        border: "border-orange-200",
        dot: "bg-orange-600",
      };

    case "FLOODED":
      return {
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        dot: "bg-red-600",
      };
  }
}

export default function FloodDashboard({
  waterLevel,
  totalBuildings,
  floodedBuildings,
  atRiskBuildings,
  totalRoads,
  affectedRoads,
  affectedVehicles,
}: FloodDashboardProps) {
  const [selectedMinute, setSelectedMinute] = useState(90);

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    forecast: true,
    historical: false,
    drainage: true,
    roads: true,
    affectedRoads: true,
  });

  const [showLayers, setShowLayers] = useState(true);

  const [showDetails, setShowDetails] = useState(true);

  const [playing, setPlaying] = useState(false);

  const [selectedArea, setSelectedArea] = useState<
    "flood" | "drainage" | "road" | null
  >(null);

  const forecast = useMemo(() => {
    return (
      FORECAST_STEPS.find(
        (item) => item.minute === selectedMinute
      ) ?? FORECAST_STEPS[0]
    );
  }, [selectedMinute]);

  const risk = riskClasses(forecast.risk);

  /*
   * The existing 3D scene still supplies the actual current
   * building/road analysis.
   *
   * The forecast values below are currently presentation data.
   * Once the backend contract is connected, FORECAST_STEPS should
   * be replaced by the API response.
   */

  const progress =
    selectedMinute === 0
      ? 0
      : Math.min(
          100,
          (selectedMinute / 180) * 100
        );

  const estimatedAffectedBuildings = Math.min(
    totalBuildings,
    Math.round(
      atRiskBuildings *
        (0.35 + selectedMinute / 300)
    )
  );

  const estimatedAffectedRoads = Math.min(
    totalRoads,
    Math.round(
      affectedRoads *
        (0.35 + selectedMinute / 250)
    )
  );

  function toggleLayer(layer: LayerKey) {
    setLayers((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }

    setPlaying(true);

    const currentIndex = FORECAST_STEPS.findIndex(
      (item) => item.minute === selectedMinute
    );

    let nextIndex =
      currentIndex >= 0
        ? currentIndex
        : 0;

    const interval = window.setInterval(() => {
      nextIndex += 1;

      if (
        nextIndex >=
        FORECAST_STEPS.length
      ) {
        window.clearInterval(interval);
        setPlaying(false);
        return;
      }

      setSelectedMinute(
        FORECAST_STEPS[nextIndex].minute
      );
    }, 900);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-slate-900">

      {/* =========================================================
          TOP INFORMATION BAR
      ========================================================= */}

      <div className="pointer-events-auto absolute left-5 right-5 top-5 flex items-start justify-between gap-4">

        {/* BRAND / LOCATION */}

        <div className="rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">

            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
              J
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">
                JALSETU
              </div>

              <div className="mt-0.5 text-[10px] text-slate-500">
                Chennai Flood Intelligence
              </div>
            </div>

            <div className="ml-3 h-6 w-px bg-slate-200" />

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Area
              </div>

              <div className="text-sm font-medium text-slate-800">
                Velachery
              </div>
            </div>

          </div>
        </div>


        {/* CURRENT FORECAST */}

        <div className="rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">

          <div className="flex items-center gap-3">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Forecast
              </div>

              <div className="text-sm font-semibold text-slate-900">
                {formatTime(selectedMinute)} min
              </div>
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${risk.dot}`}
              />

              <span
                className={`text-xs font-semibold ${risk.text}`}
              >
                {forecast.risk}
              </span>
            </div>

          </div>

        </div>

      </div>


      {/* =========================================================
          LEFT LAYER CONTROL
      ========================================================= */}

      <div className="pointer-events-auto absolute left-5 top-28 w-[220px]">

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">

          <button
            type="button"
            onClick={() =>
              setShowLayers(
                (value) => !value
              )
            }
            className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-left"
          >

            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Map layers
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-900">
                Data visibility
              </div>
            </div>

            <span className="text-slate-400">
              {showLayers ? "−" : "+"}
            </span>

          </button>


          {showLayers && (
            <div className="divide-y divide-slate-100">

              {LAYER_LABELS.map(
                (layer) => (
                  <button
                    key={layer.key}
                    type="button"
                    onClick={() =>
                      toggleLayer(
                        layer.key
                      )
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                  >

                    <div className="flex items-center gap-2.5">

                      <span
                        className={`h-2 w-2 rounded-full ${
                          layers[
                            layer.key
                          ]
                            ? "bg-emerald-600"
                            : "bg-slate-300"
                        }`}
                      />

                      <span
                        className={`text-xs ${
                          layers[
                            layer.key
                          ]
                            ? "font-medium text-slate-800"
                            : "text-slate-400"
                        }`}
                      >
                        {layer.label}
                      </span>

                    </div>

                    <span
                      className={`text-[10px] ${
                        layers[
                          layer.key
                        ]
                          ? "text-emerald-700"
                          : "text-slate-400"
                      }`}
                    >
                      {layers[
                        layer.key
                      ]
                        ? "ON"
                        : "OFF"}
                    </span>

                  </button>
                )
              )}

            </div>
          )}

        </div>

      </div>


      {/* =========================================================
          RIGHT INFORMATION PANEL
      ========================================================= */}

      <aside className="pointer-events-auto absolute bottom-5 right-5 top-28 w-[330px]">

        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/96 shadow-lg backdrop-blur-sm">

          {/* HEADER */}

          <div className="border-b border-slate-200 px-5 py-4">

            <div className="flex items-start justify-between">

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Flood forecast
                </div>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Velachery
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowDetails(
                    (value) =>
                      !value
                  )
                }
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                {showDetails
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>


          {/* TIMELINE */}

          <div className="border-b border-slate-200 px-5 py-4">

            <div className="mb-3 flex items-center justify-between">

              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Forecast timeline
              </span>

              <button
                type="button"
                onClick={
                  togglePlayback
                }
                className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
              >
                {playing
                  ? "Pause"
                  : "Play"}
              </button>

            </div>


            {/* TIMELINE LINE */}

            <div className="relative px-1">

              <div className="absolute left-1 right-1 top-[11px] h-px bg-slate-200" />

              <div
                className="absolute left-1 top-[11px] h-px bg-emerald-600 transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />

              <div className="relative flex justify-between">

                {FORECAST_STEPS.map(
                  (step) => {
                    const active =
                      selectedMinute ===
                      step.minute;

                    return (
                      <button
                        key={
                          step.minute
                        }
                        type="button"
                        onClick={() =>
                          setSelectedMinute(
                            step.minute
                          )
                        }
                        className="group flex flex-col items-center"
                        aria-label={`Show forecast ${step.minute} minutes`}
                      >

                        <span
                          className={`relative z-10 block h-[9px] w-[9px] rounded-full border-2 transition ${
                            active
                              ? "border-emerald-600 bg-white"
                              : "border-slate-300 bg-white group-hover:border-emerald-500"
                          }`}
                        />

                        <span
                          className={`mt-2 text-[9px] ${
                            active
                              ? "font-bold text-emerald-700"
                              : "text-slate-400"
                          }`}
                        >
                          {step.minute ===
                          0
                            ? "NOW"
                            : `+${step.minute}`}
                        </span>

                      </button>
                    );
                  }
                )}

              </div>

            </div>

          </div>


          {showDetails && (
            <div className="flex-1 overflow-y-auto">

              {/* =================================================
                  MAIN FLOOD READING
              ================================================= */}

              <div className="border-b border-slate-200 px-5 py-5">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedArea(
                      "flood"
                    )
                  }
                  className={`w-full text-left transition ${
                    selectedArea ===
                    "flood"
                      ? "bg-slate-50"
                      : ""
                  }`}
                >

                  <div className="flex items-end justify-between">

                    <div>

                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Estimated flood depth
                      </div>

                      <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                        {forecast.depth.toFixed(
                          2
                        )}{" "}
                        <span className="text-base font-normal text-slate-500">
                          m
                        </span>
                      </div>

                    </div>

                    <div
                      className={`mb-1 rounded-md border px-2 py-1 text-[10px] font-bold ${risk.bg} ${risk.border} ${risk.text}`}
                    >
                      {forecast.risk}
                    </div>

                  </div>

                </button>

              </div>


              {/* =================================================
                  BASIC METRICS
              ================================================= */}

              <div className="grid grid-cols-2 border-b border-slate-200">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedArea(
                      "flood"
                    )
                  }
                  className="border-r border-slate-200 px-5 py-4 text-left hover:bg-slate-50"
                >

                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Rainfall
                  </div>

                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {forecast.rainfall}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      mm
                    </span>
                  </div>

                </button>


                <button
                  type="button"
                  onClick={() =>
                    setSelectedArea(
                      "drainage"
                    )
                  }
                  className="px-5 py-4 text-left hover:bg-slate-50"
                >

                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Drainage stress
                  </div>

                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {forecast.drainageStress.toFixed(
                      2
                    )}
                  </div>

                </button>

              </div>


              {/* =================================================
                  DRAINAGE
              ================================================= */}

              <div className="border-b border-slate-200 px-5 py-4">

                <div className="mb-3 flex items-center justify-between">

                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Drainage
                    </div>

                    <div className="mt-0.5 text-sm font-semibold text-slate-900">
                      Local network
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      toggleLayer(
                        "drainage"
                      )
                    }
                    className={`text-[10px] font-semibold ${
                      layers.drainage
                        ? "text-emerald-700"
                        : "text-slate-400"
                    }`}
                  >
                    {layers.drainage
                      ? "VISIBLE"
                      : "HIDDEN"}
                  </button>

                </div>


                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <div className="text-[10px] text-slate-400">
                      Nearest drain
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {
                        forecast.nearestDrain
                      }{" "}
                      m
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400">
                      Within 250 m
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      11 segments
                    </div>
                  </div>

                </div>

              </div>


              {/* =================================================
                  INFRASTRUCTURE
              ================================================= */}

              <div className="border-b border-slate-200 px-5 py-4">

                <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Infrastructure impact
                </div>

                <div className="space-y-3">

                  <div className="flex items-center justify-between">

                    <span className="text-xs text-slate-500">
                      Buildings at risk
                    </span>

                    <span className="text-sm font-semibold text-slate-800">
                      {estimatedAffectedBuildings.toLocaleString()}
                    </span>

                  </div>


                  <div className="flex items-center justify-between">

                    <span className="text-xs text-slate-500">
                      Flooded buildings
                    </span>

                    <span className="text-sm font-semibold text-slate-800">
                      {floodedBuildings.toLocaleString()}
                    </span>

                  </div>


                  <div className="flex items-center justify-between">

                    <span className="text-xs text-slate-500">
                      Roads affected
                    </span>

                    <span className="text-sm font-semibold text-slate-800">
                      {estimatedAffectedRoads.toLocaleString()}
                    </span>

                  </div>


                  <div className="flex items-center justify-between">

                    <span className="text-xs text-slate-500">
                      Vehicles affected
                    </span>

                    <span className="text-sm font-semibold text-slate-800">
                      {affectedVehicles.toLocaleString()}
                    </span>

                  </div>

                </div>

              </div>


              {/* =================================================
                  SELECTED INFORMATION
              ================================================= */}

              {selectedArea && (
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">

                  <div className="flex items-center justify-between">

                    <div>

                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Selected layer
                      </div>

                      <div className="mt-1 text-sm font-semibold capitalize text-slate-900">
                        {selectedArea ===
                        "flood"
                          ? "Flood zone"
                          : selectedArea ===
                            "drainage"
                          ? "Drainage network"
                          : "Road network"}
                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedArea(
                          null
                        )
                      }
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Clear
                    </button>

                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-slate-500">

                    {selectedArea ===
                      "flood" &&
                      "Flood forecast information for the selected forecast time."}

                    {selectedArea ===
                      "drainage" &&
                      "Drainage information surrounding the selected flood area."}

                    {selectedArea ===
                      "road" &&
                      "Road impact information for the selected forecast time."}

                  </p>

                </div>
              )}


              {/* =================================================
                  CURRENT MODEL INFO
              ================================================= */}

              <div className="px-5 py-4">

                <div className="flex items-start gap-2">

                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />

                  <p className="text-[10px] leading-4 text-slate-400">

                    Flood depth and forecast values shown here are
                    currently presentation values. They should be
                    replaced by the backend forecast output when the
                    flood model API is connected.

                  </p>

                </div>

              </div>

            </div>
          )}


          {/* =====================================================
              FOOTER / LEGEND
          ===================================================== */}

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span className="text-[9px] text-slate-500">
                    Safe
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[9px] text-slate-500">
                    Caution
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-600" />
                  <span className="text-[9px] text-slate-500">
                    High
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-600" />
                  <span className="text-[9px] text-slate-500">
                    Flooded
                  </span>
                </div>

              </div>

              <span className="text-[9px] text-slate-400">
                0–180 min
              </span>

            </div>

          </div>

        </div>

      </aside>


      {/* =========================================================
          BOTTOM MAP STATUS
      ========================================================= */}

      <div className="pointer-events-auto absolute bottom-5 left-5">

        <div className="rounded-md border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">

          <div className="flex items-center gap-3">

            <div className="flex items-center gap-1.5">

              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />

              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Chennai
              </span>

            </div>

            <div className="h-3 w-px bg-slate-200" />

            <span className="text-[9px] text-slate-400">
              Flood intelligence
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}