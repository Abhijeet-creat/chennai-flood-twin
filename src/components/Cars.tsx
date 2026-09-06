"use client";

import {
  useMemo,
  useRef,
} from "react";

import {
  useFrame,
  useLoader,
} from "@react-three/fiber";

import * as THREE from "three";

import {
  ELEVATION_SCALE,
  worldToNormalized,
} from "@/lib/terrain";

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

type CarsProps = {
  paths?: RoadPath[];
  waterLevel?: number;
};

type CarState = {
  pathIndex: number;
  progress: number;
  direction: number;
};

/* ================================================================
   PERFORMANCE SETTINGS
================================================================ */

/*
 * Maximum number of cars in the scene.
 *
 * 30 = very light
 * 50 = balanced
 * 70 = heavier traffic
 */
const MAX_CARS = 50;

/*
 * How often car movement is updated.
 *
 * 1 = every frame
 * 2 = every second frame
 *
 * Using 1 keeps movement very smooth.
 */
const UPDATE_EVERY_N_FRAMES = 1;

/*
 * Flood thresholds.
 */
const FLOOD_SLOW_DEPTH = 0.15;
const FLOOD_VERY_SLOW_DEPTH = 0.35;
const FLOOD_STOP_DEPTH = 0.60;

/*
 * IMPORTANT:
 * Cars must use the SAME flood-surface mapping as
 * Buildings.tsx and FloodWater.tsx.
 *
 * The slider represents 0–6 m of REAL flood depth,
 * but the visible water surface is intentionally
 * spread over the terrain so that the flood can
 * reach the useful part of the city.
 */
const MIN_ELEVATION = -6.208936;
const MAX_FLOOD_DEPTH = 6;
const FLOOD_VISUAL_TERRAIN_RANGE = 17;
const FLOOD_REACH_EXPONENT = 0.55;

/*
 * Convert CityScene's absolute waterLevel into
 * the real 0–6 m flood depth.
 *
 * Examples:
 *   0 m  -> -6.208936
 *   6 m  -> -0.208936
 */
function getFloodDepth(
  waterLevel: number
): number {
  if (!Number.isFinite(waterLevel)) {
    return 0;
  }

  /*
   * CityScene normally passes:
   *
   * MIN_ELEVATION + floodDepth
   */
  const absoluteMin = MIN_ELEVATION;
  const absoluteMax =
    MIN_ELEVATION + MAX_FLOOD_DEPTH;

  if (
    waterLevel >= absoluteMin &&
    waterLevel <= absoluteMax
  ) {
    return THREE.MathUtils.clamp(
      waterLevel - MIN_ELEVATION,
      0,
      MAX_FLOOD_DEPTH
    );
  }

  /*
   * Also support a direct 0–6 value.
   */
  return THREE.MathUtils.clamp(
    waterLevel,
    0,
    MAX_FLOOD_DEPTH
  );
}

/*
 * Convert the real flood depth into the SAME
 * visual flood-surface elevation used by the
 * building/water system.
 */
function getFloodSurfaceElevation(
  floodDepth: number
): number {
  const normalized =
    THREE.MathUtils.clamp(
      floodDepth / MAX_FLOOD_DEPTH,
      0,
      1
    );

  const curved = Math.pow(
    normalized,
    FLOOD_REACH_EXPONENT
  );

  return (
    MIN_ELEVATION +
    curved * FLOOD_VISUAL_TERRAIN_RANGE
  );
}

/* ================================================================
   TERRAIN SAMPLER
================================================================ */

function createTerrainSampler(
  image: HTMLImageElement
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    image.width;

  canvas.height =
    image.height;

  const context =
    canvas.getContext(
      "2d"
    );

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
   ROAD FILTER
================================================================ */

function isDrivable(
  highway?: string
) {
  return (
    highway !== "footway" &&
    highway !== "path" &&
    highway !== "steps" &&
    highway !== "pedestrian" &&
    highway !== "cycleway"
  );
}

/* ================================================================
   ROAD SPEED
================================================================ */

function getRoadSpeed(
  highway?: string
) {
  switch (highway) {
    case "primary":
      return 0.0028;

    case "primary_link":
      return 0.0025;

    case "secondary":
      return 0.0023;

    case "tertiary":
      return 0.0020;

    case "residential":
      return 0.0015;

    case "living_street":
      return 0.0012;

    case "service":
      return 0.0009;

    default:
      return 0.0013;
  }
}

/* ================================================================
   POINT ON ROAD
================================================================ */

function getPointOnPath(
  points: Point[],
  progress: number
): Point {
  if (
    !points ||
    points.length === 0
  ) {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }

  if (
    points.length === 1
  ) {
    return points[0];
  }

  const p =
    THREE.MathUtils.clamp(
      progress,
      0,
      1
    );

  const scaled =
    p *
    (points.length - 1);

  const index =
    Math.floor(
      scaled
    );

  const nextIndex =
    Math.min(
      index + 1,
      points.length - 1
    );

  const local =
    scaled - index;

  const a =
    points[index];

  const b =
    points[nextIndex];

  return {
    x: THREE.MathUtils.lerp(
      a.x,
      b.x,
      local
    ),

    y: THREE.MathUtils.lerp(
      a.y ?? 0,
      b.y ?? 0,
      local
    ),

    z: THREE.MathUtils.lerp(
      a.z,
      b.z,
      local
    ),
  };
}

/* ================================================================
   FLOOD SPEED
================================================================ */

function getFloodSpeedMultiplier(
  depth: number
) {
  if (
    depth >=
    FLOOD_STOP_DEPTH
  ) {
    return 0;
  }

  if (
    depth >=
    FLOOD_VERY_SLOW_DEPTH
  ) {
    return 0.20;
  }

  if (
    depth >=
    FLOOD_SLOW_DEPTH
  ) {
    return 0.50;
  }

  return 1;
}

/* ================================================================
   COMPONENT
================================================================ */

export default function Cars({
  paths = [],
  waterLevel = -6,
}: CarsProps) {
  /*
   * ==============================================================
   * HEIGHTMAP
   * ==============================================================
   */

  const heightmap =
    useLoader(
      THREE.TextureLoader,
      "/velachery-heightmap.png"
    );

  /*
   * ==============================================================
   * TERRAIN SAMPLER
   * ==============================================================
   */

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
    }, [heightmap]);

  /*
   * ==============================================================
   * VALID ROAD PATHS
   * ==============================================================
   */

  const carPaths =
    useMemo(() => {
      if (
        !Array.isArray(paths)
      ) {
        return [];
      }

      const valid =
        paths.filter(
          (road) =>
            road &&
            Array.isArray(
              road.points
            ) &&
            road.points.length >=
              2 &&
            isDrivable(
              road.highway
            )
        );

      /*
       * Instead of one car every two roads,
       * evenly sample the roads to reach MAX_CARS.
       */

      if (
        valid.length <=
        MAX_CARS
      ) {
        return valid;
      }

      const result: RoadPath[] =
        [];

      const step =
        valid.length /
        MAX_CARS;

      for (
        let i = 0;
        i < MAX_CARS;
        i++
      ) {
        const road =
          valid[
            Math.floor(
              i * step
            )
          ];

        if (road) {
          result.push(
            road
          );
        }
      }

      return result;
    }, [paths]);

  /*
   * ==============================================================
   * CAR STATE
   * ==============================================================
   */

  const cars =
    useMemo<CarState[]>(
      () =>
        carPaths.map(
          (_, index) => ({
            pathIndex:
              index,

            /*
             * Spread cars around
             * the roads.
             */
            progress:
              (
                index *
                0.173
              ) %
              1,

            direction:
              index % 2 === 0
                ? 1
                : -1,
          })
        ),
      [carPaths]
    );

  /*
   * ==============================================================
   * INSTANCED MESH REFS
   * ==============================================================
   */

  const bodyRef =
    useRef<THREE.InstancedMesh>(
      null
    );

  const cabinRef =
    useRef<THREE.InstancedMesh>(
      null
    );

  const wheelRef =
    useRef<THREE.InstancedMesh>(
      null
    );

  /*
   * ==============================================================
   * SHARED GEOMETRIES
   * ==============================================================
   */

  const bodyGeometry =
    useMemo(
      () =>
        new THREE.BoxGeometry(
          0.13,
          0.065,
          0.28
        ),
      []
    );

  const cabinGeometry =
    useMemo(
      () =>
        new THREE.BoxGeometry(
          0.09,
          0.055,
          0.13
        ),
      []
    );

  const wheelGeometry =
    useMemo(
      () =>
        new THREE.CylinderGeometry(
          0.025,
          0.025,
          0.016,
          6
        ),
      []
    );

  /*
   * ==============================================================
   * SHARED MATERIALS
   * ==============================================================
   */

  const bodyMaterial =
    useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color:
            "#e63946",

          roughness:
            0.75,

          metalness:
            0.05,
        }),
      []
    );

  const cabinMaterial =
    useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color:
            "#dce6ec",

          roughness:
            0.5,
        }),
      []
    );

  const wheelMaterial =
    useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color:
            "#111111",

          roughness:
            0.9,
        }),
      []
    );

  /*
   * ==============================================================
   * ANIMATION
   * ==============================================================
   */

  const frameCounter =
    useRef(0);

  const dummy =
    useMemo(
      () =>
        new THREE.Object3D(),
      []
    );

  const tempColor =
    useMemo(
      () =>
        new THREE.Color(),
      []
    );

  useFrame(() => {
    if (
      !terrainSampler ||
      cars.length === 0
    ) {
      return;
    }

    frameCounter.current++;

    if (
      frameCounter.current %
        UPDATE_EVERY_N_FRAMES !==
      0
    ) {
      return;
    }

    for (
      let index = 0;
      index < cars.length;
      index++
    ) {
      const car =
        cars[index];

      const path =
        carPaths[
          car.pathIndex
        ];

      if (
        !path ||
        !path.points ||
        path.points.length <
          2
      ) {
        continue;
      }

      /*
       * Current position.
       */
      const current =
        getPointOnPath(
          path.points,
          car.progress
        );

      /*
       * Sample terrain.
       */
      const normalized =
        worldToNormalized(
          current.x,
          current.z
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
            (terrainSampler.width -
              1)
        );

      const pixelY =
        Math.round(
          (1 - nz) *
            (terrainSampler.height -
              1)
        );

      const pixelIndex =
        (
          pixelY *
            terrainSampler.width +
          pixelX
        ) * 4;

      const value =
        terrainSampler.pixels[
          pixelIndex
        ] ?? 0;

      const terrainHeight =
        (value / 255) *
        ELEVATION_SCALE;

      /*
       * ============================================================
       * FLOOD DEPTH
       * ============================================================
       *
       * DO NOT use:
       *
       *   waterLevel - terrainHeight
       *
       * directly here.
       *
       * CityScene's waterLevel is the absolute slider elevation,
       * while the visible flood is mapped non-linearly across the
       * terrain. Buildings.tsx uses that same mapping.
       *
       * Using the old formula made almost every car think it was
       * on dry land, even when the road was visibly underwater.
       */

      const realFloodDepth =
        getFloodDepth(
          waterLevel
        );

      const floodSurfaceElevation =
        getFloodSurfaceElevation(
          realFloodDepth
        );

      /*
       * Local water depth at THIS road position.
       *
       * terrainHeight and building terrainElevation use the
       * same heightmap/world scale, so this is directly
       * comparable with the flood surface.
       */
      const floodDepth =
        Math.max(
          0,
          floodSurfaceElevation -
            terrainHeight
        );

      const floodMultiplier =
        getFloodSpeedMultiplier(
          floodDepth
        );

      /*
       * Move car.
       */
      const speed =
        getRoadSpeed(
          path.highway
        ) *
        floodMultiplier;

      car.progress +=
        speed *
        car.direction;

      if (
        car.progress > 1
      ) {
        car.progress = 0;
      }

      if (
        car.progress < 0
      ) {
        car.progress = 1;
      }

      /*
       * Look slightly ahead.
       */
      let lookProgress =
        car.progress +
        0.008 *
          car.direction;

      if (
        lookProgress > 1
      ) {
        lookProgress -= 1;
      }

      if (
        lookProgress < 0
      ) {
        lookProgress += 1;
      }

      const next =
        getPointOnPath(
          path.points,
          lookProgress
        );

      const dx =
        next.x -
        current.x;

      const dz =
        next.z -
        current.z;

      const rotation =
        Math.atan2(
          dx,
          dz
        );

      /*
       * Car scale.
       */
      const scale =
        path.highway ===
        "primary"
          ? 0.82
          : path.highway ===
              "secondary"
            ? 0.70
            : path.highway ===
                "tertiary"
              ? 0.64
              : path.highway ===
                  "residential"
                ? 0.53
                : 0.48;

      /*
       * Position.
       */
      const y =
        terrainHeight +
        0.14;

      /*
       * =========================================================
       * BODY
       * =========================================================
       */

      dummy.position.set(
        current.x,
        y,
        current.z
      );

      dummy.rotation.set(
        0,
        rotation,
        0
      );

      dummy.scale.set(
        scale,
        scale,
        scale
      );

      dummy.updateMatrix();

      bodyRef.current?.setMatrixAt(
        index,
        dummy.matrix
      );

      /*
       * =========================================================
       * CABIN
       * =========================================================
       */

      dummy.position.set(
        current.x,
        y +
          0.055 *
            scale,
        current.z
      );

      dummy.rotation.set(
        0,
        rotation,
        0
      );

      dummy.scale.set(
        scale,
        scale,
        scale
      );

      dummy.updateMatrix();

      cabinRef.current?.setMatrixAt(
        index,
        dummy.matrix
      );

      /*
       * =========================================================
       * WHEELS
       * =========================================================
       *
       * Four wheels are still represented
       * by ONE InstancedMesh.
       */

      const wheelPositions = [
        [-0.072, -0.032, 0.08],
        [0.072, -0.032, 0.08],
        [-0.072, -0.032, -0.08],
        [0.072, -0.032, -0.08],
      ];

      for (
        let wheel = 0;
        wheel < 4;
        wheel++
      ) {
        const p =
          wheelPositions[
            wheel
          ];

        const localX =
          p[0] * scale;

        const localY =
          p[1] * scale;

        const localZ =
          p[2] * scale;

        const cos =
          Math.cos(
            rotation
          );

        const sin =
          Math.sin(
            rotation
          );

        const worldX =
          current.x +
          localX * cos -
          localZ * sin;

        const worldZ =
          current.z +
          localX * sin +
          localZ * cos;

        dummy.position.set(
          worldX,
          y + localY,
          worldZ
        );

        dummy.rotation.set(
          0,
          rotation,
          Math.PI / 2
        );

        dummy.scale.set(
          scale,
          scale,
          scale
        );

        dummy.updateMatrix();

        wheelRef.current?.setMatrixAt(
          index * 4 +
            wheel,
          dummy.matrix
        );
      }

      /*
       * =========================================================
       * FLOOD COLOR
       * =========================================================
       */

      if (
        bodyRef.current
      ) {
        if (
          floodDepth >=
          FLOOD_STOP_DEPTH
        ) {
          tempColor.set(
            "#555555"
          );
        } else if (
          floodDepth >=
          FLOOD_VERY_SLOW_DEPTH
        ) {
          tempColor.set(
            "#d97706"
          );
        } else {
          tempColor.set(
            "#e63946"
          );
        }

        bodyRef.current.setColorAt(
          index,
          tempColor
        );
      }
    }

    /*
     * Tell Three.js the instance
     * transforms changed.
     */
    if (
      bodyRef.current
    ) {
      bodyRef.current.instanceMatrix.needsUpdate =
        true;

      if (
        bodyRef.current.instanceColor
      ) {
        bodyRef.current.instanceColor.needsUpdate =
          true;
      }
    }

    if (
      cabinRef.current
    ) {
      cabinRef.current.instanceMatrix.needsUpdate =
        true;
    }

    if (
      wheelRef.current
    ) {
      wheelRef.current.instanceMatrix.needsUpdate =
        true;
    }
  });

  /*
   * ==============================================================
   * NO CARS
   * ==============================================================
   */

  if (
    carPaths.length === 0
  ) {
    return null;
  }

  /*
   * ==============================================================
   * RENDER
   * ==============================================================
   */

  return (
    <group>
      {/* BODY */}

      <instancedMesh
        ref={bodyRef}
        args={[
          bodyGeometry,
          bodyMaterial,
          carPaths.length,
        ]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      />

      {/* CABIN */}

      <instancedMesh
        ref={cabinRef}
        args={[
          cabinGeometry,
          cabinMaterial,
          carPaths.length,
        ]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      />

      {/* WHEELS */}

      <instancedMesh
        ref={wheelRef}
        args={[
          wheelGeometry,
          wheelMaterial,
          carPaths.length * 4,
        ]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      />
    </group>
  );
}