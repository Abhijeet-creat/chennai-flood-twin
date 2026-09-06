"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import {
  MIN_LON,
  MAX_LON,
  MIN_LAT,
  MAX_LAT,
  MIN_ELEVATION,
  MAX_REAL_FLOOD_DEPTH,
  TERRAIN_SIZE,
  lonToX,
  latToZ,
} from "@/lib/terrain";

import {
  DEFAULT_EARTHQUAKE_MAGNITUDE,
  type EarthquakeOrigin,
} from "@/lib/earthquake";

import {
  analyzeFlood,
  type FloodAnalysis,
} from "@/lib/floodAnalysis";

import Buildings, {
  type SelectedBuilding,
} from "./Buildings";

import Roads from "./Roads";
import Cars from "./Cars";
import FloodWater from "./FloodWater";
import FloodDashboard from "./FloodDashboard";
import Rain from "./Rain";
import RainRadarLayer from "./rain/RainRadarLayer";
import Terrain from "./Terrain";
import EarthquakeEffect from "./EarthquakeEffect";
import EarthquakePanel from "./EarthquakePanel";

/* ================================================================
   TYPES
================================================================ */

type DisasterType =
  | "rain"
  | "flood"
  | "earthquake";

type Point = {
  x: number;
  y: number;
  z: number;
};

type RoadPath = {
  points: Point[];
  highway?: string;
};

type LineStringFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  properties?: Record<string, unknown> | null;
};

type MultiLineStringFeature = {
  type: "Feature";
  geometry: {
    type: "MultiLineString";
    coordinates: number[][][];
  };
  properties?: Record<string, unknown> | null;
};

type RoadFeature =
  | LineStringFeature
  | MultiLineStringFeature;

type RoadGeoJSON = {
  type: "FeatureCollection";
  features: RoadFeature[];
};

/* ================================================================
   ROAD DATA
================================================================ */

function useRoadPaths() {
  const [roadData, setRoadData] =
    useState<RoadGeoJSON | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/roads.geojson")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Could not load roads.geojson: ${response.status}`
          );
        }

        return response.json();
      })
      .then((data: RoadGeoJSON) => {
        if (cancelled) return;

        setRoadData(data);
      })
      .catch((error) => {
        console.error(
          "Road loading error:",
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo<RoadPath[]>(() => {
    if (!roadData) {
      return [];
    }

    const result: RoadPath[] = [];

    for (const feature of roadData.features) {
      const highway =
        feature.properties?.highway;

      /* ----------------------------------------------------------
         LINE STRING
      ---------------------------------------------------------- */

      if (
        feature.geometry.type ===
        "LineString"
      ) {
        const coordinates =
          feature.geometry.coordinates;

        if (coordinates.length < 2) {
          continue;
        }

        const points: Point[] =
          coordinates
            .filter((coordinate) => {
              const lon = coordinate[0];
              const lat = coordinate[1];

              return (
                lon >= MIN_LON &&
                lon <= MAX_LON &&
                lat >= MIN_LAT &&
                lat <= MAX_LAT
              );
            })
            .map((coordinate) => ({
              x: lonToX(coordinate[0]),
              y: 0,
              z: latToZ(coordinate[1]),
            }));

        if (points.length >= 2) {
          result.push({
            points,
            highway:
              typeof highway === "string"
                ? highway
                : "residential",
          });
        }
      }

      /* ----------------------------------------------------------
         MULTI LINE STRING
      ---------------------------------------------------------- */

      if (
        feature.geometry.type ===
        "MultiLineString"
      ) {
        for (const line of
          feature.geometry.coordinates) {
          if (line.length < 2) {
            continue;
          }

          const points: Point[] =
            line
              .filter((coordinate) => {
                const lon = coordinate[0];
                const lat = coordinate[1];

                return (
                  lon >= MIN_LON &&
                  lon <= MAX_LON &&
                  lat >= MIN_LAT &&
                  lat <= MAX_LAT
                );
              })
              .map((coordinate) => ({
                x: lonToX(coordinate[0]),
                y: 0,
                z: latToZ(coordinate[1]),
              }));

          if (points.length >= 2) {
            result.push({
              points,
              highway:
                typeof highway === "string"
                  ? highway
                  : "residential",
            });
          }
        }
      }
    }

    return result;
  }, [roadData]);
}

/* ================================================================
   3D SCENE
================================================================ */

function Scene({
  disasterType,
  waterSurface,
  roadPaths,
  onBuildingSelect,
  earthquakePoint,
  earthquakeMagnitude,
  earthquakeActive,
  earthquakeSelectionMode,
  onEarthquakePoint,
}: {
  disasterType: DisasterType;
  waterSurface: number;
  roadPaths: RoadPath[];
  onBuildingSelect: (
    building: SelectedBuilding
  ) => void;
  earthquakePoint: EarthquakeOrigin | null;
  earthquakeMagnitude: number;
  earthquakeActive: boolean;
  earthquakeSelectionMode: boolean;
  onEarthquakePoint: (
    point: EarthquakeOrigin
  ) => void;
}) {
  const rainIntensity =
    disasterType === "rain" ? 1 : 0;

  const handleMapClick = (
    event: any
  ) => {
    if (!earthquakeSelectionMode) {
      return;
    }

    event.stopPropagation();

    onEarthquakePoint({
      x: event.point.x,
      z: event.point.z,
    });
  };

  return (
    <>
      <ambientLight intensity={1.1} />

      <directionalLight
        position={[6, 12, 6]}
        intensity={1.8}
      />

      <group onClick={handleMapClick}>
        <Terrain />

        <Roads paths={roadPaths} />

        <Buildings
          waterLevel={
            disasterType === "flood"
              ? waterSurface
              : MIN_ELEVATION
          }
          onBuildingSelect={
            onBuildingSelect
          }
          earthquakeOrigin={
            disasterType === "earthquake"
              ? earthquakePoint
              : null
          }
          earthquakeMagnitude={
            disasterType === "earthquake"
              ? earthquakeMagnitude
              : 0
          }
          earthquakeActive={
            disasterType === "earthquake"
              ? earthquakeActive
              : false
          }
          earthquakeSelectionMode={
            disasterType === "earthquake" &&
            earthquakeSelectionMode
          }
          onEarthquakePoint={
            onEarthquakePoint
          }
        />

        <Cars
          paths={roadPaths}
          waterLevel={
            disasterType === "flood"
              ? waterSurface
              : MIN_ELEVATION
          }
        />
      </group>

      {disasterType === "flood" && (
        <FloodWater
          waterLevel={waterSurface}
        />
      )}

      {disasterType === "rain" && (
        <>
          <Rain
            intensity={rainIntensity}
          />

          <RainRadarLayer
            visible={true}
            opacity={0.65}
            elevationOffset={0.03}
          />
        </>
      )}

      {disasterType === "earthquake" &&
        earthquakeActive && (
          <EarthquakeEffect
            active={earthquakeActive}
            magnitude={
              earthquakeMagnitude
            }
          />
        )}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={
          Math.PI / 2.05
        }
      />
    </>
  );
}

/* ================================================================
   CITY SCENE
================================================================ */

export default function CityScene() {
  /* ==============================================================
     CURRENT SIMULATION
  ============================================================== */

  const [
    disasterType,
    setDisasterType,
  ] = useState<DisasterType>("flood");

  /* ==============================================================
     FLOOD STATE
     This state is ONLY used by flood.
  ============================================================== */

  const [
    floodDepth,
    setFloodDepth,
  ] = useState(0);

  /* ==============================================================
     EARTHQUAKE STATE
     This state is ONLY used by earthquake.
  ============================================================== */

  const [
    earthquakePoint,
    setEarthquakePoint,
  ] =
    useState<EarthquakeOrigin | null>(
      null
    );

  const [
    earthquakeMagnitude,
    setEarthquakeMagnitude,
  ] = useState(
    DEFAULT_EARTHQUAKE_MAGNITUDE
  );

  const [
    earthquakeActive,
    setEarthquakeActive,
  ] = useState(false);

  const [
    earthquakePanelOpen,
    setEarthquakePanelOpen,
  ] = useState(false);

  /* ==============================================================
     BUILDING SELECTION
  ============================================================== */

  const [
    selectedBuilding,
    setSelectedBuilding,
  ] =
    useState<
      SelectedBuilding | null
    >(null);

  /* ==============================================================
     WATER
     ONLY MEANINGFUL IN FLOOD MODE
  ============================================================== */

  const waterSurface =
    THREE.MathUtils.clamp(
      MIN_ELEVATION +
        floodDepth,
      MIN_ELEVATION,
      MIN_ELEVATION +
        MAX_REAL_FLOOD_DEPTH
    );

  /* ==============================================================
     ROADS
  ============================================================== */

  const roadPaths =
    useRoadPaths();

  /* ==============================================================
     FLOOD ANALYSIS
     ONLY RUNS IN FLOOD MODE
  ============================================================== */

  const [
    floodAnalysis,
    setFloodAnalysis,
  ] =
    useState<FloodAnalysis>({
      totalBuildings: 5458,
      floodedBuildings: 0,
      atRiskBuildings: 0,
      totalRoads: 892,
      affectedRoads: 0,
      overallRisk: 0,
    });

  const [
    analysisLoading,
    setAnalysisLoading,
  ] = useState(false);

  useEffect(() => {
    /*
     * Completely stop flood analysis
     * when user switches to another mode.
     */
    if (disasterType !== "flood") {
      setAnalysisLoading(false);
      return;
    }

    let cancelled = false;

    setAnalysisLoading(true);

    analyzeFlood(waterSurface)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setFloodAnalysis(result);
      })
      .catch((error) => {
        console.error(
          "Flood analysis failed:",
          error
        );
      })
      .finally(() => {
        if (!cancelled) {
          setAnalysisLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    waterSurface,
    disasterType,
  ]);

  /* ==============================================================
     KEEP FLOOD BUILDING DATA UPDATED

     This is deliberately disabled during earthquake.
  ============================================================== */

  useEffect(() => {
    if (
      disasterType !== "flood" ||
      !selectedBuilding
    ) {
      return;
    }

    setSelectedBuilding(
      (current) => {
        if (!current) {
          return null;
        }

        const nextFloodDepth =
          Math.max(
            0,
            waterSurface -
              current.terrainElevation
          );

        if (
          Math.abs(
            current.floodDepth -
              nextFloodDepth
          ) < 0.001
        ) {
          return current;
        }

        return {
          ...current,
          floodDepth:
            nextFloodDepth,
        };
      }
    );
  }, [
    waterSurface,
    disasterType,
  ]);

  /* ==============================================================
     FLOOD STATUS
  ============================================================== */

  const simulationLevel =
    Math.round(
      THREE.MathUtils.clamp(
        (floodDepth /
          MAX_REAL_FLOOD_DEPTH) *
          100,
        0,
        100
      )
    );

  let floodStatus = "Low";

  if (floodDepth >= 4) {
    floodStatus = "Severe";
  } else if (floodDepth >= 2) {
    floodStatus = "High";
  } else if (floodDepth >= 0.75) {
    floodStatus = "Moderate";
  }

  /* ==============================================================
     EARTHQUAKE: SELECT EPICENTER
  ============================================================== */

  const handleEarthquakePoint = (
    point: EarthquakeOrigin
  ) => {
    /*
     * Selecting an epicenter starts a NEW
     * earthquake scenario.
     */
    setSelectedBuilding(null);

    setEarthquakePoint(point);

    setEarthquakeActive(false);

    /*
     * Open the magnitude dialog.
     */
    setEarthquakePanelOpen(true);
  };

  /* ==============================================================
     EARTHQUAKE: SIMULATE
  ============================================================== */

  const handleEarthquakeSimulate = (
    magnitude: number
  ) => {
    setEarthquakeMagnitude(
      magnitude
    );

    setEarthquakeActive(true);

    /*
     * The earthquake remains active even
     * if the user closes the panel.
     */
    setEarthquakePanelOpen(false);
  };

  /* ==============================================================
     EARTHQUAKE: CANCEL PANEL

     IMPORTANT:
     Cancel does NOT reset the earthquake.
  ============================================================== */

  const cancelEarthquakePanel = () => {
    setEarthquakePanelOpen(false);
  };

  /* ==============================================================
     EARTHQUAKE: RESET
  ============================================================== */

  const resetEarthquake = () => {
    /*
     * This is the ONLY operation that
     * removes the earthquake simulation.
     */

    setEarthquakeActive(false);

    setEarthquakePoint(null);

    setEarthquakePanelOpen(false);

    setEarthquakeMagnitude(
      DEFAULT_EARTHQUAKE_MAGNITUDE
    );

    setSelectedBuilding(null);
  };

  /* ==============================================================
     CHANGE DISASTER

     Flood and earthquake are deliberately
     isolated from one another.
  ============================================================== */

  const changeDisaster = (
    type: DisasterType
  ) => {
    setDisasterType(type);

    /*
     * Building popup belongs to whichever
     * simulation is currently active.
     */
    setSelectedBuilding(null);

    /*
     * Leaving earthquake removes its
     * temporary simulation state.
     */
    if (type !== "earthquake") {
      setEarthquakeActive(false);
      setEarthquakePoint(null);
      setEarthquakePanelOpen(false);

      setEarthquakeMagnitude(
        DEFAULT_EARTHQUAKE_MAGNITUDE
      );
    }

    /*
     * Flood state is preserved while switching
     * modes, but flood visuals/analysis disappear.
     *
     * This means if the user returns to Flood,
     * their previous flood depth is still there.
     */
  };

  /* ==============================================================
     SELECTED BUILDING DATA
  ============================================================== */

  const selectedProperties =
    selectedBuilding?.properties ?? {};

  const selectedBuildingName =
    String(
      selectedProperties.name ?? ""
    ).trim();

  const selectedBuildingType =
    String(
      selectedProperties.building ??
        "Unknown"
    )
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );

  const selectedLevels =
    selectedProperties[
      "building:levels"
    ] ??
    selectedProperties.levels ??
    null;

  const selectedStreet =
    String(
      selectedProperties[
        "addr:street"
      ] ??
        selectedProperties.street ??
        ""
    ).trim();

  const selectedFloodDepth =
    selectedBuilding
      ? Math.max(
          0,
          selectedBuilding.floodDepth
        )
      : 0;

  /* ==============================================================
     BUILDING STATUS

     FLOOD ONLY
  ============================================================== */

  let selectedRisk = "SAFE";

  let selectedRiskClass =
    "bg-green-400/10 text-green-300";

  if (selectedFloodDepth >= 0.6) {
    selectedRisk = "FLOODED";

    selectedRiskClass =
      "bg-red-400/10 text-red-300";
  } else if (
    selectedFloodDepth >= 0.35
  ) {
    selectedRisk = "HIGH RISK";

    selectedRiskClass =
      "bg-orange-400/10 text-orange-300";
  } else if (
    selectedFloodDepth >= 0.15
  ) {
    selectedRisk = "AT RISK";

    selectedRiskClass =
      "bg-yellow-400/10 text-yellow-300";
  }

  /* ================================================================
     RENDER
  ================================================================ */

  return (
    <div className="relative h-full w-full overflow-hidden">

      {/* ==========================================================
          3D CITY
      ========================================================== */}

      <Canvas
        camera={{
          position: [
            8,
            7,
            8,
          ],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 1.5]}
      >
        <Scene
          disasterType={
            disasterType
          }

          waterSurface={
            waterSurface
          }

          roadPaths={
            roadPaths
          }

          onBuildingSelect={
            setSelectedBuilding
          }

          earthquakePoint={
            disasterType ===
            "earthquake"
              ? earthquakePoint
              : null
          }

          earthquakeMagnitude={
            disasterType ===
            "earthquake"
              ? earthquakeMagnitude
              : 0
          }

          earthquakeActive={
            disasterType ===
            "earthquake"
              ? earthquakeActive
              : false
          }

          earthquakeSelectionMode={
            disasterType === "earthquake" &&
            !earthquakeActive &&
            !earthquakePanelOpen
          }

          onEarthquakePoint={
            handleEarthquakePoint
          }
        />
      </Canvas>

      {/* ==========================================================
          EARTHQUAKE PANEL

          Only visible in earthquake mode.
      ========================================================== */}

      {disasterType ===
        "earthquake" &&
        earthquakePanelOpen && (
          <EarthquakePanel
            point={
              earthquakePoint
            }
            active={
              earthquakeActive
            }
            magnitude={
              earthquakeMagnitude
            }
            onSimulate={
              handleEarthquakeSimulate
            }
            onCancel={
              cancelEarthquakePanel
            }
            onReset={
              resetEarthquake
            }
          />
        )}

      {/* ==========================================================
          EARTHQUAKE ACTIVE BAR
      ========================================================== */}

      {disasterType ===
        "earthquake" &&
        earthquakeActive &&
        !earthquakePanelOpen && (
          <div className="absolute right-6 top-6 z-30 flex items-center gap-2 rounded-xl border border-orange-400/20 bg-black/70 p-2 shadow-2xl backdrop-blur-xl">

            <div className="px-3 text-xs text-orange-200">
              Earthquake impact active · M
              {earthquakeMagnitude.toFixed(
                1
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setEarthquakeActive(false);
                setEarthquakePoint(null);
                setEarthquakePanelOpen(false);
                setSelectedBuilding(null);
              }}
              className="rounded-lg bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-400/20"
            >
              Change Epicenter
            </button>

            <button
              type="button"
              onClick={
                resetEarthquake
              }
              className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
            >
              Reset
            </button>
          </div>
        )}

      {/* ==========================================================
          SELECTED BUILDING PANEL
      ========================================================== */}

      {selectedBuilding && (
        <div className="absolute bottom-6 left-1/2 z-30 w-[390px] max-w-[calc(100%-32px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#050d15]/95 text-white shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl">

          {/* HEADER */}

          <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">

            <div className="min-w-0 pr-3">

              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                Selected Building
              </div>

              <div className="mt-1 truncate text-xl font-semibold">
                {selectedBuildingName ||
                  `Building #${
                    selectedBuilding.index +
                    1
                  }`}
              </div>

              <div className="mt-1 text-[11px] text-white/35">
                ID #
                {selectedBuilding.index +
                  1}
              </div>

              {disasterType ===
                "earthquake" && (
                <div className="mt-2 inline-flex rounded-full bg-orange-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-orange-300">
                  Earthquake inspection
                </div>
              )}

              {disasterType ===
                "flood" && (
                <div className="mt-2 inline-flex rounded-full bg-cyan-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-cyan-300">
                  Flood inspection
                </div>
              )}

            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedBuilding(
                  null
                )
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label="Close building information"
            >
              ✕
            </button>
          </div>

          {/* ======================================================
              FLOOD STATUS
          ====================================================== */}

          {disasterType ===
            "flood" && (
            <div className="px-5 pt-4">
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${selectedRiskClass}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-current" />

                  <span className="text-xs font-semibold">
                    {selectedRisk}
                  </span>
                </div>

                <span className="font-mono text-sm">
                  {selectedFloodDepth.toFixed(
                    2
                  )}{" "}
                  m
                </span>
              </div>
            </div>
          )}

          {/* ======================================================
              EARTHQUAKE STATUS
          ====================================================== */}

          {disasterType ===
            "earthquake" && (
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between rounded-xl bg-orange-400/10 px-3 py-2.5 text-orange-300">

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-current" />

                  <span className="text-xs font-semibold">
                    {earthquakeActive
                      ? "EARTHQUAKE IMPACT"
                      : earthquakePoint
                        ? "EPICENTER SELECTED"
                        : "SAFE"}
                  </span>
                </div>

                <span className="font-mono text-sm">
                  M
                  {earthquakeMagnitude.toFixed(
                    1
                  )}
                </span>

              </div>
            </div>
          )}

          {/* ======================================================
              BASIC DETAILS
          ====================================================== */}

          <div className="grid grid-cols-2 gap-2 p-5 pb-2">

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/35">
                Ground Elevation
              </div>

              <div className="mt-1 font-mono text-base">
                {selectedBuilding.terrainElevation.toFixed(
                  2
                )}{" "}
                m
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/35">
                Building Height
              </div>

              <div className="mt-1 font-mono text-base">
                {selectedBuilding.height.toFixed(
                  2
                )}{" "}
                m
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/35">
                Building Type
              </div>

              <div className="mt-1 truncate text-sm font-medium">
                {selectedBuildingType}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/35">
                Levels
              </div>

              <div className="mt-1 font-mono text-base">
                {selectedLevels !==
                null
                  ? String(
                      selectedLevels
                    )
                  : "—"}
              </div>
            </div>

          </div>

          {/* ======================================================
              FLOOD DETAILS
          ====================================================== */}

          {disasterType ===
            "flood" && (
            <div className="mx-5 rounded-xl bg-cyan-400/5 p-3">

              <div className="text-[10px] uppercase tracking-wider text-white/35">
                Current Flood Depth
              </div>

              <div className="mt-1 font-mono text-2xl text-cyan-300">
                {selectedFloodDepth.toFixed(
                  2
                )}{" "}
                m
              </div>

              <div className="mt-1 text-[10px] text-white/35">
                Water above building
                ground level
              </div>

            </div>
          )}

          {/* ======================================================
              EARTHQUAKE DETAILS
          ====================================================== */}

          {disasterType ===
            "earthquake" && (
            <div className="mx-5 rounded-xl bg-orange-400/5 p-3">

              <div className="text-[10px] uppercase tracking-wider text-white/35">
                Earthquake Magnitude
              </div>

              <div className="mt-1 font-mono text-2xl text-orange-300">
                M
                {earthquakeMagnitude.toFixed(
                  1
                )}
              </div>

              <div className="mt-1 text-[10px] text-white/35">
                {earthquakeActive
                  ? "Earthquake impact is active."
                  : "Simulation has not started yet."}
              </div>

            </div>
          )}

          {/* ======================================================
              LOCATION
          ====================================================== */}

          <div className="mt-3 border-t border-white/10 px-5 py-3">

            <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
              Location
            </div>

            <div className="grid grid-cols-2 gap-2">

              <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                <div className="text-[9px] text-white/30">
                  Latitude
                </div>

                <div className="mt-1 font-mono text-[11px] text-white/70">
                  {selectedBuilding.latitude.toFixed(
                    6
                  )}
                  ° N
                </div>
              </div>

              <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                <div className="text-[9px] text-white/30">
                  Longitude
                </div>

                <div className="mt-1 font-mono text-[11px] text-white/70">
                  {selectedBuilding.longitude.toFixed(
                    6
                  )}
                  ° E
                </div>
              </div>

            </div>

            {selectedStreet && (
              <div className="mt-2 truncate text-[10px] text-white/45">
                {selectedStreet}
              </div>
            )}

          </div>

          {/* ======================================================
              IMPACT ASSESSMENT
          ====================================================== */}

          <div className="border-t border-white/10 px-5 py-3">

            <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
              Impact Assessment
            </div>

            <div className="mt-2 text-[11px] leading-5 text-white/55">

              {disasterType ===
                "earthquake"
                ? earthquakeActive
                  ? "Earthquake impact is active. This building can be inspected to compare its location and response within the affected area."
                  : earthquakePoint
                    ? "Epicenter selected. Choose the magnitude and start the simulation."
                    : "Select an earthquake epicenter by clicking the map."
                : selectedFloodDepth >=
                    0.6
                  ? "Water has reached this building. Significant flood impact is detected."
                  : selectedFloodDepth >=
                      0.35
                    ? "Water is approaching this building. High flood risk is detected."
                    : selectedFloodDepth >=
                        0.15
                      ? "This building is close to the current flood level and should be monitored."
                      : "This building is currently above the simulated flood level."}

            </div>
          </div>

          <div className="border-t border-white/5 px-5 py-2.5 text-center text-[9px] text-white/25">
            Click another building to inspect it
          </div>

        </div>
      )}

      {/* ==========================================================
          LEFT CONTROL PANEL
      ========================================================== */}

      <div className="absolute left-6 top-6 z-20 w-80 rounded-2xl border border-white/10 bg-black/65 p-5 text-white shadow-2xl backdrop-blur-xl">

        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">
          Chennai Digital Twin
        </div>

        <h1 className="mt-1 text-2xl font-semibold">
          Disaster Simulation
        </h1>

        {/* ========================================================
            SIMULATION TYPE
        ======================================================== */}

        <div className="mt-6">

          <div className="mb-3 text-xs uppercase tracking-wider text-white/40">
            Simulation Type
          </div>

          <div className="grid grid-cols-3 gap-2">

            {/* RAIN */}

            <button
              type="button"
              onClick={() =>
                changeDisaster(
                  "rain"
                )
              }
              className={`rounded-xl border p-3 text-center transition ${
                disasterType ===
                "rain"
                  ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <div className="text-xl">
                🌧️
              </div>

              <div className="mt-1 text-xs">
                Rain
              </div>
            </button>

            {/* FLOOD */}

            <button
              type="button"
              onClick={() =>
                changeDisaster(
                  "flood"
                )
              }
              className={`rounded-xl border p-3 text-center transition ${
                disasterType ===
                "flood"
                  ? "border-blue-400/60 bg-blue-400/15 text-blue-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <div className="text-xl">
                🌊
              </div>

              <div className="mt-1 text-xs">
                Flood
              </div>
            </button>

            {/* EARTHQUAKE */}

            <button
              type="button"
              onClick={() =>
                changeDisaster(
                  "earthquake"
                )
              }
              className={`rounded-xl border p-3 text-center transition ${
                disasterType ===
                "earthquake"
                  ? "border-orange-400/60 bg-orange-400/15 text-orange-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              <div className="text-xl">
                🌎
              </div>

              <div className="mt-1 text-xs">
                Quake
              </div>
            </button>

          </div>
        </div>

        {/* ========================================================
            FLOOD CONTROL
        ======================================================== */}

        {disasterType ===
          "flood" && (
          <>

            <div className="mt-7 mb-3 flex items-center justify-between">

              <span className="text-base text-white/80">
                Flood Depth
              </span>

              <span className="font-mono text-xl text-cyan-300">
                {floodDepth.toFixed(
                  2
                )}{" "}
                m
              </span>

            </div>

            <input
              type="range"
              min="0"
              max={
                MAX_REAL_FLOOD_DEPTH
              }
              step="0.1"
              value={
                floodDepth
              }
              onChange={(event) => {
                setFloodDepth(
                  THREE.MathUtils.clamp(
                    Number(
                      event.target.value
                    ),
                    0,
                    MAX_REAL_FLOOD_DEPTH
                  )
                );
              }}
              className="h-2 w-full cursor-pointer accent-cyan-400"
            />

            <div className="mt-2 flex justify-between text-xs text-white/40">

              <span>
                0.0 m
              </span>

              <span>
                {MAX_REAL_FLOOD_DEPTH.toFixed(
                  1
                )}{" "}
                m
              </span>

            </div>

            <div className="mt-4 rounded-xl bg-cyan-400/5 p-3">

              <div className="text-xs text-white/40">
                Water Surface
              </div>

              <div className="mt-1 font-mono text-lg text-cyan-300">
                {waterSurface.toFixed(
                  2
                )}{" "}
                m elevation
              </div>

              <div className="mt-1 text-[11px] text-white/35">
                Relative flood depth:{" "}
                {floodDepth.toFixed(
                  2
                )}{" "}
                m
              </div>

            </div>

          </>
        )}

        {/* ========================================================
            RAIN
        ======================================================== */}

        {disasterType ===
          "rain" && (
          <div className="mt-6 rounded-xl bg-white/5 p-4">

            <div className="text-sm text-white/50">
              Current Scenario
            </div>

            <div className="mt-2 text-xl font-semibold text-cyan-300">
              Rainfall
            </div>

            <div className="mt-2 text-xs leading-5 text-white/45">
              Rainfall simulation
              is active across
              the city.
            </div>

          </div>
        )}

        {/* ========================================================
            EARTHQUAKE
        ======================================================== */}

        {disasterType ===
          "earthquake" && (
          <div className="mt-6 rounded-xl bg-orange-400/5 p-4">

            <div className="text-sm text-white/50">
              Earthquake
            </div>

            <div className="mt-2 text-xl font-semibold text-orange-300">
              {earthquakeActive
                ? `Magnitude ${earthquakeMagnitude.toFixed(
                    1
                  )}`
                : earthquakePoint
                  ? "Epicenter Selected"
                  : "Select Epicenter"}
            </div>

            <div className="mt-2 text-xs leading-5 text-white/45">

              {earthquakeActive
                ? "Earthquake impact is active. Building damage increases according to the simulation."
                : earthquakePoint
                  ? "Epicenter selected. Set the magnitude in the earthquake panel."
                  : "Click an area of the city to choose the earthquake epicenter."}

            </div>

            {earthquakePoint && (
              <div className="mt-3 grid grid-cols-2 gap-2">

                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[9px] text-white/30">
                    X
                  </div>

                  <div className="mt-1 font-mono text-xs text-orange-200">
                    {earthquakePoint.x.toFixed(
                      2
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[9px] text-white/30">
                    Z
                  </div>

                  <div className="mt-1 font-mono text-xs text-orange-200">
                    {earthquakePoint.z.toFixed(
                      2
                    )}
                  </div>
                </div>

              </div>
            )}

            {earthquakeActive && (
              <button
                type="button"
                onClick={
                  resetEarthquake
                }
                className="mt-4 w-full rounded-lg border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-400/20"
              >
                Reset Earthquake
              </button>
            )}

          </div>
        )}

        {/* ========================================================
            STATUS
        ======================================================== */}

        <div className="mt-6 grid grid-cols-2 gap-3">

          <div className="rounded-xl bg-white/5 p-3">

            <div className="text-sm text-white/50">
              Scenario
            </div>

            <div className="mt-1 text-lg font-semibold capitalize">
              {disasterType}
            </div>

          </div>

          {disasterType ===
            "flood" ? (
            <div className="rounded-xl bg-white/5 p-3">

              <div className="text-sm text-white/50">
                Flood Risk
              </div>

              <div
                className={`mt-1 text-xl font-semibold ${
                  floodStatus ===
                  "Severe"
                    ? "text-red-400"
                    : floodStatus ===
                        "High"
                      ? "text-orange-400"
                      : floodStatus ===
                          "Moderate"
                        ? "text-yellow-300"
                        : "text-green-400"
                }`}
              >
                {floodStatus}
              </div>

            </div>
          ) : (
            <div className="rounded-xl bg-white/5 p-3">

              <div className="text-sm text-white/50">
                Status
              </div>

              <div className="mt-1 text-xl font-semibold text-orange-300">
                {disasterType ===
                "earthquake"
                  ? earthquakeActive
                    ? "Active"
                    : "Ready"
                  : "Active"}
              </div>

            </div>
          )}

        </div>

        {/* ========================================================
            FLOOD SIMULATION LEVEL
        ======================================================== */}

        {disasterType ===
          "flood" && (
          <div className="mt-3 rounded-xl bg-white/5 p-3">

            <div className="text-sm text-white/50">
              Simulation Level
            </div>

            <div className="mt-1 text-xl font-semibold">
              {simulationLevel}%
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">

              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                style={{
                  width: `${simulationLevel}%`,
                }}
              />

            </div>

          </div>
        )}

        {/* ========================================================
            ROAD NETWORK
        ======================================================== */}

        <div className="mt-3 rounded-xl bg-white/5 p-3">

          <div className="text-sm text-white/50">
            Road Network
          </div>

          <div className="mt-1 text-xl font-semibold">
            {roadPaths.length.toLocaleString()}
          </div>

          <div className="text-xs text-white/40">
            usable road paths
          </div>

        </div>

        {/* ========================================================
            LIVE STATUS
        ======================================================== */}

        <div className="mt-3 flex items-center gap-2 text-xs text-white/40">

          <span
            className={`h-2 w-2 rounded-full ${
              disasterType ===
                "flood" &&
              analysisLoading
                ? "animate-pulse bg-yellow-400"
                : "bg-green-400"
            }`}
          />

          {disasterType ===
          "flood"
            ? analysisLoading
              ? "Updating flood analysis..."
              : "Flood simulation live"
            : disasterType ===
                "earthquake"
              ? earthquakeActive
                ? "Earthquake simulation live"
                : "Earthquake ready"
              : "Rain simulation live"}

        </div>

      </div>

      {/* ==========================================================
          FLOOD DASHBOARD
          NEVER RENDERED DURING EARTHQUAKE
      ========================================================== */}

      {disasterType ===
        "flood" && (
        <FloodDashboard
          waterLevel={
            waterSurface
          }
          totalBuildings={
            floodAnalysis.totalBuildings
          }
          floodedBuildings={
            floodAnalysis.floodedBuildings
          }
          atRiskBuildings={
            floodAnalysis.atRiskBuildings
          }
          totalRoads={
            floodAnalysis.totalRoads
          }
          affectedRoads={
            floodAnalysis.affectedRoads
          }
          affectedVehicles={0}
        />
      )}

    </div>
  );
}