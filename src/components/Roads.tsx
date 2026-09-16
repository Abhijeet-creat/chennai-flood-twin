"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

import {
  ELEVATION_SCALE,
  worldToNormalized,
  MIN_ELEVATION,
  MAX_ELEVATION,
} from "@/lib/terrain";

/* ================================================================
   FLOOD CONFIGURATION
   ================================================================ */

const MAX_FLOOD_DEPTH = 6;

/*
 * This MUST match FloodWater.tsx and floodAnalysis.ts.
 *
 * 0m flood  -> MIN_ELEVATION
 * 6m flood  -> MIN_ELEVATION + 17m
 */
const FLOOD_VISUAL_TERRAIN_RANGE = 17;

/*
 * Same threshold used by floodAnalysis.ts.
 */
const ROAD_FLOOD_THRESHOLD = 0.03;

/*
 * Colors used during flood simulation.
 */
const SAFE_ROAD_COLOR = "#22c55e";
const AFFECTED_ROAD_COLOR = "#ef4444";

/* ================================================================
   TYPES
   ================================================================ */

type Point = {
  x: number;
  y?: number;
  z: number;
};

type RoadPath = {
  points?: Point[];
  highway?: string;
};

type RoadsProps = {
  paths?: RoadPath[];

  /*
   * Current simulated flood depth in metres.
   */
  floodDepth?: number;

  /*
   * Only show red/green flood status when
   * the Flood scenario is active.
   */
  floodMode?: boolean;
};

/* ================================================================
   ROAD WIDTH
   ================================================================ */

function getRoadWidth(
  highway?: string
): number {
  switch (highway) {
    case "motorway":
      return 0.14;

    case "trunk":
      return 0.13;

    case "primary":
      return 0.115;

    case "primary_link":
      return 0.10;

    case "secondary":
      return 0.09;

    case "tertiary":
      return 0.075;

    case "residential":
      return 0.052;

    case "living_street":
      return 0.048;

    case "service":
      return 0.038;

    case "footway":
      return 0.026;

    case "path":
      return 0.023;

    case "steps":
      return 0.023;

    default:
      return 0.052;
  }
}

/* ================================================================
   NORMAL ROAD COLOR
   ================================================================ */

function getRoadColor(
  highway?: string
): string {
  switch (highway) {
    case "motorway":
      return "#292a2d";

    case "trunk":
      return "#292a2d";

    case "primary":
      return "#303136";

    case "primary_link":
      return "#333438";

    case "secondary":
      return "#38393d";

    case "tertiary":
      return "#414247";

    case "residential":
      return "#505158";

    case "living_street":
      return "#5a5b60";

    case "service":
      return "#686966";

    case "footway":
      return "#777871";

    case "path":
      return "#85847a";

    case "steps":
      return "#7c7b72";

    default:
      return "#505158";
  }
}

/* ================================================================
   TERRAIN SAMPLER
   ================================================================ */

function createTerrainSampler(
  image: HTMLImageElement
) {
  const canvas =
    document.createElement("canvas");

  canvas.width =
    image.width;

  canvas.height =
    image.height;

  const context =
    canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(
    image,
    0,
    0
  );

  const imageData =
    context.getImageData(
      0,
      0,
      image.width,
      image.height
    );

  return {
    pixels:
      imageData.data,

    width:
      image.width,

    height:
      image.height,
  };
}

/* ================================================================
   TERRAIN HEIGHT USED BY 3D ROAD
   ================================================================ */

function getTerrainHeight(
  x: number,
  z: number,
  sampler: ReturnType<
    typeof createTerrainSampler
  >
): number {

  if (!sampler) {
    return 0;
  }

  const normalized =
    worldToNormalized(
      x,
      z
    );

  const nx =
    THREE.MathUtils.clamp(
      normalized.x,
      0,
      1
    );

  const nz =
    THREE.MathUtils.clamp(
      normalized.z,
      0,
      1
    );

  const pixelX =
    Math.round(
      nx *
      (
        sampler.width - 1
      )
    );

  const pixelY =
    Math.round(
      (
        1 - nz
      ) *
      (
        sampler.height - 1
      )
    );

  const pixelIndex =
    (
      pixelY *
      sampler.width +
      pixelX
    ) * 4;

  const value =
    sampler.pixels[
      pixelIndex
    ] ?? 0;

  return (
    value / 255
  ) * ELEVATION_SCALE;
}

/* ================================================================
   REAL TERRAIN ELEVATION
   ================================================================ */

/*
 * This is intentionally different from getTerrainHeight().
 *
 * getTerrainHeight() is the scaled 3D rendering height.
 *
 * This function uses the REAL elevation range used by
 * floodAnalysis.ts:
 *
 * MIN_ELEVATION → MAX_ELEVATION
 *
 * That allows road flood classification to use the same
 * elevation logic as the existing flood analysis.
 */

function getRealTerrainElevation(
  x: number,
  z: number,
  sampler: ReturnType<
    typeof createTerrainSampler
  >
): number {

  if (!sampler) {
    return MIN_ELEVATION;
  }

  const normalized =
    worldToNormalized(
      x,
      z
    );

  const nx =
    THREE.MathUtils.clamp(
      normalized.x,
      0,
      1
    );

  const nz =
    THREE.MathUtils.clamp(
      normalized.z,
      0,
      1
    );

  const pixelX =
    Math.round(
      nx *
      (
        sampler.width - 1
      )
    );

  const pixelY =
    Math.round(
      (
        1 - nz
      ) *
      (
        sampler.height - 1
      )
    );

  const pixelIndex =
    (
      pixelY *
      sampler.width +
      pixelX
    ) * 4;

  const value =
    sampler.pixels[
      pixelIndex
    ] ?? 0;

  const normalizedHeight =
    value / 255;

  return (
    MIN_ELEVATION +
    normalizedHeight *
    (
      MAX_ELEVATION -
      MIN_ELEVATION
    )
  );
}

/* ================================================================
   FLOOD ELEVATION
   ================================================================ */

function getFloodElevation(
  floodDepth: number
): number {

  const normalizedFlood =
    THREE.MathUtils.clamp(
      floodDepth /
      MAX_FLOOD_DEPTH,
      0,
      1
    );

  return (
    MIN_ELEVATION +
    normalizedFlood *
    FLOOD_VISUAL_TERRAIN_RANGE
  );
}

/* ================================================================
   ROAD AFFECTED CHECK
   ================================================================ */

/*
 * This follows the same basic logic as floodAnalysis.ts:
 *
 * - sample approximately 12 points
 * - get local terrain elevation
 * - compare it with the flood surface
 * - if any sampled point has > 0.03m water,
 *   the entire road is considered affected.
 */

function isRoadAffected(
  road: RoadPath,
  sampler: ReturnType<
    typeof createTerrainSampler
  >,
  floodElevation: number
): boolean {

  if (
    !road.points ||
    road.points.length < 2
  ) {
    return false;
  }

  const step =
    Math.max(
      1,
      Math.floor(
        road.points.length / 12
      )
    );

  for (
    let i = 0;
    i < road.points.length;
    i += step
  ) {

    const point =
      road.points[i];

    if (!point) {
      continue;
    }

    const elevation =
      getRealTerrainElevation(
        point.x,
        point.z,
        sampler
      );

    const localDepth =
      Math.max(
        0,
        floodElevation -
        elevation
      );

    if (
      localDepth >
      ROAD_FLOOD_THRESHOLD
    ) {
      return true;
    }
  }

  return false;
}

/* ================================================================
   ADD ROAD SEGMENT
   ================================================================ */

function addRoadSegment(
  positions: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  width: number
) {

  const direction =
    new THREE.Vector3()
      .subVectors(
        b,
        a
      );

  const length =
    direction.length();

  if (
    length < 0.002
  ) {
    return;
  }

  direction.normalize();

  const perpendicular =
    new THREE.Vector3(
      -direction.z,
      0,
      direction.x
    ).normalize();

  const halfWidth =
    width / 2;

  const extension =
    0.015;

  const start =
    a.clone().addScaledVector(
      direction,
      -extension
    );

  const end =
    b.clone().addScaledVector(
      direction,
      extension
    );

  const p1 =
    start.clone().addScaledVector(
      perpendicular,
      halfWidth
    );

  const p2 =
    start.clone().addScaledVector(
      perpendicular,
      -halfWidth
    );

  const p3 =
    end.clone().addScaledVector(
      perpendicular,
      -halfWidth
    );

  const p4 =
    end.clone().addScaledVector(
      perpendicular,
      halfWidth
    );

  const thickness =
    0.025;

  const baseIndex =
    positions.length / 3;

  /*
   * TOP
   */

  positions.push(
    p1.x,
    p1.y + thickness,
    p1.z,

    p2.x,
    p2.y + thickness,
    p2.z,

    p3.x,
    p3.y + thickness,
    p3.z,

    p4.x,
    p4.y + thickness,
    p4.z
  );

  /*
   * BOTTOM
   */

  positions.push(
    p1.x,
    p1.y,
    p1.z,

    p2.x,
    p2.y,
    p2.z,

    p3.x,
    p3.y,
    p3.z,

    p4.x,
    p4.y,
    p4.z
  );

  /*
   * TOP
   */

  indices.push(
    baseIndex + 0,
    baseIndex + 1,
    baseIndex + 2,

    baseIndex + 0,
    baseIndex + 2,
    baseIndex + 3
  );

  /*
   * BOTTOM
   */

  indices.push(
    baseIndex + 4,
    baseIndex + 6,
    baseIndex + 5,

    baseIndex + 4,
    baseIndex + 7,
    baseIndex + 6
  );

  /*
   * LEFT
   */

  indices.push(
    baseIndex + 0,
    baseIndex + 4,
    baseIndex + 5,

    baseIndex + 0,
    baseIndex + 5,
    baseIndex + 1
  );

  /*
   * RIGHT
   */

  indices.push(
    baseIndex + 3,
    baseIndex + 2,
    baseIndex + 6,

    baseIndex + 3,
    baseIndex + 6,
    baseIndex + 7
  );

  /*
   * START
   */

  indices.push(
    baseIndex + 0,
    baseIndex + 3,
    baseIndex + 7,

    baseIndex + 0,
    baseIndex + 7,
    baseIndex + 4
  );

  /*
   * END
   */

  indices.push(
    baseIndex + 1,
    baseIndex + 5,
    baseIndex + 6,

    baseIndex + 1,
    baseIndex + 6,
    baseIndex + 2
  );
}

/* ================================================================
   CREATE COMBINED ROAD GEOMETRY
   ================================================================ */

function createCombinedRoadGeometry(
  paths: RoadPath[],
  sampler: ReturnType<
    typeof createTerrainSampler
  >,
  highway: string,
  floodDepth: number,
  floodMode: boolean
) {

  const positions:
    number[] = [];

  const indices:
    number[] = [];

  const colors:
    number[] = [];

  const width =
    getRoadWidth(
      highway
    );

  const roadOffset =
    0.10;

  const floodElevation =
    getFloodElevation(
      floodDepth
    );

  /*
   * Convert the two flood colors to THREE colors.
   */

  const safeColor =
    new THREE.Color(
      SAFE_ROAD_COLOR
    );

  const affectedColor =
    new THREE.Color(
      AFFECTED_ROAD_COLOR
    );

  const normalColor =
    new THREE.Color(
      getRoadColor(
        highway
      )
    );

  for (
    const road of paths
  ) {

    if (
      road.highway !==
      highway
    ) {
      continue;
    }

    if (
      !Array.isArray(
        road.points
      ) ||
      road.points.length < 2
    ) {
      continue;
    }

    /*
     * Determine whether THIS road is affected.
     *
     * Important:
     * The complete road becomes red if any sampled
     * part of that road is affected.
     */

    const affected =
      floodMode &&
      isRoadAffected(
        road,
        sampler,
        floodElevation
      );

    const roadColor =
      floodMode
        ? (
            affected
              ? affectedColor
              : safeColor
          )
        : normalColor;

    for (
      let i = 0;
      i <
      road.points.length - 1;
      i++
    ) {

      const current =
        road.points[i];

      const next =
        road.points[i + 1];

      if (
        !current ||
        !next
      ) {
        continue;
      }

      const terrainY1 =
        getTerrainHeight(
          current.x,
          current.z,
          sampler
        );

      const terrainY2 =
        getTerrainHeight(
          next.x,
          next.z,
          sampler
        );

      const a =
        new THREE.Vector3(
          current.x,
          terrainY1 +
          roadOffset,
          current.z
        );

      const b =
        new THREE.Vector3(
          next.x,
          terrainY2 +
          roadOffset,
          next.z
        );

      const before =
        positions.length / 3;

      addRoadSegment(
        positions,
        indices,
        a,
        b,
        width
      );

      /*
       * addRoadSegment creates 8 vertices.
       *
       * Give every vertex of this segment
       * the same road status color.
       */

      const after =
        positions.length / 3;

      const verticesAdded =
        after - before;

      for (
        let v = 0;
        v < verticesAdded;
        v++
      ) {
        colors.push(
          roadColor.r,
          roadColor.g,
          roadColor.b
        );
      }
    }
  }

  if (
    positions.length === 0
  ) {
    return null;
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      colors,
      3
    )
  );

  geometry.setIndex(
    indices
  );

  geometry.computeVertexNormals();

  geometry.computeBoundingSphere();

  return geometry;
}

/* ================================================================
   ROAD MARKINGS
   ================================================================ */

function createRoadMarkingGeometry(
  paths: RoadPath[],
  sampler: ReturnType<
    typeof createTerrainSampler
  >,
  highway: string
) {

  const major =
    highway === "primary" ||
    highway === "secondary" ||
    highway === "trunk";

  if (!major) {
    return null;
  }

  const positions:
    number[] = [];

  const indices:
    number[] = [];

  const lineWidth =
    0.012;

  const offset =
    0.106;

  for (
    const road of paths
  ) {

    if (
      road.highway !==
      highway
    ) {
      continue;
    }

    if (
      !road.points ||
      road.points.length < 2
    ) {
      continue;
    }

    for (
      let i = 0;
      i <
      road.points.length - 1;
      i++
    ) {

      const current =
        road.points[i];

      const next =
        road.points[i + 1];

      if (
        !current ||
        !next
      ) {
        continue;
      }

      const direction =
        new THREE.Vector3()
          .subVectors(
            new THREE.Vector3(
              next.x,
              0,
              next.z
            ),
            new THREE.Vector3(
              current.x,
              0,
              current.z
            )
          );

      const length =
        direction.length();

      if (
        length < 0.03
      ) {
        continue;
      }

      direction.normalize();

      const segmentLength =
        length * 0.55;

      const startDistance =
        length * 0.22;

      const start =
        new THREE.Vector3(
          current.x,
          0,
          current.z
        ).addScaledVector(
          direction,
          startDistance
        );

      const end =
        start.clone().addScaledVector(
          direction,
          segmentLength
        );

      const y1 =
        getTerrainHeight(
          start.x,
          start.z,
          sampler
        );

      const y2 =
        getTerrainHeight(
          end.x,
          end.z,
          sampler
        );

      const perpendicular =
        new THREE.Vector3(
          -direction.z,
          0,
          direction.x
        ).normalize();

      const half =
        lineWidth / 2;

      const p1 =
        start
          .clone()
          .addScaledVector(
            perpendicular,
            half
          );

      const p2 =
        start
          .clone()
          .addScaledVector(
            perpendicular,
            -half
          );

      const p3 =
        end
          .clone()
          .addScaledVector(
            perpendicular,
            -half
          );

      const p4 =
        end
          .clone()
          .addScaledVector(
            perpendicular,
            half
          );

      p1.y =
        y1 + offset;

      p2.y =
        y1 + offset;

      p3.y =
        y2 + offset;

      p4.y =
        y2 + offset;

      const base =
        positions.length / 3;

      positions.push(
        p1.x,
        p1.y,
        p1.z,

        p2.x,
        p2.y,
        p2.z,

        p3.x,
        p3.y,
        p3.z,

        p4.x,
        p4.y,
        p4.z
      );

      indices.push(
        base,
        base + 1,
        base + 2,

        base,
        base + 2,
        base + 3
      );
    }
  }

  if (
    positions.length === 0
  ) {
    return null;
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setIndex(
    indices
  );

  geometry.computeVertexNormals();

  return geometry;
}

/* ================================================================
   ROADS
   ================================================================ */

export default function Roads({
  paths = [],
  floodDepth = 0,
  floodMode = false,
}: RoadsProps) {

  /*
   * Load the SAME heightmap used by
   * terrain/buildings/flood analysis.
   */

  const heightmap =
    useLoader(
      THREE.TextureLoader,
      "/velachery-heightmap.png"
    );

  /* ==============================================================
     TERRAIN SAMPLER
     ============================================================== */

  const terrainSampler =
    useMemo(() => {

      const image =
        heightmap.image as
          | HTMLImageElement
          | undefined;

      if (!image) {
        return null;
      }

      return createTerrainSampler(
        image
      );

    }, [
      heightmap,
    ]);

  /* ==============================================================
     ROAD TYPES
     ============================================================== */

  const roadTypes =
    useMemo(() => {

      const types =
        new Set<string>();

      for (
        const road of paths
      ) {

        if (
          road?.highway
        ) {
          types.add(
            road.highway
          );
        }
      }

      return Array.from(
        types
      );

    }, [
      paths,
    ]);

  /* ==============================================================
     ROAD GEOMETRIES
     ============================================================== */

  const roadGeometries =
    useMemo(() => {

      if (
        !terrainSampler
      ) {
        return [];
      }

      const result:
        Array<{
          type: string;
          geometry:
            THREE.BufferGeometry;
        }> = [];

      for (
        const type of roadTypes
      ) {

        const geometry =
          createCombinedRoadGeometry(
            paths,
            terrainSampler,
            type,
            floodDepth,
            floodMode
          );

        if (!geometry) {
          continue;
        }

        result.push({
          type,
          geometry,
        });
      }

      return result;

    }, [
      paths,
      terrainSampler,
      roadTypes,
      floodDepth,
      floodMode,
    ]);

  /* ==============================================================
     ROAD MARKINGS
     ============================================================== */

  const markingGeometries =
    useMemo(() => {

      if (
        !terrainSampler
      ) {
        return [];
      }

      const result:
        Array<{
          type: string;
          geometry:
            THREE.BufferGeometry;
        }> = [];

      for (
        const type of roadTypes
      ) {

        const geometry =
          createRoadMarkingGeometry(
            paths,
            terrainSampler,
            type
          );

        if (!geometry) {
          continue;
        }

        result.push({
          type,
          geometry,
        });
      }

      return result;

    }, [
      paths,
      terrainSampler,
      roadTypes,
    ]);

  /* ==============================================================
     ROAD MATERIAL
     ============================================================== */

  const roadMaterial =
    useMemo(() => {

      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0,
        side: THREE.FrontSide,
      });

    }, []);

  /* ==============================================================
     MARKING MATERIAL
     ============================================================== */

  const markingMaterial =
    useMemo(() => {

      return new THREE.MeshStandardMaterial({
        color: "#e7d88a",
        roughness: 0.9,
        metalness: 0,
        side: THREE.FrontSide,
      });

    }, []);

  /* ==============================================================
     RENDER
     ============================================================== */

  return (
    <group>

      {/* ==========================================================
          ROAD SURFACES
      ========================================================== */}

      {roadGeometries.map(
        (road) => {

          return (
            <mesh
              key={road.type}
              geometry={
                road.geometry
              }
              material={
                roadMaterial
              }
              receiveShadow
              castShadow={false}
            />
          );
        }
      )}

      {/* ==========================================================
          ROAD MARKINGS
      ========================================================== */}

      {markingGeometries.map(
        (marking) => (

          <mesh
            key={
              `marking-${marking.type}`
            }
            geometry={
              marking.geometry
            }
            material={
              markingMaterial
            }
            receiveShadow={false}
            castShadow={false}
          />

        )
      )}

    </group>
  );
}