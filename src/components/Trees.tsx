"use client";

import { useEffect, useMemo, useState } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

import {
  TERRAIN_SIZE,
  ELEVATION_SCALE,
} from "@/lib/terrain";

/* ================================================================
   CONSTANTS
================================================================ */

const TREE_COUNT = 450;

const MIN_ELEVATION = -6.208936;
const MAX_ELEVATION = 20.089691;

/*
 * Trees stay relatively small so they
 * don't hide the buildings.
 */
const MIN_TREE_HEIGHT = 0.12;
const MAX_TREE_HEIGHT = 0.30;

/*
 * Keep trees away from the outer edge.
 */
const TERRAIN_MARGIN = 0.35;

/* ================================================================
   TYPES
================================================================ */

type BuildingFeature = {
  type: "Feature";

  geometry:
    | {
        type: "Polygon";
        coordinates: number[][][];
      }
    | {
        type: "MultiPolygon";
        coordinates: number[][][][];
      };

  properties?: Record<
    string,
    unknown
  > | null;
};

type BuildingGeoJSON = {
  type: "FeatureCollection";
  features: BuildingFeature[];
};

type Polygon =
  number[][];

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

  const pixels =
    context.getImageData(
      0,
      0,
      image.width,
      image.height
    ).data;

  return {
    pixels,

    width:
      image.width,

    height:
      image.height,
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
      visualHeight: 0,
      elevation:
        MIN_ELEVATION,
    };
  }

  const normalizedX =
    THREE.MathUtils.clamp(
      x /
        TERRAIN_SIZE +
        0.5,
      0,
      1
    );

  const normalizedZ =
    THREE.MathUtils.clamp(
      z /
        TERRAIN_SIZE +
        0.5,
      0,
      1
    );

  const pixelX =
    Math.round(
      normalizedX *
        (
          sampler.width -
          1
        )
    );

  const pixelY =
    Math.round(
      (1 - normalizedZ) *
        (
          sampler.height -
          1
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

  return {
    visualHeight:
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
   POINT IN POLYGON
================================================================ */

function pointInPolygon(
  x: number,
  z: number,
  polygon: Polygon
) {
  let inside = false;

  for (
    let i = 0,
      j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const xi =
      polygon[i][0];

    const zi =
      polygon[i][1];

    const xj =
      polygon[j][0];

    const zj =
      polygon[j][1];

    const intersects =
      (
        zi > z
      ) !==
        (
          zj > z
        ) &&
      x <
        (
          (xj - xi) *
            (z - zi)) /
            (
              zj - zi
            ) +
          xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/* ================================================================
   GET BUILDING POLYGONS
================================================================ */

function getBuildingPolygons(
  data: BuildingGeoJSON
) {

  const polygons: Polygon[] =
    [];

  for (
    const feature of
      data.features
  ) {

    if (
      feature.geometry.type ===
      "Polygon"
    ) {

      const outer =
        feature.geometry
          .coordinates[0];

      if (
        outer &&
        outer.length >= 3
      ) {
        polygons.push(
          outer
        );
      }
    }

    if (
      feature.geometry.type ===
      "MultiPolygon"
    ) {

      for (
        const polygon of
          feature.geometry.coordinates
      ) {

        const outer =
          polygon[0];

        if (
          outer &&
          outer.length >= 3
        ) {
          polygons.push(
            outer
          );
        }
      }
    }
  }

  return polygons;
}

/* ================================================================
   TREE COMPONENT
================================================================ */

export default function Trees() {

  /*
   * IMPORTANT:
   * Use the exact same heightmap
   * as the terrain/buildings.
   */
  const heightmap =
    useLoader(
      THREE.TextureLoader,
      "/velachery-heightmap.png"
    );

  /* ==============================================================
     TERRAIN
  ============================================================== */

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

  /* ==============================================================
     BUILDING FOOTPRINTS
  ============================================================== */

  const [
    buildingPolygons,
    setBuildingPolygons,
  ] =
    useState<Polygon[]>([]);

  useEffect(() => {

    let cancelled = false;

    fetch(
      "/buildings.geojson"
    )
      .then(
        async (
          response
        ) => {

          if (
            !response.ok
          ) {
            throw new Error(
              "Unable to load buildings.geojson"
            );
          }

          return response.json();
        }
      )
      .then(
        (
          data: BuildingGeoJSON
        ) => {

          if (
            cancelled
          ) {
            return;
          }

          setBuildingPolygons(
            getBuildingPolygons(
              data
            )
          );
        }
      )
      .catch(
        (error) => {

          console.error(
            "Tree building-footprint error:",
            error
          );

        }
      );

    return () => {
      cancelled = true;
    };

  }, []);

  /* ==============================================================
     TREE POSITIONS
  ============================================================== */

  const treePositions =
    useMemo(() => {

      if (
        !sampler
      ) {
        return [];
      }

      /*
       * Deterministic random generator.
       * This means trees don't move
       * every time React renders.
       */

      let seed =
        928371;

      function random() {

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
      }

      const trees: {
        x: number;
        y: number;
        z: number;
        scale: number;
        rotation: number;
      }[] = [];

      let attempts = 0;

      /*
       * Try more positions than needed
       * because some positions are
       * rejected when inside buildings.
       */

      while (
        trees.length <
          TREE_COUNT &&
        attempts <
          TREE_COUNT * 12
      ) {

        attempts++;

        const x =
          (
            random() -
            0.5
          ) *
          (
            TERRAIN_SIZE -
            TERRAIN_MARGIN * 2
          );

        const z =
          (
            random() -
            0.5
          ) *
          (
            TERRAIN_SIZE -
            TERRAIN_MARGIN * 2
          );

        /* ----------------------------------------------------------
           DON'T PUT TREES INSIDE BUILDINGS
        ---------------------------------------------------------- */

        let insideBuilding =
          false;

        /*
         * Convert the world position
         * to a normalized coordinate
         * matching the building data.
         *
         * The OSM building coordinates
         * are already converted in
         * Buildings.tsx, so for this
         * check we use a world-space
         * approximation.
         *
         * Dense urban center receives
         * fewer trees naturally.
         */

        if (
          buildingPolygons.length >
          0
        ) {

          /*
           * Convert polygon longitude /
           * latitude coordinates into
           * the same world coordinates.
           */

          for (
            const polygon of
              buildingPolygons
          ) {

            /*
             * First calculate a rough
             * bounding box in normalized
             * terrain space.
             */

            let minX =
              Infinity;

            let maxX =
              -Infinity;

            let minZ =
              Infinity;

            let maxZ =
              -Infinity;

            for (
              const coordinate of
                polygon
            ) {

              const lon =
                coordinate[0];

              const lat =
                coordinate[1];

              /*
               * These values correspond
               * to the same map extent
               * used by terrain.ts.
               */

              const px =
                (
                  (
                    lon -
                    80.210972
                  ) /
                  (
                    80.229028 -
                    80.210972
                  ) -
                  0.5
                ) *
                TERRAIN_SIZE;

              const pz =
                -(
                  (
                    (
                      lat -
                      12.970972
                    ) /
                    (
                      12.989028 -
                      12.970972
                    )
                  ) -
                  0.5
                ) *
                TERRAIN_SIZE;

              minX =
                Math.min(
                  minX,
                  px
                );

              maxX =
                Math.max(
                  maxX,
                  px
                );

              minZ =
                Math.min(
                  minZ,
                  pz
                );

              maxZ =
                Math.max(
                  maxZ,
                  pz
                );
            }

            /*
             * Only perform the more
             * expensive polygon check
             * when inside the bounding
             * box.
             */

            if (
              x >= minX - 0.025 &&
              x <= maxX + 0.025 &&
              z >= minZ - 0.025 &&
              z <= maxZ + 0.025
            ) {

              const convertedPolygon =
                polygon.map(
                  (
                    coordinate
                  ) => {

                    const lon =
                      coordinate[0];

                    const lat =
                      coordinate[1];

                    const px =
                      (
                        (
                          lon -
                          80.210972
                        ) /
                        (
                          80.229028 -
                          80.210972
                        ) -
                        0.5
                      ) *
                      TERRAIN_SIZE;

                    const pz =
                      -(
                        (
                          (
                            lat -
                            12.970972
                          ) /
                          (
                            12.989028 -
                            12.970972
                          )
                        ) -
                        0.5
                      ) *
                      TERRAIN_SIZE;

                    return [
                      px,
                      pz,
                    ];
                  }
                );

              if (
                pointInPolygon(
                  x,
                  z,
                  convertedPolygon
                )
              ) {

                insideBuilding =
                  true;

                break;
              }
            }
          }
        }

        if (
          insideBuilding
        ) {
          continue;
        }

        /* ----------------------------------------------------------
           TERRAIN
        ---------------------------------------------------------- */

        const terrain =
          getTerrainHeight(
            x,
            z,
            sampler
          );

        /*
         * Avoid very low terrain
         * because those areas are more
         * likely to be water/floodplain.
         */

        if (
          terrain.elevation <
          -1.5
        ) {
          continue;
        }

        /* ----------------------------------------------------------
           TREE SIZE
        ---------------------------------------------------------- */

        const scale =
          MIN_TREE_HEIGHT +
          random() *
            (
              MAX_TREE_HEIGHT -
              MIN_TREE_HEIGHT
            );

        trees.push({
          x,

          y:
            terrain.visualHeight,

          z,

          scale,

          rotation:
            random() *
            Math.PI *
            2,
        });
      }

      return trees;

    }, [
      sampler,
      buildingPolygons,
    ]);

  /* ==============================================================
     INSTANCED TREE GEOMETRY
  ============================================================== */

  const treeGeometry =
    useMemo(() => {

      /*
       * Low-poly trunk.
       */

      const trunk =
        new THREE.CylinderGeometry(
          0.018,
          0.025,
          0.22,
          5
        );

      /*
       * Low-poly crown.
       */

      const crown =
        new THREE.IcosahedronGeometry(
          0.13,
          1
        );

      return {
        trunk,
        crown,
      };

    }, []);

  /* ==============================================================
     MATERIALS
  ============================================================== */

  const trunkMaterial =
    useMemo(() => {

      return new THREE.MeshStandardMaterial({
        color:
          "#5b3a24",

        roughness:
          1,

        metalness:
          0,
      });

    }, []);

  const crownMaterial =
    useMemo(() => {

      return new THREE.MeshStandardMaterial({
        color:
          "#3d8f45",

        roughness:
          0.9,

        metalness:
          0,
      });

    }, []);

  /* ==============================================================
     INSTANCED MESHES
  ============================================================== */

  const trunkMesh =
    useMemo(() => {

      if (
        treePositions.length ===
        0
      ) {
        return null;
      }

      const mesh =
        new THREE.InstancedMesh(
          treeGeometry.trunk,
          trunkMaterial,
          treePositions.length
        );

      mesh.instanceMatrix.setUsage(
        THREE.DynamicDrawUsage
      );

      const matrix =
        new THREE.Matrix4();

      const position =
        new THREE.Vector3();

      const rotation =
        new THREE.Euler();

      const scale =
        new THREE.Vector3();

      for (
        let i = 0;
        i <
        treePositions.length;
        i++
      ) {

        const tree =
          treePositions[i];

        position.set(
          tree.x,
          tree.y +
            tree.scale * 0.35,
          tree.z
        );

        rotation.set(
          0,
          tree.rotation,
          0
        );

        scale.set(
          tree.scale,
          tree.scale * 1.8,
          tree.scale
        );

        matrix.compose(
          position,
          new THREE.Quaternion()
            .setFromEuler(
              rotation
            ),
          scale
        );

        mesh.setMatrixAt(
          i,
          matrix
        );
      }

      mesh.instanceMatrix.needsUpdate =
        true;

      mesh.frustumCulled =
        true;

      return mesh;

    }, [
      treePositions,
      treeGeometry.trunk,
      trunkMaterial,
    ]);

  const crownMesh =
    useMemo(() => {

      if (
        treePositions.length ===
        0
      ) {
        return null;
      }

      const mesh =
        new THREE.InstancedMesh(
          treeGeometry.crown,
          crownMaterial,
          treePositions.length
        );

      mesh.instanceMatrix.setUsage(
        THREE.DynamicDrawUsage
      );

      const matrix =
        new THREE.Matrix4();

      const position =
        new THREE.Vector3();

      const scale =
        new THREE.Vector3();

      for (
        let i = 0;
        i <
        treePositions.length;
        i++
      ) {

        const tree =
          treePositions[i];

        position.set(
          tree.x,
          tree.y +
            tree.scale * 0.82,
          tree.z
        );

        const treeScale =
          tree.scale /
          0.25;

        scale.set(
          treeScale,
          treeScale,
          treeScale
        );

        matrix.compose(
          position,

          new THREE.Quaternion(),

          scale
        );

        mesh.setMatrixAt(
          i,
          matrix
        );
      }

      mesh.instanceMatrix.needsUpdate =
        true;

      mesh.frustumCulled =
        true;

      return mesh;

    }, [
      treePositions,
      treeGeometry.crown,
      crownMaterial,
    ]);

  /* ==============================================================
     RENDER
  ============================================================== */

  return (
    <group>

      {trunkMesh && (
        <primitive
          object={
            trunkMesh
          }
        />
      )}

      {crownMesh && (
        <primitive
          object={
            crownMesh
          }
        />
      )}

    </group>
  );
}