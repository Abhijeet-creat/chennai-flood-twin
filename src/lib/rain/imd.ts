/* ================================================================
   IMD DATA CONNECTOR
   Chennai / Velachery Urban Flood Nowcasting

   IMPORTANT:
   This file talks to official IMD public APIs.

   It does NOT generate fake rainfall values.

   We will use:
   - current observations
   - station/district nowcasts
   - rainfall observations

   Radar ingestion will be added separately because
   IMD's radar service publishes radar products/images,
   while the public API documentation lists the
   weather/nowcast/rainfall APIs separately.
================================================================ */

export type IMDCurrentWeather = {
  temperature: number | null;
  humidity: number | null;
  rainfall24h: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  pressure: number | null;

  observedAt: string | null;

  stationId: string;
  stationName: string;
};

export type IMDNowcast = {
  location: string;
  message: string;
  warning: string | null;

  validFrom: string | null;
  validTo: string | null;

  raw: unknown;
};

export type IMDRainfallObservation = {
  location: string;
  rainfallMm: number | null;

  observedAt: string | null;

  raw: unknown;
};

export type IMDRainData = {
  fetchedAt: string;

  source: "IMD";

  current: IMDCurrentWeather | null;

  nowcast: IMDNowcast[];

  rainfall: IMDRainfallObservation[];

  errors: string[];
};

/* ================================================================
   CONFIGURATION
================================================================ */

/*
 * Chennai-Meenambakkam is one of the official IMD Chennai
 * city weather stations.
 *
 * IMD currently exposes the station through city.imd.gov.in.
 *
 * Keep the ID configurable so we can change/extend the
 * observation network later.
 */
export const CHENNAI_MEENAMBAKKAM_ID =
  "43279";

/*
 * Chennai-Nungambakkam is another useful Chennai station.
 */
export const CHENNAI_NUNGAMBAKKAM_ID =
  "43278";

/*
 * Public IMD API endpoints documented by IMD.
 */
const IMD_CURRENT_WEATHER_URL =
  "https://mausam.imd.gov.in/api/current_wx_api.php";

const IMD_DISTRICT_NOWCAST_URL =
  "https://mausam.imd.gov.in/api/nowcast_district_api.php";

const IMD_DISTRICT_RAINFALL_URL =
  "https://mausam.imd.gov.in/api/districtwise_rainfall_api.php";

/* ================================================================
   SAFE NUMBER
================================================================ */

function numberOrNull(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const parsed =
      Number(
        value
          .replace(/,/g, "")
          .replace(/mm/gi, "")
          .replace(/°c/gi, "")
          .trim()
      );

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

/* ================================================================
   SAFE STRING
================================================================ */

function stringOrNull(
  value: unknown
): string | null {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  return null;
}

/* ================================================================
   JSON FETCH
================================================================ */

async function fetchJSON<T>(
  url: string,
  signal?: AbortSignal
): Promise<T> {
  const response =
    await fetch(url, {
      method: "GET",

      /*
       * Don't let Next.js serve an old cached weather response.
       */
      cache: "no-store",

      headers: {
        Accept:
          "application/json",
      },

      signal,
    });

  if (!response.ok) {
    throw new Error(
      `IMD request failed (${response.status}): ${url}`
    );
  }

  return response.json() as Promise<T>;
}

/* ================================================================
   CURRENT WEATHER
================================================================ */

export async function fetchIMDCurrentWeather(
  stationId =
    CHENNAI_MEENAMBAKKAM_ID,
  signal?: AbortSignal
): Promise<IMDCurrentWeather> {
  /*
   * IMD endpoint:
   *
   * /api/current_wx_api.php?id=...
   */

  const url =
    `${IMD_CURRENT_WEATHER_URL}?id=${encodeURIComponent(
      stationId
    )}`;

  const raw: any =
    await fetchJSON<any>(
      url,
      signal
    );

  /*
   * IMD has used slightly different field
   * naming across API versions.
   *
   * Therefore we normalize several possible
   * names instead of trusting only one key.
   */

  const row =
    Array.isArray(raw)
      ? raw[0]
      : raw?.data ??
        raw?.weather ??
        raw;

  return {
    temperature:
      numberOrNull(
        row?.temp ??
          row?.temperature ??
          row?.temperature_c
      ),

    humidity:
      numberOrNull(
        row?.rh ??
          row?.humidity ??
          row?.relative_humidity
      ),

    rainfall24h:
      numberOrNull(
        row?.rain ??
          row?.rainfall ??
          row?.rainfall24h ??
          row?.rainfall_24h
      ),

    windSpeed:
      numberOrNull(
        row?.wind_speed ??
          row?.windSpeed ??
          row?.ws
      ),

    windDirection:
      numberOrNull(
        row?.wind_direction ??
          row?.windDirection ??
          row?.wd
      ),

    pressure:
      numberOrNull(
        row?.pressure ??
          row?.slp
      ),

    observedAt:
      stringOrNull(
        row?.datetime ??
          row?.date ??
          row?.time ??
          row?.obs_time
      ),

    stationId,

    stationName:
      stringOrNull(
        row?.station_name ??
          row?.station ??
          row?.name
      ) ??
      `IMD station ${stationId}`,
  };
}

/* ================================================================
   DISTRICT NOWCAST
================================================================ */

export async function fetchIMDDistrictNowcast(
  districtId: string,
  signal?: AbortSignal
): Promise<IMDNowcast[]> {
  /*
   * IMD documents:
   *
   * /api/nowcast_district_api.php?id=...
   *
   * The exact district ID should be confirmed
   * against the current IMD district listing.
   */

  const url =
    `${IMD_DISTRICT_NOWCAST_URL}?id=${encodeURIComponent(
      districtId
    )}`;

  const raw: any =
    await fetchJSON<any>(
      url,
      signal
    );

  const rows =
    Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : raw
          ? [raw]
          : [];

  return rows.map(
    (row: any) => ({
      location:
        stringOrNull(
          row?.district ??
            row?.location ??
            row?.city ??
            row?.name
        ) ??
        "Unknown",

      message:
        stringOrNull(
          row?.nowcast ??
            row?.message ??
            row?.forecast ??
            row?.weather
        ) ??
        "No nowcast message available.",

      warning:
        stringOrNull(
          row?.warning ??
            row?.warning_text ??
            row?.alert
        ),

      validFrom:
        stringOrNull(
          row?.valid_from ??
            row?.from ??
            row?.start_time
        ),

      validTo:
        stringOrNull(
          row?.valid_to ??
            row?.to ??
            row?.end_time
        ),

      raw: row,
    })
  );
}

/* ================================================================
   DISTRICT RAINFALL
================================================================ */

export async function fetchIMDDistrictRainfall(
  signal?: AbortSignal
): Promise<IMDRainfallObservation[]> {
  const raw: any =
    await fetchJSON<any>(
      IMD_DISTRICT_RAINFALL_URL,
      signal
    );

  const rows =
    Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : raw
          ? [raw]
          : [];

  return rows.map(
    (row: any) => ({
      location:
        stringOrNull(
          row?.district ??
            row?.District ??
            row?.location ??
            row?.name
        ) ??
        "Unknown",

      rainfallMm:
        numberOrNull(
          row?.rainfall ??
            row?.rainfall_mm ??
            row?.rain
        ),

      observedAt:
        stringOrNull(
          row?.date ??
            row?.datetime ??
            row?.time
        ),

      raw: row,
    })
  );
}

/* ================================================================
   CHENNAI FLOOD INPUT
================================================================ */

/*
 * This is the main function the Rain mode will call.
 *
 * It deliberately returns normalized data so that the
 * rest of the flood-nowcasting system does not need to
 * know the raw IMD API format.
 */

export async function fetchChennaiRainData(
  options?: {
    stationId?: string;
    districtId?: string;
    signal?: AbortSignal;
  }
): Promise<IMDRainData> {
  const errors: string[] = [];

  let current:
    | IMDCurrentWeather
    | null = null;

  let nowcast:
    | IMDNowcast[] = [];

  let rainfall:
    | IMDRainfallObservation[] =
    [];

  /*
   * Current weather
   */
  try {
    current =
      await fetchIMDCurrentWeather(
        options?.stationId ??
          CHENNAI_MEENAMBAKKAM_ID,
        options?.signal
      );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "Unable to fetch current IMD weather."
    );
  }

  /*
   * District nowcast
   *
   * Only request this when we have a district ID.
   * We will plug in the correct Chennai district
   * mapping once we verify it from the IMD API response.
   */
  if (
    options?.districtId
  ) {
    try {
      nowcast =
        await fetchIMDDistrictNowcast(
          options.districtId,
          options.signal
        );
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Unable to fetch IMD district nowcast."
      );
    }
  }

  /*
   * District rainfall
   */
  try {
    rainfall =
      await fetchIMDDistrictRainfall(
        options?.signal
      );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "Unable to fetch IMD district rainfall."
    );
  }

  return {
    fetchedAt:
      new Date().toISOString(),

    source: "IMD",

    current,

    nowcast,

    rainfall,

    errors,
  };
}