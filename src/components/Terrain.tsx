"use client";

import { useEffect, useMemo, useState } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

import {
  TERRAIN_SIZE,
  ELEVATION_SCALE,
  MIN_LON,
  MAX_LON,
  MIN_LAT,
  MAX_LAT,
} from "@/lib/terrain";

const SEGMENTS = 160;
const SATELLITE_SIZE = 1024;

/* ================================================================
   SATELLITE
================================================================ */

const SATELLITE_URL =
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
  `?bbox=${MIN_LON},${MIN_LAT},${MAX_LON},${MAX_LAT}` +
  `&bboxSR=4326` +
  `&imageSR=4326` +
  `&size=${SATELLITE_SIZE},${SATELLITE_SIZE}` +
  `&format=jpg` +
  `&transparent=false` +
  `&f=image`;

/* ================================================================
   GEOJSON TYPES
================================================================ */

type Coordinate = [number, number];

type GeoJSONGeometry =
  | {
      type: "Polygon";
      coordinates: Coordinate[][];
    }
  | {
      type: "MultiPolygon";
      coordinates: Coordinate[][][];
    };

type BuildingFeature = {
  type: "Feature";
  geometry: GeoJSONGeometry | null;
  properties?: Record<string, unknown>;
};

type BuildingGeoJSON = {
  type: "FeatureCollection";
  features: BuildingFeature[];
};

/* ================================================================
   GEO → THREE
================================================================ */

function lonToX(lon: number) {
  return (
    ((lon - MIN_LON) /
      (MAX_LON - MIN_LON) -
      0.5) *
    TERRAIN_SIZE
  );
}

function latToZ(lat: number) {
  return (
    -(
      (lat - MIN_LAT) /
        (MAX_LAT - MIN_LAT) -
      0.5
    ) *
    TERRAIN_SIZE
  );
}

/* ================================================================
   TERRAIN SAMPLER
================================================================ */

type TerrainSampler = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

function createTerrainSampler(
  image: HTMLImageElement
): TerrainSampler | null {
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
  sampler: TerrainSampler | null
) {
  if (!sampler) {
    return 0;
  }

  const normalizedX =
    THREE.MathUtils.clamp(
      x / TERRAIN_SIZE + 0.5,
      0,
      1
    );

  const normalizedZ =
    THREE.MathUtils.clamp(
      -z / TERRAIN_SIZE + 0.5,
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

  return (
    (value / 255) *
    ELEVATION_SCALE
  );
}

/* ================================================================
   POLYGON HELPERS
================================================================ */

function getPolygons(
  geometry: GeoJSONGeometry
): Coordinate[][][] {
  if (
    geometry.type ===
    "Polygon"
  ) {
    return [
      geometry.coordinates,
    ];
  }

  return geometry.coordinates;
}

function getCenter(
  ring: Coordinate[]
) {
  if (
    !ring ||
    ring.length === 0
  ) {
    return null;
  }

  let lon = 0;
  let lat = 0;

  for (const coordinate of ring) {
    lon += coordinate[0];
    lat += coordinate[1];
  }

  return {
    lon: lon / ring.length,
    lat: lat / ring.length,
  };
}

/* ================================================================
   CREATE FOOTPRINT GEOMETRY

   These are flat patches placed directly underneath
   the 3D buildings.

   Their purpose is to hide the real satellite rooftops.
================================================================ */

function createFootprintGeometry(
  geometry: GeoJSONGeometry,
  terrainSampler: TerrainSampler | null
) {
  const polygons =
    getPolygons(geometry);

  const geometries: THREE.BufferGeometry[] =
    [];

  for (const rings of polygons) {
    const outer = rings[0];

    if (
      !outer ||
      outer.length < 3
    ) {
      continue;
    }

    const center =
      getCenter(outer);

    if (!center) {
      continue;
    }

    const centerX =
      lonToX(center.lon);

    const centerZ =
      latToZ(center.lat);

    const shape =
      new THREE.Shape();

    for (
      let i = 0;
      i < outer.length;
      i++
    ) {
      const coordinate =
        outer[i];

      const x =
        lonToX(
          coordinate[0]
        ) - centerX;

      const y =
        latToZ(
          coordinate[1]
        ) - centerZ;

      if (i === 0) {
        shape.moveTo(
          x,
          y
        );
      } else {
        shape.lineTo(
          x,
          y
        );
      }
    }

    shape.closePath();

    /*
     * Holes
     */

    for (
      let r = 1;
      r < rings.length;
      r++
    ) {
      const holeRing =
        rings[r];

      if (
        !holeRing ||
        holeRing.length < 3
      ) {
        continue;
      }

      const hole =
        new THREE.Path();

      for (
        let i = 0;
        i < holeRing.length;
        i++
      ) {
        const coordinate =
          holeRing[i];

        const x =
          lonToX(
            coordinate[0]
          ) - centerX;

        const y =
          latToZ(
            coordinate[1]
          ) - centerZ;

        if (i === 0) {
          hole.moveTo(
            x,
            y
          );
        } else {
          hole.lineTo(
            x,
            y
          );
        }
      }

      hole.closePath();

      shape.holes.push(hole);
    }

    const geometry2 =
      new THREE.ShapeGeometry(
        shape
      );

    /*
     * ShapeGeometry is in XY.
     *
     * Rotate it onto XZ.
     */

    geometry2.rotateX(
      -Math.PI / 2
    );

    /*
     * Put the patch at the same
     * terrain height as the building.
     */

    const terrainHeight =
      getTerrainHeight(
        centerX,
        centerZ,
        terrainSampler
      );

    geometry2.translate(
      centerX,
      terrainHeight +
        0.006,
      centerZ
    );

    geometries.push(
      geometry2
    );
  }

  if (
    geometries.length === 0
  ) {
    return null;
  }

  /*
   * Merge all footprints into one
   * geometry for performance.
   */

  const merged =
    mergeBufferGeometries(
      geometries
    );

  geometries.forEach(
    (geometry) =>
      geometry.dispose()
  );

  return merged;
}

/* ================================================================
   SIMPLE GEOMETRY MERGER

   Avoids requiring BufferGeometryUtils.
================================================================ */

function mergeBufferGeometries(
  geometries: THREE.BufferGeometry[]
) {
  if (
    geometries.length === 0
  ) {
    return null;
  }

  if (
    geometries.length === 1
  ) {
    return geometries[0].clone();
  }

  const positions: number[] = [];
  const normals: number[] = [];

  for (const geometry of geometries) {
    const position =
      geometry.getAttribute(
        "position"
      );

    const normal =
      geometry.getAttribute(
        "normal"
      );

    for (
      let i = 0;
      i < position.count;
      i++
    ) {
      positions.push(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      );

      if (normal) {
        normals.push(
          normal.getX(i),
          normal.getY(i),
          normal.getZ(i)
        );
      }
    }
  }

  const merged =
    new THREE.BufferGeometry();

  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  if (
    normals.length > 0
  ) {
    merged.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        normals,
        3
      )
    );
  }

  return merged;
}

/* ================================================================
   TERRAIN
================================================================ */

export default function Terrain() {
  /* --------------------------------------------------------------
     HEIGHTMAP
  -------------------------------------------------------------- */

  const heightmap =
    useLoader(
      THREE.TextureLoader,
      "/velachery-heightmap.png"
    );

  /* --------------------------------------------------------------
     SATELLITE
  -------------------------------------------------------------- */

  const satelliteTexture =
    useLoader(
      THREE.TextureLoader,
      SATELLITE_URL
    );

  /* --------------------------------------------------------------
     BUILDING DATA
  -------------------------------------------------------------- */

  const [
    buildingData,
    setBuildingData,
  ] =
    useState<
      BuildingGeoJSON | null
    >(null);

  useEffect(() => {
    let cancelled = false;

    fetch(
      "/buildings.geojson"
    )
      .then(
        async (response) => {
          if (!response.ok) {
            throw new Error(
              `Could not load buildings.geojson: ${response.status}`
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

          setBuildingData(
            data
          );
        }
      )
      .catch((error) => {
        console.error(
          "Building footprint loading error:",
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* --------------------------------------------------------------
     TERRAIN SAMPLER
  -------------------------------------------------------------- */

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

  /* --------------------------------------------------------------
     TERRAIN GEOMETRY
  -------------------------------------------------------------- */

  const terrainGeometry =
    useMemo(() => {
      const image =
        heightmap.image as
          | HTMLImageElement
          | undefined;

      if (!image) {
        return null;
      }

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

      const pixels =
        context.getImageData(
          0,
          0,
          image.width,
          image.height
        ).data;

      const terrain =
        new THREE.PlaneGeometry(
          TERRAIN_SIZE,
          TERRAIN_SIZE,
          SEGMENTS,
          SEGMENTS
        );

      const positions =
        terrain.attributes.position;

      for (
        let i = 0;
        i < positions.count;
        i++
      ) {
        const x =
          positions.getX(i);

        const y =
          positions.getY(i);

        const normalizedX =
          THREE.MathUtils.clamp(
            x /
              TERRAIN_SIZE +
              0.5,
            0,
            1
          );

        const normalizedY =
          THREE.MathUtils.clamp(
            y /
              TERRAIN_SIZE +
              0.5,
            0,
            1
          );

        const pixelX =
          Math.round(
            normalizedX *
              (image.width - 1)
          );

        const pixelY =
          Math.round(
            (1 -
              normalizedY) *
              (image.height - 1)
          );

        const pixelIndex =
          (
            pixelY *
              image.width +
            pixelX
          ) * 4;

        const value =
          pixels[
            pixelIndex
          ] ?? 0;

        const terrainHeight =
          (value / 255) *
          ELEVATION_SCALE;

        positions.setZ(
          i,
          terrainHeight
        );
      }

      positions.needsUpdate =
        true;

      terrain.computeVertexNormals();

      return terrain;
    }, [heightmap]);

  /* --------------------------------------------------------------
     BUILDING FOOTPRINTS
  -------------------------------------------------------------- */

  const footprintGeometry =
    useMemo(() => {
      if (
        !buildingData ||
        !terrainSampler
      ) {
        return null;
      }

      const geometries: THREE.BufferGeometry[] =
        [];

      for (const feature of
        buildingData.features) {
        if (
          !feature.geometry
        ) {
          continue;
        }

        const geometry =
          createFootprintGeometry(
            feature.geometry,
            terrainSampler
          );

        if (geometry) {
          geometries.push(
            geometry
          );
        }
      }

      if (
        geometries.length ===
        0
      ) {
        return null;
      }

      const merged =
        mergeBufferGeometries(
          geometries
        );

      geometries.forEach(
        (geometry) =>
          geometry.dispose()
      );

      return merged;
    }, [
      buildingData,
      terrainSampler,
    ]);

  /* --------------------------------------------------------------
     SATELLITE CONFIG
  -------------------------------------------------------------- */

  useEffect(() => {
    satelliteTexture.colorSpace =
      THREE.SRGBColorSpace;

    satelliteTexture.wrapS =
      THREE.ClampToEdgeWrapping;

    satelliteTexture.wrapT =
      THREE.ClampToEdgeWrapping;

    satelliteTexture.minFilter =
      THREE.LinearMipmapLinearFilter;

    satelliteTexture.magFilter =
      THREE.LinearFilter;

    satelliteTexture.anisotropy = 4;

    satelliteTexture.needsUpdate =
      true;
  }, [
    satelliteTexture,
  ]);

  /* --------------------------------------------------------------
     SAFETY
  -------------------------------------------------------------- */

  if (
    !terrainGeometry
  ) {
    return null;
  }

  /* ================================================================
     RENDER
  ================================================================ */

  return (
    <group>
      {/* ============================================================
          SATELLITE GROUND
      ============================================================ */}

      <mesh
        geometry={
          terrainGeometry
        }
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        receiveShadow
      >
        <meshStandardMaterial
          map={
            satelliteTexture
          }
          color="#ffffff"
          roughness={0.95}
          metalness={0}
          side={
            THREE.DoubleSide
          }
        />
      </mesh>

      {/* ============================================================
          BUILDING FOOTPRINT MASKS

          These hide the real satellite rooftops.
          The actual 3D buildings are rendered by Buildings.tsx.
      ============================================================ */}

      {footprintGeometry && (
        <mesh
          geometry={
            footprintGeometry
          }
          renderOrder={2}
          receiveShadow
        >
          <meshStandardMaterial
            color="#59654f"
            roughness={1}
            metalness={0}
            side={
              THREE.DoubleSide
            }
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}
    </group>
  );
}