"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";

import {
  decodeChennaiSRI,
} from "@/lib/rain/sriDecoder";

import type {
  RainfallGrid,
} from "@/lib/rain/radar";

import {
  TERRAIN_SIZE,
  MIN_LON,
  MAX_LON,
  MIN_LAT,
  MAX_LAT,
} from "@/lib/terrain";

/* ================================================================
   PROPS
================================================================ */

type RainRadarLayerProps = {
  visible?: boolean;
  opacity?: number;
  elevationOffset?: number;
  refreshKey?: number;
};

/* ================================================================
   IMD RAINFALL COLORS
================================================================ */

function rainfallColor(
  rainfall: number
): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  if (rainfall <= 0) {
    return {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    };
  }

  if (rainfall <= 0.1) {
    return {
      r: 20,
      g: 50,
      b: 180,
      a: 0.20,
    };
  }

  if (rainfall <= 0.2) {
    return {
      r: 20,
      g: 100,
      b: 220,
      a: 0.24,
    };
  }

  if (rainfall <= 0.4) {
    return {
      r: 20,
      g: 155,
      b: 235,
      a: 0.28,
    };
  }

  if (rainfall <= 0.8) {
    return {
      r: 70,
      g: 195,
      b: 240,
      a: 0.32,
    };
  }

  if (rainfall <= 1.6) {
    return {
      r: 130,
      g: 225,
      b: 245,
      a: 0.36,
    };
  }

  if (rainfall <= 3.2) {
    return {
      r: 245,
      g: 245,
      b: 220,
      a: 0.42,
    };
  }

  if (rainfall <= 6.3) {
    return {
      r: 255,
      g: 230,
      b: 20,
      a: 0.50,
    };
  }

  if (rainfall <= 12.6) {
    return {
      r: 255,
      g: 160,
      b: 0,
      a: 0.58,
    };
  }

  if (rainfall <= 25.1) {
    return {
      r: 245,
      g: 70,
      b: 20,
      a: 0.66,
    };
  }

  if (rainfall <= 50.1) {
    return {
      r: 220,
      g: 20,
      b: 10,
      a: 0.74,
    };
  }

  return {
    r: 150,
    g: 0,
    b: 0,
    a: 0.82,
  };
}

/* ================================================================
   FIND GRID INDEX
================================================================ */

function sampleGrid(
  grid: RainfallGrid,
  lon: number,
  lat: number
): number {
  const lonRange =
    grid.maxLon -
    grid.minLon;

  const latRange =
    grid.maxLat -
    grid.minLat;

  if (
    lonRange <= 0 ||
    latRange <= 0
  ) {
    return 0;
  }

  const nx =
    THREE.MathUtils.clamp(
      (lon - grid.minLon) /
        lonRange,
      0,
      1
    );

  const ny =
    THREE.MathUtils.clamp(
      (lat - grid.minLat) /
        latRange,
      0,
      1
    );

  const x =
    Math.round(
      nx *
        (grid.width - 1)
    );

  const y =
    Math.round(
      (1 - ny) *
        (grid.height - 1)
    );

  const index =
    y *
      grid.width +
    x;

  return Math.max(
    0,
    grid.values[index] ?? 0
  );
}

/* ================================================================
   CROP RADAR TO CITY
================================================================ */

function cropToCity(
  source: RainfallGrid,
  width = 160,
  height = 160
): RainfallGrid {
  const values =
    new Float32Array(
      width *
        height
    );

  for (
    let y = 0;
    y < height;
    y++
  ) {
    const v =
      height === 1
        ? 0
        : y /
          (height - 1);

    const lat =
      MAX_LAT -
      v *
        (
          MAX_LAT -
          MIN_LAT
        );

    for (
      let x = 0;
      x < width;
      x++
    ) {
      const u =
        width === 1
          ? 0
          : x /
            (width - 1);

      const lon =
        MIN_LON +
        u *
          (
            MAX_LON -
            MIN_LON
          );

      values[
        y *
          width +
        x
      ] =
        sampleGrid(
          source,
          lon,
          lat
        );
    }
  }

  return {
    width,
    height,
    values,

    minLon:
      MIN_LON,

    maxLon:
      MAX_LON,

    minLat:
      MIN_LAT,

    maxLat:
      MAX_LAT,

    units:
      source.units,

    observedAt:
      source.observedAt,

    source:
      source.source,

    radarId:
      source.radarId,
  };
}

/* ================================================================
   CREATE TEXTURE
================================================================ */

function createRainfallTexture(
  grid: RainfallGrid
): THREE.CanvasTexture | null {
  if (
    grid.width <= 0 ||
    grid.height <= 0
  ) {
    return null;
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    grid.width;

  canvas.height =
    grid.height;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    return null;
  }

  const imageData =
    context.createImageData(
      grid.width,
      grid.height
    );

  const pixels =
    imageData.data;

  for (
    let y = 0;
    y < grid.height;
    y++
  ) {
    for (
      let x = 0;
      x < grid.width;
      x++
    ) {
      const value =
        grid.values[
          y *
            grid.width +
          x
        ] ?? 0;

      const color =
        rainfallColor(
          value
        );

      const flippedY =
        grid.height -
        1 -
        y;

      const index =
        (
          flippedY *
            grid.width +
          x
        ) *
        4;

      pixels[index] =
        color.r;

      pixels[index + 1] =
        color.g;

      pixels[index + 2] =
        color.b;

      pixels[index + 3] =
        Math.round(
          color.a * 255
        );
    }
  }

  context.putImageData(
    imageData,
    0,
    0
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.minFilter =
    THREE.LinearFilter;

  texture.magFilter =
    THREE.LinearFilter;

  texture.wrapS =
    THREE.ClampToEdgeWrapping;

  texture.wrapT =
    THREE.ClampToEdgeWrapping;

  texture.needsUpdate =
    true;

  return texture;
}

/* ================================================================
   COMPONENT
================================================================ */

export default function RainRadarLayer({
  visible = true,
  opacity = 0.70,

  /*
   * IMPORTANT:
   *
   * Terrain visual elevation ranges roughly 0 -> 0.35.
   *
   * Defaulting to 0.38 puts the diagnostic rainfall layer
   * above the entire terrain instead of underneath it.
   */
  elevationOffset = 0.38,

  refreshKey = 0,
}: RainRadarLayerProps) {
  const [
    texture,
    setTexture,
  ] =
    useState<THREE.CanvasTexture | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  /* ==============================================================
     LOAD IMD SRI
  ============================================================== */

  useEffect(() => {
    let cancelled =
      false;

    const load =
      async () => {
        setLoading(
          true
        );

        setError(
          null
        );

        try {
          const radarGrid =
            await decodeChennaiSRI(
              "/radar/chennai-sri.jpg",
              {
                /*
                 * Current radar domain used by the
                 * prototype decoder.
                 */
                minLon: 80.0,
                maxLon: 81.0,

                minLat: 12.0,
                maxLat: 14.0,

                cropLeft: 0,
                cropTop: 0,

                cropRight: 0.74,
                cropBottom: 0.96,

                outputWidth: 300,
                outputHeight: 300,

                observedAt:
                  new Date().toISOString(),
              }
            );

          /*
           * IMPORTANT:
           *
           * Convert the much larger radar domain into
           * exactly the same geographic bounds as the
           * digital twin.
           */
          const cityGrid =
            cropToCity(
              radarGrid,
              160,
              160
            );

          const nextTexture =
            createRainfallTexture(
              cityGrid
            );

          if (
            cancelled
          ) {
            nextTexture?.dispose();

            return;
          }

          if (!nextTexture) {
            throw new Error(
              "Could not create rainfall texture."
            );
          }

          setTexture(
            nextTexture
          );
        } catch (
          loadError
        ) {
          if (
            cancelled
          ) {
            return;
          }

          setTexture(
            null
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Could not load IMD rainfall."
          );
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      };

    void load();

    return () => {
      cancelled =
        true;
    };
  }, [
    refreshKey,
  ]);

  /* ==============================================================
     CLEANUP
  ============================================================== */

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [
    texture,
  ]);

  /* ==============================================================
     SAFETY
  ============================================================== */

  if (!visible) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (error) {
    console.warn(
      "RainRadarLayer:",
      error
    );

    return null;
  }

  if (!texture) {
    return null;
  }

  /* ==============================================================
     RENDER

     Because the texture has already been cropped to:

       MIN_LON..MAX_LON
       MIN_LAT..MAX_LAT

     the plane can simply cover the exact same TERRAIN_SIZE.
  ============================================================== */

  return (
    <mesh
      position={[
        0,
        elevationOffset,
        0,
      ]}
      rotation={[
        -Math.PI / 2,
        0,
        0,
      ]}
      renderOrder={25}
      frustumCulled={false}
    >
      <planeGeometry
        args={[
          TERRAIN_SIZE,
          TERRAIN_SIZE,
          1,
          1,
        ]}
      />

      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}