/* ================================================================
   EARTHQUAKE SIMULATION
================================================================ */

export type EarthquakeOrigin = {
  x: number;
  z: number;
};

export const MIN_EARTHQUAKE_MAGNITUDE = 1;
export const MAX_EARTHQUAKE_MAGNITUDE = 10;

export const DEFAULT_EARTHQUAKE_MAGNITUDE = 5;

/*
 * Maximum visual radius at magnitude 10.
 */
export const MAX_EARTHQUAKE_RADIUS = 5.5;

/* ================================================================
   RADIUS
================================================================ */

export function getEarthquakeRadius(
  magnitude: number
) {
  const m = Math.max(
    MIN_EARTHQUAKE_MAGNITUDE,
    Math.min(
      MAX_EARTHQUAKE_MAGNITUDE,
      magnitude
    )
  );

  /*
   * Small earthquakes affect a small
   * local area.
   *
   * Large earthquakes affect most
   * of the city.
   */
  return (
    0.8 +
    (m / MAX_EARTHQUAKE_MAGNITUDE) *
      MAX_EARTHQUAKE_RADIUS
  );
}

/* ================================================================
   DAMAGE
================================================================ */

export function getEarthquakeDamage(
  buildingX: number,
  buildingZ: number,
  origin: EarthquakeOrigin,
  magnitude: number
) {
  const radius =
    getEarthquakeRadius(magnitude);

  const dx =
    buildingX - origin.x;

  const dz =
    buildingZ - origin.z;

  const distance =
    Math.sqrt(
      dx * dx +
      dz * dz
    );

  if (distance >= radius) {
    return 0;
  }

  /*
   * 1 near epicenter
   * 0 at outer edge
   */
  const falloff =
    1 -
    distance / radius;

  /*
   * Higher magnitude makes the
   * inner area much more destructive.
   */
  const magnitudeFactor =
    magnitude /
    MAX_EARTHQUAKE_MAGNITUDE;

  return Math.min(
    1,
    Math.pow(falloff, 0.75) *
      (0.45 +
        magnitudeFactor * 0.75)
  );
}

/* ================================================================
   DAMAGE LEVEL
================================================================ */

export function getEarthquakeDamageLevel(
  damage: number
) {
  if (damage >= 0.75) {
    return "destroyed";
  }

  if (damage >= 0.5) {
    return "severe";
  }

  if (damage >= 0.25) {
    return "moderate";
  }

  if (damage > 0) {
    return "minor";
  }

  return "safe";
}

/* ================================================================
   COLOR
================================================================ */

export function getEarthquakeColor(
  damage: number
): string | null {
  if (damage <= 0) {
    return null;
  }

  if (damage >= 0.75) {
    return "#991b1b";
  }

  if (damage >= 0.5) {
    return "#dc2626";
  }

  if (damage >= 0.25) {
    return "#f97316";
  }

  return "#facc15";
}

/* ================================================================
   TEXT
================================================================ */

export function getEarthquakeDescription(
  damage: number
) {
  if (damage >= 0.75) {
    return "Severe structural failure. Building is likely to collapse.";
  }

  if (damage >= 0.5) {
    return "Severe earthquake damage detected.";
  }

  if (damage >= 0.25) {
    return "Moderate structural damage detected.";
  }

  if (damage > 0) {
    return "Minor earthquake impact detected.";
  }

  return "Outside the main earthquake impact zone.";
}