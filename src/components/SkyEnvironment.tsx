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
   TYPES
================================================================ */

type SkyMode =
  | "clear"
  | "rain"
  | "flood"
  | "earthquake";

type SkyEnvironmentProps = {
  mode?: SkyMode;

  /*
   * 0 = midnight
   * 6 = sunrise
   * 12 = noon
   * 18 = sunset
   * 24 = midnight
   */
  timeOfDay?: number;
};

/* ================================================================
   CONSTANTS
================================================================ */

const SKY_DISTANCE = 30;

const SUN_DISTANCE = 18;

const CLOUD_HEIGHT = 9;

/* ================================================================
   CLOUD
================================================================ */

function Cloud({
  position,
  scale = 1,
}: {
  position: [
    number,
    number,
    number
  ];

  scale?: number;
}) {
  return (
    <group
      position={position}
      scale={scale}
    >
      {/* Main cloud */}

      <mesh position={[0, 0, 0]}>
        <sphereGeometry
          args={[
            0.75,
            8,
            6,
          ]}
        />

        <meshStandardMaterial
          color="#d9e6ef"
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Left */}

      <mesh
        position={[
          -0.7,
          -0.05,
          0,
        ]}
      >
        <sphereGeometry
          args={[
            0.5,
            8,
            6,
          ]}
        />

        <meshStandardMaterial
          color="#d9e6ef"
          roughness={1}
        />
      </mesh>

      {/* Right */}

      <mesh
        position={[
          0.7,
          -0.05,
          0,
        ]}
      >
        <sphereGeometry
          args={[
            0.55,
            8,
            6,
          ]}
        />

        <meshStandardMaterial
          color="#d9e6ef"
          roughness={1}
        />
      </mesh>

      {/* Top */}

      <mesh
        position={[
          0.15,
          0.35,
          0,
        ]}
      >
        <sphereGeometry
          args={[
            0.55,
            8,
            6,
          ]}
        />

        <meshStandardMaterial
          color="#e7f0f5"
          roughness={1}
        />
      </mesh>
    </group>
  );
}

/* ================================================================
   CLOUD FIELD
================================================================ */

function Clouds({
  storm,
}: {
  storm: boolean;
}) {
  const group =
    useRef<THREE.Group>(
      null
    );

  /*
   * Cloud positions are created once.
   */
  const clouds =
    useMemo(() => {

      return [
        {
          position: [
            -9,
            CLOUD_HEIGHT,
            -8,
          ] as [
            number,
            number,
            number
          ],
          scale: 1.6,
        },

        {
          position: [
            -4,
            CLOUD_HEIGHT + 1,
            -4,
          ] as [
            number,
            number,
            number
          ],
          scale: 1.2,
        },

        {
          position: [
            2,
            CLOUD_HEIGHT + 0.5,
            -7,
          ] as [
            number,
            number,
            number
          ],
          scale: 1.8,
        },

        {
          position: [
            7,
            CLOUD_HEIGHT + 1,
            -3,
          ] as [
            number,
            number,
            number
          ],
          scale: 1.4,
        },

        {
          position: [
            -7,
            CLOUD_HEIGHT + 2,
            3,
          ] as [
            number,
            number,
            number
          ],
          scale: 1.3,
        },

        {
          position: [
            0,
            CLOUD_HEIGHT + 1,
            4,
          ] as [
            number,
            number,
            number
          ],
          scale: 1.7,
        },

        {
          position: [
            7,
            CLOUD_HEIGHT + 2,
            5,
          ] as [
            number,
            number,
            number
          ],
          scale: 1.5,
        },
      ];

    }, []);

  /*
   * Move all clouds slowly.
   */
  useFrame(
    (
      _state,
      delta
    ) => {

      if (!group.current) {
        return;
      }

      group.current.position.x +=
        delta *
        (storm
          ? 0.06
          : 0.025);

      /*
       * Loop cloud field.
       */
      if (
        group.current.position.x >
        8
      ) {
        group.current.position.x =
          -8;
      }
    }
  );

  return (
    <group
      ref={group}
      visible
    >
      {clouds.map(
        (
          cloud,
          index
        ) => (
          <Cloud
            key={index}
            position={
              cloud.position
            }
            scale={
              cloud.scale
            }
          />
        )
      )}
    </group>
  );
}

/* ================================================================
   SUN
================================================================ */

function Sun({
  timeOfDay,
}: {
  timeOfDay: number;
}) {
  const group =
    useRef<THREE.Group>(
      null
    );

  const angle =
    (
      timeOfDay /
      24
    ) *
    Math.PI *
    2;

  const sunX =
    Math.cos(angle) *
    SUN_DISTANCE;

  const sunY =
    Math.sin(angle) *
    SUN_DISTANCE;

  /*
   * Don't allow sun to go
   * below the horizon visually.
   */
  const visibleY =
    Math.max(
      -3,
      sunY
    );

  return (
    <>
      <group
        ref={group}
        position={[
          sunX,
          visibleY,
          -12,
        ]}
      >
        <mesh>
          <sphereGeometry
            args={[
              1.1,
              16,
              16,
            ]}
          />

          <meshBasicMaterial
            color="#ffd86b"
          />
        </mesh>

        {/* Glow */}

        <mesh>
          <sphereGeometry
            args={[
              1.45,
              16,
              16,
            ]}
          />

          <meshBasicMaterial
            color="#ffd86b"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      </group>

      <directionalLight
        position={[
          sunX,
          Math.max(
            3,
            visibleY
          ),
          -5,
        ]}
        intensity={
          sunY > 0
            ? 2
            : 0.15
        }
        color="#fff1cf"
      />
    </>
  );
}

/* ================================================================
   MOON
================================================================ */

function Moon({
  timeOfDay,
}: {
  timeOfDay: number;
}) {
  const angle =
    (
      timeOfDay /
      24
    ) *
    Math.PI *
    2;

  /*
   * Moon is opposite the sun.
   */
  const moonX =
    -Math.cos(angle) *
    SUN_DISTANCE;

  const moonY =
    -Math.sin(angle) *
    SUN_DISTANCE;

  return (
    <>
      <group
        position={[
          moonX,
          Math.max(
            -2,
            moonY
          ),
          -10,
        ]}
      >
        <mesh>
          <sphereGeometry
            args={[
              0.85,
              16,
              16,
            ]}
          />

          <meshBasicMaterial
            color="#e7f2ff"
          />
        </mesh>

        {/* Moon glow */}

        <mesh>
          <sphereGeometry
            args={[
              1.2,
              16,
              16,
            ]}
          />

          <meshBasicMaterial
            color="#b9d7ff"
            transparent
            opacity={0.10}
            depthWrite={false}
          />
        </mesh>
      </group>

      <directionalLight
        position={[
          moonX,
          Math.max(
            2,
            moonY
          ),
          5,
        ]}
        intensity={
          moonY > 0
            ? 0.22
            : 0
        }
        color="#9fc7ff"
      />
    </>
  );
}

/* ================================================================
   STARS
================================================================ */

function Stars() {
  const geometry =
    useMemo(() => {

      const count = 250;

      const positions =
        new Float32Array(
          count * 3
        );

      for (
        let i = 0;
        i < count;
        i++
      ) {
        positions[
          i * 3
        ] =
          (
            Math.random() -
            0.5
          ) *
          SKY_DISTANCE *
          2;

        positions[
          i * 3 + 1
        ] =
          Math.random() *
          SKY_DISTANCE;

        positions[
          i * 3 + 2
        ] =
          (
            Math.random() -
            0.5
          ) *
          SKY_DISTANCE *
          2;
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

  const material =
    useMemo(() => {

      return new THREE.PointsMaterial({
        color:
          "#ffffff",

        size:
          0.035,

        transparent:
          true,

        opacity:
          0.7,

        depthWrite:
          false,
      });

    }, []);

  return (
    <points
      geometry={
        geometry
      }
      material={
        material
      }
    />
  );
}

/* ================================================================
   SKY ENVIRONMENT
================================================================ */

export default function SkyEnvironment({
  mode = "clear",
  timeOfDay = 14,
}: SkyEnvironmentProps) {

  const {
    scene,
  } = require("@react-three/fiber").useThree();

  /*
   * --------------------------------------------------------------
   * STORM?
   * --------------------------------------------------------------
   */

  const storm =
    mode === "rain" ||
    mode === "flood";

  /*
   * --------------------------------------------------------------
   * TIME
   * --------------------------------------------------------------
   */

  const isNight =
    timeOfDay < 6 ||
    timeOfDay >= 19;

  /*
   * --------------------------------------------------------------
   * BACKGROUND COLORS
   * --------------------------------------------------------------
   */

  const background =
    useMemo(() => {

      if (storm) {
        return new THREE.Color(
          "#172b42"
        );
      }

      if (isNight) {
        return new THREE.Color(
          "#071426"
        );
      }

      if (
        timeOfDay >= 6 &&
        timeOfDay < 9
      ) {
        return new THREE.Color(
          "#8eb6cf"
        );
      }

      if (
        timeOfDay >= 9 &&
        timeOfDay < 17
      ) {
        return new THREE.Color(
          "#6fa6ca"
        );
      }

      return new THREE.Color(
        "#425f79"
      );

    }, [
      storm,
      isNight,
      timeOfDay,
    ]);

  /*
   * --------------------------------------------------------------
   * UPDATE THREE.JS BACKGROUND
   * --------------------------------------------------------------
   */

  useFrame(() => {
    scene.background =
      background;
  });

  return (
    <>
      {/* ==========================================================
          SUN
      ========================================================== */}

      {!isNight && (
        <Sun
          timeOfDay={
            timeOfDay
          }
        />
      )}

      {/* ==========================================================
          MOON
      ========================================================== */}

      {isNight && (
        <Moon
          timeOfDay={
            timeOfDay
          }
        />
      )}

      {/* ==========================================================
          CLOUDS
      ========================================================== */}

      <Clouds
        storm={
          storm
        }
      />

      {/* ==========================================================
          STARS
      ========================================================== */}

      {isNight && (
        <Stars />
      )}
    </>
  );
}