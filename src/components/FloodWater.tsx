"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

import {
  TERRAIN_SIZE,
  ELEVATION_SCALE,
  MIN_ELEVATION,
  MAX_ELEVATION,
  pixelToTerrainHeight,
} from "@/lib/terrain";

/*
 * FloodWater
 * ----------
 * Keeps the existing smooth animation, but changes the water
 * surface calculation so the visible flood is a clipped,
 * terrain-aware water surface instead of a rectangular sheet.
 *
 * IMPORTANT:
 * CityScene passes MIN_ELEVATION + realFloodDepth.
 */

const GRID_SIZE = 160;

const MAX_FLOOD_DEPTH = 6;

/*
 * This is the same visual flood reach used by Buildings.tsx
 * and floodAnalysis.ts.
 *
 * 0m -> MIN_ELEVATION
 * 6m -> MIN_ELEVATION + 17m (after the curve)
 */
const FLOOD_VISUAL_TERRAIN_RANGE = 17;
const FLOOD_REACH_EXPONENT = 0.55;

/* Smooth animation. */
const WATER_ANIMATION_SPEED = 5;

/*
 * Tiny numerical depths are treated as dry.
 */
const DRY_THRESHOLD = 0.003;

/*
 * Real elevation -> compressed Three.js elevation.
 */
const REAL_ELEVATION_RANGE =
  MAX_ELEVATION - MIN_ELEVATION;

const REAL_TO_VISUAL =
  ELEVATION_SCALE / REAL_ELEVATION_RANGE;

/* ================================================================
   TYPES
================================================================ */

type FloodWaterProps = {
  waterLevel: number;
};

type WaterSimulation = {
  terrainElevation: Float32Array;
  terrainVisualHeight: Float32Array;

  currentDepth: Float32Array;
  targetDepth: Float32Array;

  currentWaterSurfaceVisual: number;
  targetWaterSurfaceVisual: number;

  currentFloodElevation: number;
  targetFloodElevation: number;

  initialized: boolean;
};

/* ================================================================
   HEIGHTMAP
================================================================ */

function createTerrainData(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");

  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create heightmap canvas");
  }

  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(
    0,
    0,
    image.width,
    image.height
  );

  const terrainElevation = new Float32Array(
    GRID_SIZE * GRID_SIZE
  );

  const terrainVisualHeight = new Float32Array(
    GRID_SIZE * GRID_SIZE
  );

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const nx = col / (GRID_SIZE - 1);
      const nz = row / (GRID_SIZE - 1);

      const pixelX = Math.round(
        nx * (image.width - 1)
      );

      /*
       * Same orientation as lib/terrain.ts:
       *
       * world Z is flipped relative to the image.
       */
      const pixelY = Math.round(
        (1 - nz) * (image.height - 1)
      );

      const pixelIndex =
        (pixelY * image.width + pixelX) * 4;

      const pixelValue =
        imageData.data[pixelIndex] ?? 0;

      const normalized = pixelValue / 255;

      terrainElevation[
        row * GRID_SIZE + col
      ] =
        MIN_ELEVATION +
        normalized * REAL_ELEVATION_RANGE;

      terrainVisualHeight[
        row * GRID_SIZE + col
      ] =
        pixelToTerrainHeight(pixelValue);
    }
  }

  return {
    terrainElevation,
    terrainVisualHeight,
  };
}

/* ================================================================
   FLOOD CONVERSION
================================================================ */

function getFloodDepth(waterLevel: number) {
  if (!Number.isFinite(waterLevel)) {
    return 0;
  }

  /*
   * CityScene sends:
   *
   * MIN_ELEVATION + floodDepth
   */
  return THREE.MathUtils.clamp(
    waterLevel - MIN_ELEVATION,
    0,
    MAX_FLOOD_DEPTH
  );
}

function getFloodSurfaceElevation(
  floodDepth: number
) {
  const normalized = THREE.MathUtils.clamp(
    floodDepth / MAX_FLOOD_DEPTH,
    0,
    1
  );

  /*
   * Nonlinear reach matches the building colors.
   */
  const curved = Math.pow(
    normalized,
    FLOOD_REACH_EXPONENT
  );

  return (
    MIN_ELEVATION +
    curved * FLOOD_VISUAL_TERRAIN_RANGE
  );
}

function realElevationToVisual(
  elevation: number
) {
  const normalized = THREE.MathUtils.clamp(
    (elevation - MIN_ELEVATION) /
      REAL_ELEVATION_RANGE,
    0,
    1
  );

  return normalized * ELEVATION_SCALE;
}

/* ================================================================
   SIMULATION
================================================================ */

function createSimulation(
  terrainElevation: Float32Array,
  terrainVisualHeight: Float32Array
): WaterSimulation {
  return {
    terrainElevation,
    terrainVisualHeight,

    currentDepth: new Float32Array(
      GRID_SIZE * GRID_SIZE
    ),

    targetDepth: new Float32Array(
      GRID_SIZE * GRID_SIZE
    ),

    currentWaterSurfaceVisual: 0,
    targetWaterSurfaceVisual: 0,

    currentFloodElevation: MIN_ELEVATION,
    targetFloodElevation: MIN_ELEVATION,

    initialized: false,
  };
}

/* ================================================================
   TARGET WATER
================================================================ */

function updateTargetWater(
  simulation: WaterSimulation,
  floodDepth: number
) {
  const floodElevation =
    getFloodSurfaceElevation(floodDepth);

  const waterSurfaceVisual =
    realElevationToVisual(
      floodElevation
    );

  simulation.targetFloodElevation =
    floodElevation;

  simulation.targetWaterSurfaceVisual =
    waterSurfaceVisual;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index =
        row * GRID_SIZE + col;

      const terrainElevation =
        simulation.terrainElevation[index];

      /*
       * This is the REAL local flood depth.
       *
       * Most importantly, water exists only where
       * the flood surface is above the terrain.
       */
      const localDepth = Math.max(
        0,
        floodElevation - terrainElevation
      );

      simulation.targetDepth[index] =
        Math.min(
          MAX_FLOOD_DEPTH,
          localDepth
        );
    }
  }
}

/* ================================================================
   ANIMATION
================================================================ */

function animateWater(
  simulation: WaterSimulation,
  delta: number
) {
  const safeDelta = Math.min(delta, 0.05);

  const amount = Math.min(
    1,
    safeDelta * WATER_ANIMATION_SPEED
  );

  for (
    let i = 0;
    i < simulation.currentDepth.length;
    i++
  ) {
    simulation.currentDepth[i] =
      THREE.MathUtils.lerp(
        simulation.currentDepth[i],
        simulation.targetDepth[i],
        amount
      );
  }

  simulation.currentWaterSurfaceVisual =
    THREE.MathUtils.lerp(
      simulation.currentWaterSurfaceVisual,
      simulation.targetWaterSurfaceVisual,
      amount
    );

  simulation.currentFloodElevation =
    THREE.MathUtils.lerp(
      simulation.currentFloodElevation,
      simulation.targetFloodElevation,
      amount
    );
}

/* ================================================================
   GEOMETRY
================================================================ */

function createWaterGeometry(
  simulation: WaterSimulation
) {
  const geometry =
    new THREE.PlaneGeometry(
      TERRAIN_SIZE,
      TERRAIN_SIZE,
      GRID_SIZE - 1,
      GRID_SIZE - 1
    );

  const depthAttribute =
    new Float32Array(
      geometry.attributes.position.count
    );

  const terrainAttribute =
    new Float32Array(
      geometry.attributes.position.count
    );

  const positions =
    geometry.attributes.position;

  for (
    let i = 0;
    i < positions.count;
    i++
  ) {
    const x = positions.getX(i);
    const y = positions.getY(i);

    const col =
      THREE.MathUtils.clamp(
        Math.round(
          (x / TERRAIN_SIZE + 0.5) *
            (GRID_SIZE - 1)
        ),
        0,
        GRID_SIZE - 1
      );

    const row =
      THREE.MathUtils.clamp(
        Math.round(
          (-y / TERRAIN_SIZE + 0.5) *
            (GRID_SIZE - 1)
        ),
        0,
        GRID_SIZE - 1
      );

    const index =
      row * GRID_SIZE + col;

    depthAttribute[i] =
      simulation.currentDepth[index];

    terrainAttribute[i] =
      simulation.terrainVisualHeight[index];
  }

  geometry.setAttribute(
    "aWaterDepth",
    new THREE.BufferAttribute(
      depthAttribute,
      1
    )
  );

  geometry.setAttribute(
    "aTerrainHeight",
    new THREE.BufferAttribute(
      terrainAttribute,
      1
    )
  );

  return geometry;
}

function updateWaterGeometry(
  geometry: THREE.PlaneGeometry,
  simulation: WaterSimulation
) {
  const depthAttribute =
    geometry.getAttribute(
      "aWaterDepth"
    ) as THREE.BufferAttribute;

  const terrainAttribute =
    geometry.getAttribute(
      "aTerrainHeight"
    ) as THREE.BufferAttribute;

  for (
    let i = 0;
    i <
    geometry.attributes.position.count;
    i++
  ) {
    const x =
      geometry.attributes.position.getX(i);

    const y =
      geometry.attributes.position.getY(i);

    const col =
      THREE.MathUtils.clamp(
        Math.round(
          (x / TERRAIN_SIZE + 0.5) *
            (GRID_SIZE - 1)
        ),
        0,
        GRID_SIZE - 1
      );

    const row =
      THREE.MathUtils.clamp(
        Math.round(
          (-y / TERRAIN_SIZE + 0.5) *
            (GRID_SIZE - 1)
        ),
        0,
        GRID_SIZE - 1
      );

    const index =
      row * GRID_SIZE + col;

    const realDepth =
      simulation.currentDepth[index];

    depthAttribute.setX(
      i,
      realDepth
    );

    terrainAttribute.setX(
      i,
      simulation.terrainVisualHeight[index]
    );
  }

  depthAttribute.needsUpdate = true;
  terrainAttribute.needsUpdate = true;
}

/* ================================================================
   SHADERS
================================================================ */

const vertexShader = `
  uniform float uWaterSurfaceVisual;

  attribute float aWaterDepth;
  attribute float aTerrainHeight;

  varying float vWaterDepth;
  varying float vTerrainHeight;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vWaterDepth = aWaterDepth;
    vTerrainHeight = aTerrainHeight;

    vec3 transformed = position;

    /*
     * Water is a single flood surface.
     *
     * The surface is flat in world elevation,
     * while the fragment shader removes all
     * triangles/areas whose terrain is above it.
     */
    transformed.z =
      ${`0.0`} +
      uWaterSurfaceVisual;

    gl_Position =
      projectionMatrix *
      modelViewMatrix *
      vec4(transformed, 1.0);
  }
`;

const fragmentShader = `
  uniform float uWaterSurfaceVisual;

  varying float vWaterDepth;
  varying float vTerrainHeight;
  varying vec2 vUv;

  void main() {

    /*
     * No water where terrain is above the
     * current flood surface.
     *
     * The small margin prevents tiny gaps
     * caused by heightmap sampling.
     */
    if (
      vWaterDepth <
      ${DRY_THRESHOLD}
    ) {
      discard;
    }

    float depth =
      clamp(
        vWaterDepth / 2.0,
        0.0,
        1.0
      );

    vec3 shallow =
      vec3(
        0.02,
        0.55,
        0.82
      );

    vec3 deep =
      vec3(
        0.005,
        0.16,
        0.48
      );

    vec3 waterColor =
      mix(
        shallow,
        deep,
        depth
      );

    /*
     * Subtle animated movement.
     * This does not change flood coverage.
     */
    float wave1 =
      sin(
        vUv.x * 70.0 +
        vUv.y * 35.0
      );

    float wave2 =
      sin(
        vUv.x * 35.0 -
        vUv.y * 60.0
      );

    float waves =
      (wave1 + wave2) * 0.018;

    waterColor +=
      vec3(
        waves,
        waves,
        waves
      );

    float alpha =
      mix(
        0.58,
        0.84,
        depth
      );

    gl_FragColor =
      vec4(
        waterColor,
        alpha
      );
  }
`;

/* ================================================================
   COMPONENT
================================================================ */

export default function FloodWater({
  waterLevel,
}: FloodWaterProps) {
  const heightmap =
    useLoader(
      THREE.TextureLoader,
      "/velachery-heightmap.png"
    );

  const simulation =
    useMemo(() => {
      const image =
        heightmap.image as
          | HTMLImageElement
          | undefined;

      if (!image) {
        return null;
      }

      const {
        terrainElevation,
        terrainVisualHeight,
      } =
        createTerrainData(image);

      return createSimulation(
        terrainElevation,
        terrainVisualHeight
      );
    }, [heightmap]);

  useEffect(() => {
    if (!simulation) {
      return;
    }

    simulation.currentDepth.fill(0);
    simulation.targetDepth.fill(0);

    simulation.currentFloodElevation =
      MIN_ELEVATION;

    simulation.targetFloodElevation =
      MIN_ELEVATION;

    simulation.currentWaterSurfaceVisual =
      0;

    simulation.targetWaterSurfaceVisual =
      0;

    simulation.initialized = true;
  }, [simulation]);

  const geometry =
    useMemo(() => {
      if (!simulation) {
        return null;
      }

      return createWaterGeometry(
        simulation
      );
    }, [simulation]);

  const material =
    useMemo(() => {
      const mat =
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
          vertexShader,
          fragmentShader,
          uniforms: {
            uWaterSurfaceVisual: {
              value: 0,
            },
          },
        });

      return mat;
    }, []);

  const previousDepth =
    useRef<number>(Number.NaN);

  useFrame(
    (_state, delta) => {
      if (
        !simulation ||
        !geometry ||
        !simulation.initialized
      ) {
        return;
      }

      const floodDepth =
        getFloodDepth(waterLevel);

      if (
        floodDepth !==
        previousDepth.current
      ) {
        updateTargetWater(
          simulation,
          floodDepth
        );

        previousDepth.current =
          floodDepth;
      }

      animateWater(
        simulation,
        delta
      );

      updateWaterGeometry(
        geometry,
        simulation
      );

      material.uniforms
        .uWaterSurfaceVisual.value =
        simulation.currentWaterSurfaceVisual;
    }
  );

  if (!geometry) {
    return null;
  }

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[
        -Math.PI / 2,
        0,
        0,
      ]}
      renderOrder={5}
      frustumCulled={false}
    />
  );
}