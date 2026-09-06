"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

import {
  TERRAIN_SIZE,
  ELEVATION_SCALE,
} from "@/lib/terrain";

/* ================================================================
   CONSTANTS
================================================================ */

const MIN_ELEVATION = -6.208936;
const MAX_ELEVATION = 20.089691;

const WINDOW_COLOR = "#8fc9dc";

/*
 * Keep this low for performance.
 * Windows are only added to selected
 * taller buildings.
 */
const MAX_DETAILED_BUILDINGS = 90;

/* ================================================================
   TYPES
================================================================ */

type BuildingDetailsProps = {
  waterLevel?: number;
};

/* ================================================================
   TERRAIN SAMPLER
================================================================ */

function createTerrainSampler(
  image: HTMLImageElement
) {
  const canvas =
    document.createElement("canvas");

  canvas.width = image.width;
  canvas.height = image.height;

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

  const pixels =
    context.getImageData(
      0,
      0,
      image.width,
      image.height
    ).data;

  return {
    pixels,
    width: image.width,
    height: image.height,
  };
}

/* ================================================================
   TERRAIN HEIGHT
================================================================ */

function getTerrainHeight(
  x: number,
  z: number,
  sampler: ReturnType<
    typeof createTerrainSampler
  >
) {
  if (!sampler) {
    return {
      visual: 0,
      elevation: MIN_ELEVATION,
    };
  }

  const normalizedX =
    THREE.MathUtils.clamp(
      x / TERRAIN_SIZE + 0.5,
      0,
      1
    );

  const normalizedZ =
    THREE.MathUtils.clamp(
      z / TERRAIN_SIZE + 0.5,
      0,
      1
    );

  const pixelX =
    Math.round(
      normalizedX *
        (sampler.width - 1)
    );

  const pixelY =
    Math.round(
      (1 - normalizedZ) *
        (sampler.height - 1)
    );

  const index =
    (
      pixelY *
        sampler.width +
      pixelX
    ) * 4;

  const value =
    sampler.pixels[index] ?? 0;

  const normalizedHeight =
    value / 255;

  return {
    visual:
      normalizedHeight *
      ELEVATION_SCALE,

    elevation:
      MIN_ELEVATION +
      normalizedHeight *
        (
          MAX_ELEVATION -
          MIN_ELEVATION
        ),
  };
}

/* ================================================================
   WINDOW MATERIAL
================================================================ */

function WindowMaterial() {
  return (
    <meshStandardMaterial
      color={WINDOW_COLOR}
      emissive={WINDOW_COLOR}
      emissiveIntensity={0.18}
      roughness={0.25}
      metalness={0.1}
    />
  );
}

/* ================================================================
   BUILDING WINDOWS
================================================================ */

function BuildingWindows({
  position,
  width,
  depth,
  height,
  rotation,
  buildingIndex,
}: {
  position: [
    number,
    number,
    number
  ];

  width: number;
  depth: number;
  height: number;

  rotation: number;

  buildingIndex: number;
}) {

  /*
   * Only taller buildings get
   * actual windows.
   */

  if (height < 0.65) {
    return null;
  }

  /*
   * Number of floors.
   */

  const floors =
    Math.max(
      3,
      Math.min(
        10,
        Math.floor(
          height / 0.18
        )
      )
    );

  /*
   * Number of windows per side.
   */

  const columns =
    Math.max(
      2,
      Math.min(
        5,
        Math.floor(
          width / 0.10
        )
      )
    );

  const windows = [];

  const floorHeight =
    height / floors;

  const windowWidth =
    Math.min(
      0.035,
      width /
        (columns * 3)
    );

  const windowHeight =
    Math.min(
      0.055,
      floorHeight * 0.35
    );

  /*
   * Leave some buildings
   * with fewer windows.
   *
   * This gives visual variation.
   */

  const windowSkip =
    buildingIndex % 4 === 0
      ? 2
      : 1;

  /*
   * --------------------------------------------------------------
   * FRONT + BACK
   * --------------------------------------------------------------
   */

  for (
    let floor = 0;
    floor < floors;
    floor++
  ) {

    if (
      floor %
        windowSkip !==
      0
    ) {
      continue;
    }

    for (
      let column = 0;
      column < columns;
      column++
    ) {

      const x =
        (
          column -
          (columns - 1) / 2
        ) *
        (
          width /
          columns
        );

      const y =
        floor *
          floorHeight +
        floorHeight * 0.55;

      /*
       * Front.
       */

      windows.push(
        <mesh
          key={`front-${floor}-${column}`}
          position={[
            x,
            y,
            depth / 2 + 0.006,
          ]}
        >
          <planeGeometry
            args={[
              windowWidth,
              windowHeight,
            ]}
          />

          <WindowMaterial />
        </mesh>
      );

      /*
       * Back.
       */

      windows.push(
        <mesh
          key={`back-${floor}-${column}`}
          position={[
            x,
            y,
            -depth / 2 - 0.006,
          ]}
          rotation={[
            0,
            Math.PI,
            0,
          ]}
        >
          <planeGeometry
            args={[
              windowWidth,
              windowHeight,
            ]}
          />

          <WindowMaterial />
        </mesh>
      );
    }
  }

  /*
   * --------------------------------------------------------------
   * LEFT + RIGHT
   * --------------------------------------------------------------
   */

  const sideColumns =
    Math.max(
      2,
      Math.min(
        4,
        Math.floor(
          depth / 0.10
        )
      )
    );

  for (
    let floor = 0;
    floor < floors;
    floor++
  ) {

    if (
      floor %
        windowSkip !==
      0
    ) {
      continue;
    }

    for (
      let column = 0;
      column < sideColumns;
      column++
    ) {

      const z =
        (
          column -
          (sideColumns - 1) / 2
        ) *
        (
          depth /
          sideColumns
        );

      const y =
        floor *
          floorHeight +
        floorHeight * 0.55;

      /*
       * Right side.
       */

      windows.push(
        <mesh
          key={`right-${floor}-${column}`}
          position={[
            width / 2 + 0.006,
            y,
            z,
          ]}
          rotation={[
            0,
            Math.PI / 2,
            0,
          ]}
        >
          <planeGeometry
            args={[
              windowWidth,
              windowHeight,
            ]}
          />

          <WindowMaterial />
        </mesh>
      );

      /*
       * Left side.
       */

      windows.push(
        <mesh
          key={`left-${floor}-${column}`}
          position={[
            -width / 2 - 0.006,
            y,
            z,
          ]}
          rotation={[
            0,
            -Math.PI / 2,
            0,
          ]}
        >
          <planeGeometry
            args={[
              windowWidth,
              windowHeight,
            ]}
          />

          <WindowMaterial />
        </mesh>
      );
    }
  }

  return (
    <group
      position={position}
      rotation={[
        0,
        rotation,
        0,
      ]}
    >
      {windows}
    </group>
  );
}

/* ================================================================
   MAIN COMPONENT
================================================================ */

export default function BuildingDetails({
  waterLevel = MIN_ELEVATION,
}: BuildingDetailsProps) {

  /*
   * Same heightmap.
   *
   * IMPORTANT:
   * velachery-heightmap.png
   */

  const heightmap =
    useLoader(
      THREE.TextureLoader,
      "/velachery-heightmap.png"
    );

  /*
   * Terrain sampler.
   */

  const sampler =
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

  /*
   * Create selected buildings.
   *
   * These are intentionally
   * procedural so we don't create
   * thousands of objects.
   */

  const buildings =
    useMemo(() => {

      if (!sampler) {
        return [];
      }

      const result = [];

      /*
       * Fixed deterministic positions.
       */

      let seed = 12345;

      const random = () => {

        seed =
          (
            seed * 1664525 +
            1013904223
          ) %
          4294967296;

        return (
          seed /
          4294967296
        );
      };

      for (
        let i = 0;
        i <
        MAX_DETAILED_BUILDINGS;
        i++
      ) {

        /*
         * Spread buildings
         * across the city.
         */

        const x =
          (
            random() -
            0.5
          ) *
          TERRAIN_SIZE *
          0.78;

        const z =
          (
            random() -
            0.5
          ) *
          TERRAIN_SIZE *
          0.78;

        const terrain =
          getTerrainHeight(
            x,
            z,
            sampler
          );

        /*
         * Avoid very low areas.
         *
         * This keeps details
         * above the flood plane.
         */

        if (
          terrain.elevation <
          -1
        ) {
          continue;
        }

        /*
         * Different building
         * sizes.
         */

        const width =
          0.13 +
          random() * 0.18;

        const depth =
          0.11 +
          random() * 0.16;

        const height =
          0.75 +
          random() * 1.8;

        /*
         * Random orientation.
         */

        const rotation =
          Math.floor(
            random() * 4
          ) *
          (
            Math.PI / 2
          );

        /*
         * Small amount of variation.
         */

        const floodDepth =
          Math.max(
            0,
            waterLevel -
              terrain.elevation
          );

        result.push({
          x,
          z,

          y:
            terrain.visual +
            0.04,

          width,
          depth,
          height,

          rotation,

          floodDepth,

          index: i,
        });
      }

      return result;

    }, [
      sampler,
      waterLevel,
    ]);

  /*
   * --------------------------------------------------------------
   * RENDER
   * --------------------------------------------------------------
   */

  return (
    <group>

      {buildings.map(
        (building) => {

          /*
           * If deeply flooded,
           * hide the windows.
           */

          if (
            building.floodDepth >
            0.8
          ) {
            return null;
          }

          return (
            <BuildingWindows
              key={
                building.index
              }

              position={[
                building.x,
                building.y,
                building.z,
              ]}

              width={
                building.width
              }

              depth={
                building.depth
              }

              height={
                building.height
              }

              rotation={
                building.rotation
              }

              buildingIndex={
                building.index
              }
            />
          );
        }
      )}

    </group>
  );
}