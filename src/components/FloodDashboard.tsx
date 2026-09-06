"use client";

type FloodDashboardProps = {
  waterLevel: number;
  totalBuildings: number;
  floodedBuildings: number;
  atRiskBuildings: number;
  totalRoads: number;
  affectedRoads: number;
  affectedVehicles: number;
};

export default function FloodDashboard({
  waterLevel,
  totalBuildings,
  floodedBuildings,
  atRiskBuildings,
  totalRoads,
  affectedRoads,
  affectedVehicles,
}: FloodDashboardProps) {
  const buildingRisk =
    totalBuildings > 0
      ? Math.round(
          (atRiskBuildings /
            totalBuildings) *
            100
        )
      : 0;

  const roadRisk =
    totalRoads > 0
      ? Math.round(
          (affectedRoads /
            totalRoads) *
            100
        )
      : 0;

  const overallRisk =
    Math.min(
      100,
      Math.round(
        buildingRisk * 0.6 +
          roadRisk * 0.4
      )
    );

  let riskLabel = "Low";

  if (overallRisk >= 60) {
    riskLabel = "Severe";
  } else if (overallRisk >= 35) {
    riskLabel = "High";
  } else if (overallRisk >= 15) {
    riskLabel = "Moderate";
  }

  return (
    <div className="absolute bottom-6 right-6 z-20 w-[360px] rounded-2xl border border-white/10 bg-black/70 p-5 text-white shadow-2xl backdrop-blur-xl">
      {/* HEADER */}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
            Live Impact Analysis
          </div>

          <h2 className="mt-1 text-lg font-semibold">
            Flood Impact
          </h2>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            overallRisk >= 60
              ? "bg-red-500/20 text-red-300"
              : overallRisk >= 35
              ? "bg-orange-500/20 text-orange-300"
              : "bg-green-500/20 text-green-300"
          }`}
        >
          {riskLabel}
        </div>
      </div>

      {/* OVERALL RISK */}

      <div className="mb-4 rounded-xl bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">
            Overall Flood Risk
          </span>

          <span className="font-mono text-xl text-cyan-300">
            {overallRisk}%
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-500"
            style={{
              width: `${overallRisk}%`,
            }}
          />
        </div>

        <div className="mt-2 text-xs text-white/40">
          Current water level:{" "}
          {waterLevel.toFixed(2)} m
        </div>
      </div>

      {/* STAT GRID */}

      <div className="grid grid-cols-2 gap-3">
        {/* BUILDINGS AT RISK */}

        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/45">
            Buildings at Risk
          </div>

          <div className="mt-1 text-xl font-semibold text-orange-300">
            {atRiskBuildings.toLocaleString()}
          </div>

          <div className="mt-1 text-[10px] text-white/35">
            of {totalBuildings.toLocaleString()}
          </div>
        </div>

        {/* FLOODED BUILDINGS */}

        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/45">
            Flooded Buildings
          </div>

          <div className="mt-1 text-xl font-semibold text-red-300">
            {floodedBuildings.toLocaleString()}
          </div>

          <div className="mt-1 text-[10px] text-white/35">
            water reached building
          </div>
        </div>

        {/* ROADS */}

        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/45">
            Roads Affected
          </div>

          <div className="mt-1 text-xl font-semibold text-yellow-300">
            {affectedRoads.toLocaleString()}
          </div>

          <div className="mt-1 text-[10px] text-white/35">
            of {totalRoads.toLocaleString()}
          </div>
        </div>

        {/* VEHICLES */}

        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/45">
            Vehicles Affected
          </div>

          <div className="mt-1 text-xl font-semibold text-cyan-300">
            {affectedVehicles.toLocaleString()}
          </div>

          <div className="mt-1 text-[10px] text-white/35">
            slowed or stopped
          </div>
        </div>
      </div>

      {/* LEGEND */}

      <div className="mt-4 flex items-center gap-4 border-t border-white/10 pt-3 text-[10px] text-white/40">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          Safe
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          At Risk
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          Flooded
        </div>
      </div>
    </div>
  );
}