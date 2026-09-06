"use client";

import {
  useMemo,
  useRef,
} from "react";

import {
  useFrame,
} from "@react-three/fiber";

import * as THREE from "three";

/* ================================================================
   PROPS
================================================================ */

type RainProps = {
  intensity?: number;
};

/* ================================================================
   CONSTANTS
================================================================ */

/*
 * Keep the number reasonable for performance.
 */
const DROP_COUNT = 700;

/*
 * Area covered by the rain.
 */
const AREA_SIZE = 11;

/*
 * Rain starts above the city.
 */
const RAIN_TOP = 6.5;

/*
 * Rain ends around the terrain.
 */
const RAIN_BOTTOM = 0;

/*
 * Length of each visible rain streak.
 */
const DROP_LENGTH = 0.18;

/*
 * Falling speed.
 */
const FALL_SPEED = 9;

/* ================================================================
   RAIN
================================================================ */

export default function Rain({
  intensity = 1,
}: RainProps) {

  /* ==============================================================
     GEOMETRY
  ============================================================== */

  const geometry =
    useMemo(() => {

      /*
       * Each rain drop is represented
       * by TWO vertices:
       *
       * top
       * bottom
       *
       * connected as a line.
       */

      const positions =
        new Float32Array(
          DROP_COUNT * 2 * 3
        );

      for (
        let i = 0;
        i < DROP_COUNT;
        i++
      ) {

        const x =
          (
            Math.random() -
            0.5
          ) *
          AREA_SIZE;

        const z =
          (
            Math.random() -
            0.5
          ) *
          AREA_SIZE;

        const y =
          RAIN_BOTTOM +
          Math.random() *
          (
            RAIN_TOP -
            RAIN_BOTTOM
          );

        /*
         * TOP of rain streak.
         */
        positions[
          i * 6
        ] = x;

        positions[
          i * 6 + 1
        ] = y;

        positions[
          i * 6 + 2
        ] = z;

        /*
         * BOTTOM of rain streak.
         */
        positions[
          i * 6 + 3
        ] = x;

        positions[
          i * 6 + 4
        ] =
          y -
          DROP_LENGTH;

        positions[
          i * 6 + 5
        ] = z;
      }

      const geo =
        new THREE.BufferGeometry();

      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(
          positions,
          3
        )
      );

      return geo;

    }, []);

  /* ==============================================================
     MATERIAL
  ============================================================== */

  const material =
    useMemo(() => {

      return new THREE.LineBasicMaterial({

        color:
          "#b9eaff",

        transparent:
          true,

        opacity:
          0.72,

        depthWrite:
          false,

        blending:
          THREE.AdditiveBlending,
      });

    }, []);

  /* ==============================================================
     REF
  ============================================================== */

  const rainRef =
    useRef<THREE.LineSegments>(
      null
    );

  /* ==============================================================
     ANIMATION
  ============================================================== */

  useFrame(
    (
      _state,
      delta
    ) => {

      if (
        !rainRef.current
      ) {
        return;
      }

      const position =
        rainRef.current
          .geometry
          .attributes
          .position as THREE.BufferAttribute;

      const array =
        position.array as
          Float32Array;

      /*
       * Rain speed changes with
       * intensity.
       */
      const speed =
        FALL_SPEED *
        Math.max(
          0.25,
          intensity
        );

      for (
        let i = 0;
        i < DROP_COUNT;
        i++
      ) {

        const topIndex =
          i * 6 + 1;

        const bottomIndex =
          i * 6 + 4;

        /*
         * Move both ends downward.
         */
        array[topIndex] -=
          speed * delta;

        array[bottomIndex] -=
          speed * delta;

        /*
         * If the drop reaches
         * the ground, respawn it.
         */
        if (
          array[bottomIndex] <=
          RAIN_BOTTOM
        ) {

          const x =
            (
              Math.random() -
              0.5
            ) *
            AREA_SIZE;

          const z =
            (
              Math.random() -
              0.5
            ) *
            AREA_SIZE;

          const y =
            RAIN_TOP +
            Math.random() * 2;

          /*
           * TOP
           */
          array[
            i * 6
          ] = x;

          array[
            i * 6 + 1
          ] = y;

          array[
            i * 6 + 2
          ] = z;

          /*
           * BOTTOM
           */
          array[
            i * 6 + 3
          ] = x;

          array[
            i * 6 + 4
          ] =
            y -
            DROP_LENGTH;

          array[
            i * 6 + 5
          ] = z;
        }
      }

      position.needsUpdate =
        true;
    }
  );

  /* ==============================================================
     RENDER
  ============================================================== */

  if (
    intensity <= 0.02
  ) {
    return null;
  }

  return (
    <lineSegments
      ref={rainRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}