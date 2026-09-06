"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  useFrame,
  useThree,
} from "@react-three/fiber";

type EarthquakeEffectProps = {
  active: boolean;
  magnitude: number;
};

export default function EarthquakeEffect({
  active,
  magnitude,
}: EarthquakeEffectProps) {
  const { camera } =
    useThree();

  const basePosition =
    useRef(camera.position.clone());

  const time =
    useRef(0);

  useEffect(() => {
    if (!active) {
      camera.position.copy(
        basePosition.current
      );

      time.current = 0;
      return;
    }

    basePosition.current.copy(
      camera.position
    );

    time.current = 0;
  }, [
    active,
    magnitude,
    camera,
  ]);

  useFrame((_, delta) => {
    if (!active) {
      return;
    }

    time.current += delta;

    const intensity =
      Math.min(
        0.055,
        0.008 +
          magnitude * 0.005
      );

    const frequency =
      32 +
      magnitude * 3;

    const x =
      Math.sin(
        time.current *
          frequency
      ) * intensity;

    const y =
      Math.cos(
        time.current *
          frequency *
          1.13
      ) *
      intensity *
      0.55;

    const z =
      Math.sin(
        time.current *
          frequency *
          0.91
      ) *
      intensity;

    camera.position.set(
      basePosition.current.x + x,
      basePosition.current.y + y,
      basePosition.current.z + z
    );
  });

  return null;
}