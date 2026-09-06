"use client";

import type { SelectedBuilding } from "./Buildings";

type BuildingInfoPanelProps = {
  building: SelectedBuilding | null;
  onClose: () => void;
};

export default function BuildingInfoPanel({
  building,
  onClose,
}: BuildingInfoPanelProps) {
  if (!building) {
    return null;
  }

  const floodDepth = Math.max(0, building.floodDepth);

  let status = "SAFE";
  let statusClass = "bg-green-500/20 text-green-300";
  let statusDot = "bg-green-400";

  if (floodDepth >= 0.6) {
    status = "FLOODED";
    statusClass = "bg-red-500/20 text-red-300";
    statusDot = "bg-red-400";
  } else if (floodDepth >= 0.35) {
    status = "HIGH RISK";
    statusClass = "bg-orange-500/20 text-orange-300";
    statusDot = "bg-orange-400";
  } else if (floodDepth >= 0.15) {
    status = "AT RISK";
    statusClass = "bg-yellow-500/20 text-yellow-300";
    statusDot = "bg-yellow-400";
  }

  const properties = building.properties ?? {};

  const buildingType =
    String(properties.building ?? "Unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );

  const levels =
    properties["building:levels"] ??
    properties.levels ??
    "Unknown";

  const height =
    properties.height ??
    null;

  return (
    <div className="absolute left-6 top-6 z-30 w-[330px] overflow-hidden rounded-2xl border border-white/10 bg-[#050d16]/95 text-white shadow-2xl backdrop-blur-xl">
      {/* HEADER */}

      <div className="flex items-start justify-between border-b border-white/10 p-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            Selected Building
          </div>

          <h2 className="mt-1 text-xl font-semibold">
            Building #{building.index + 1}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Close building information"
        >
          ×
        </button>
      </div>

      {/* FLOOD STATUS */}

      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-white/50">
            Flood Status
          </span>

          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${statusDot}`}
            />

            {status}
          </div>
        </div>

        {/* FLOOD DEPTH */}

        <div className="mb-4 rounded-xl bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">
              Current Flood Depth
            </span>

            <span className="font-mono text-lg text-cyan-300">
              {floodDepth.toFixed(2)} m
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                floodDepth >= 0.6
                  ? "bg-red-400"
                  : floodDepth >= 0.35
                  ? "bg-orange-400"
                  : floodDepth >= 0.15
                  ? "bg-yellow-400"
                  : "bg-green-400"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  (floodDepth / 2) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* BUILDING INFORMATION */}

        <div className="space-y-2">
          <InfoRow
            label="Type"
            value={buildingType}
          />

          <InfoRow
            label="Terrain Elevation"
            value={`${building.terrainElevation.toFixed(
              2
            )} m`}
          />

          <InfoRow
            label="Visual Height"
            value={`${building.height.toFixed(
              2
            )} m`}
          />

          <InfoRow
            label="Levels"
            value={String(levels)}
          />

          {height !== null && (
            <InfoRow
              label="OSM Height"
              value={`${height} m`}
            />
          )}

          <InfoRow
            label="Longitude"
            value={building.longitude.toFixed(
              6
            )}
          />

          <InfoRow
            label="Latitude"
            value={building.latitude.toFixed(
              6
            )}
          />
        </div>

        {/* FLOOD MESSAGE */}

        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/35">
            Assessment
          </div>

          <p className="mt-1 text-xs leading-relaxed text-white/60">
            {floodDepth >= 0.6
              ? "Water has reached the building footprint. This building is considered flooded."
              : floodDepth >= 0.35
              ? "Water is approaching the building significantly. High flood risk is detected."
              : floodDepth >= 0.15
              ? "The building is close to the simulated flood level and should be monitored."
              : "The building is currently above the simulated flood level."}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
      <span className="text-xs text-white/40">
        {label}
      </span>

      <span className="max-w-[170px] truncate text-right text-xs font-medium text-white/80">
        {value}
      </span>
    </div>
  );
}