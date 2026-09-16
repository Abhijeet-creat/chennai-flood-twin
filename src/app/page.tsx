"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/* =========================================================
   TYPES
   ========================================================= */

type WeatherTab =
  | "temperature"
  | "precipitation"
  | "wind";

type TwinLayer =
  | "terrain"
  | "forecast"
  | "drainage"
  | "infrastructure";

type NowcastStep = {
  key: string;
  label: string;
  minutes: number;
  depth: number;
  drainageStress: number;
  nearestDrain: number;
  risk: "LOW" | "MODERATE" | "HIGH" | "SEVERE";
  rainfall: number;
};

type HourlyItem = {
  time: string;
  temperature: number;
  precipitation: number;
  precipitationProbability: number;
  wind: number;
  windDirection: number;
  weatherCode: number;
};

type DailyItem = {
  date: string;
  high: number;
  low: number;
  weatherCode: number;
};

type WeatherState = {
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    wind: number;
    weatherCode: number;
  };
  hourly: HourlyItem[];
  daily: DailyItem[];
};

type WeatherLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

/* =========================================================
   NOWCAST PREVIEW
   ========================================================= */

const NOWCAST_STEPS: NowcastStep[] = [
  {
    key: "now",
    label: "NOW",
    minutes: 0,
    depth: 0.18,
    drainageStress: 0.22,
    nearestDrain: 18,
    risk: "LOW",
    rainfall: 8,
  },
  {
    key: "30",
    label: "+30",
    minutes: 30,
    depth: 0.24,
    drainageStress: 0.25,
    nearestDrain: 17,
    risk: "LOW",
    rainfall: 12,
  },
  {
    key: "60",
    label: "+60",
    minutes: 60,
    depth: 0.31,
    drainageStress: 0.28,
    nearestDrain: 17,
    risk: "MODERATE",
    rainfall: 18,
  },
  {
    key: "90",
    label: "+90",
    minutes: 90,
    depth: 0.42,
    drainageStress: 0.31,
    nearestDrain: 16,
    risk: "MODERATE",
    rainfall: 24,
  },
  {
    key: "120",
    label: "+120",
    minutes: 120,
    depth: 0.56,
    drainageStress: 0.38,
    nearestDrain: 15,
    risk: "HIGH",
    rainfall: 31,
  },
  {
    key: "150",
    label: "+150",
    minutes: 150,
    depth: 0.71,
    drainageStress: 0.46,
    nearestDrain: 14,
    risk: "HIGH",
    rainfall: 38,
  },
  {
    key: "180",
    label: "+180",
    minutes: 180,
    depth: 0.86,
    drainageStress: 0.55,
    nearestDrain: 13,
    risk: "SEVERE",
    rainfall: 46,
  },
];

/* =========================================================
   DIGITAL TWIN LAYERS
   ========================================================= */

const TWIN_LAYERS: {
  id: TwinLayer;
  number: string;
  title: string;
  description: string;
}[] = [
  {
    id: "terrain",
    number: "01",
    title: "Terrain",
    description:
      "Elevation and terrain structure provide the physical base for flood analysis.",
  },
  {
    id: "forecast",
    number: "02",
    title: "Flood Forecast",
    description:
      "Explore the forecast window from current conditions through the next three hours.",
  },
  {
    id: "drainage",
    number: "03",
    title: "Drainage",
    description:
      "View drainage infrastructure used as spatial context for flood assessment.",
  },
  {
    id: "infrastructure",
    number: "04",
    title: "Infrastructure",
    description:
      "Buildings and road networks provide the urban context around affected areas.",
  },
];

/* =========================================================
   CHART
   ========================================================= */

const CHART_W = 1000;
const CHART_H = 260;
const PAD_TOP = 25;
const PAD_BOTTOM = 35;

/* =========================================================
   HELPERS
   ========================================================= */

function formatHour(iso: string) {
  const d = new Date(iso);

  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    })
    .replace(":00", "");
}

function formatDay(iso: string) {
  const d = new Date(iso);

  return d.toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function getWeatherIcon(code: number) {
  if (code === 0) return "☀";

  if ([1, 2].includes(code)) {
    return "◐";
  }

  if (code === 3) {
    return "☁";
  }

  if ([45, 48].includes(code)) {
    return "≋";
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return "◌";
  }

  if ([61, 63, 65, 66, 67].includes(code)) {
    return "◒";
  }

  if ([71, 73, 75, 77].includes(code)) {
    return "❄";
  }

  if ([80, 81, 82].includes(code)) {
    return "◒";
  }

  if ([85, 86].includes(code)) {
    return "❄";
  }

  if ([95, 96, 99].includes(code)) {
    return "⛈";
  }

  return "◐";
}

function getWeatherText(code: number) {
  if (code === 0) return "Clear sky";

  if ([1, 2].includes(code)) {
    return "Partly cloudy";
  }

  if (code === 3) {
    return "Overcast";
  }

  if ([45, 48].includes(code)) {
    return "Foggy";
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return "Drizzle";
  }

  if ([61, 63, 65].includes(code)) {
    return "Rain";
  }

  if ([66, 67].includes(code)) {
    return "Freezing rain";
  }

  if ([71, 73, 75, 77].includes(code)) {
    return "Snow";
  }

  if ([80, 81, 82].includes(code)) {
    return "Rain showers";
  }

  if ([85, 86].includes(code)) {
    return "Snow showers";
  }

  if ([95, 96, 99].includes(code)) {
    return "Thunderstorm";
  }

  return "Partly cloudy";
}

function buildPaths(values: number[]) {
  if (values.length === 0) {
    return {
      line: "",
      area: "",
    };
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const stepX =
    CHART_W /
    Math.max(values.length - 1, 1);

  const points = values.map((value, index) => {
    const x = index * stepX;

    const y =
      PAD_TOP +
      (1 - (value - min) / range) *
        (CHART_H - PAD_TOP - PAD_BOTTOM);

    return {
      x,
      y,
    };
  });

  const line = points
    .map((point, index) => {
      if (index === 0) {
        return `M${point.x} ${point.y}`;
      }

      const previous = points[index - 1];

      const middle =
        previous.x +
        (point.x - previous.x) / 2;

      return (
        `C${middle} ${previous.y} ` +
        `${middle} ${point.y} ` +
        `${point.x} ${point.y}`
      );
    })
    .join(" ");

  const area =
    `${line} ` +
    `L${CHART_W} ${CHART_H} ` +
    `L0 ${CHART_H} Z`;

  return {
    line,
    area,
  };
}

function pickHourly(
  hourly: HourlyItem[],
  startHour = 14
) {
  if (hourly.length === 0) {
    return [];
  }

  let startIndex = hourly.findIndex(
    (item) =>
      new Date(item.time).getHours() ===
      startHour
  );

  if (startIndex === -1) {
    startIndex = 0;
  }

  const picked: HourlyItem[] = [];

  for (let i = 0; i < 8; i++) {
    const index = startIndex + i * 3;

    if (index < hourly.length) {
      picked.push(hourly[index]);
    }
  }

  return picked;
}

/* =========================================================
   HOME
   ========================================================= */

export default function Home() {
  const videoRef =
    useRef<HTMLVideoElement>(null);

  /* -------------------------------------------------------
     NAV
     ------------------------------------------------------- */

  const [scrolled, setScrolled] =
    useState(false);

  const [now, setNow] =
    useState("");

  /* -------------------------------------------------------
     WEATHER
     ------------------------------------------------------- */

  const [activeWeatherTab, setActiveWeatherTab] =
    useState<WeatherTab>("temperature");

  const [selectedDay, setSelectedDay] =
    useState(0);

  const [weather, setWeather] =
    useState<WeatherState | null>(null);

  const [loadingWeather, setLoadingWeather] =
    useState(true);

  const [weatherError, setWeatherError] =
    useState("");

  const [weatherLocation, setWeatherLocation] =
    useState<WeatherLocation>({
      name: "Chennai, Tamil Nadu",
      latitude: 13.0827,
      longitude: 80.2707,
    });

  const [usingMyLocation, setUsingMyLocation] =
    useState(false);

  /* -------------------------------------------------------
     DIGITAL TWIN

     IMPORTANT:
     Start at NOW and Terrain.
     ------------------------------------------------------- */

  const [selectedForecast, setSelectedForecast] =
    useState(0);

  const [activeLayer, setActiveLayer] =
    useState<TwinLayer>("terrain");

  /* =======================================================
     WEATHER
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      setLoadingWeather(true);
      setWeatherError("");

      try {
        const latitude =
          weatherLocation.latitude;

        const longitude =
          weatherLocation.longitude;

        const url =
          "https://api.open-meteo.com/v1/forecast" +
          `?latitude=${latitude}` +
          `&longitude=${longitude}` +
          "&current=" +
          "temperature_2m," +
          "relative_humidity_2m," +
          "precipitation," +
          "wind_speed_10m," +
          "weather_code" +
          "&hourly=" +
          "temperature_2m," +
          "relative_humidity_2m," +
          "precipitation_probability," +
          "precipitation," +
          "wind_speed_10m," +
          "wind_direction_10m," +
          "weather_code" +
          "&daily=" +
          "temperature_2m_max," +
          "temperature_2m_min," +
          "weather_code" +
          "&timezone=auto" +
          "&forecast_days=7";

        const response =
          await fetch(url);

        if (!response.ok) {
          throw new Error(
            "Weather request failed"
          );
        }

        const data =
          await response.json();

        if (cancelled) {
          return;
        }

        const hourly: HourlyItem[] =
          (data.hourly?.time || []).map(
            (
              time: string,
              index: number
            ) => ({
              time,

              temperature:
                data.hourly
                  ?.temperature_2m?.[
                  index
                ] ?? 0,

              precipitation:
                data.hourly
                  ?.precipitation?.[
                  index
                ] ?? 0,

              precipitationProbability:
                data.hourly
                  ?.precipitation_probability?.[
                  index
                ] ?? 0,

              wind:
                data.hourly
                  ?.wind_speed_10m?.[
                  index
                ] ?? 0,

              windDirection:
                data.hourly
                  ?.wind_direction_10m?.[
                  index
                ] ?? 0,

              weatherCode:
                data.hourly
                  ?.weather_code?.[
                  index
                ] ?? 0,
            })
          );

        const daily: DailyItem[] =
          (data.daily?.time || []).map(
            (
              date: string,
              index: number
            ) => ({
              date,

              high:
                data.daily
                  ?.temperature_2m_max?.[
                  index
                ] ?? 0,

              low:
                data.daily
                  ?.temperature_2m_min?.[
                  index
                ] ?? 0,

              weatherCode:
                data.daily
                  ?.weather_code?.[
                  index
                ] ?? 0,
            })
          );

        setWeather({
          current: {
            temperature:
              data.current
                ?.temperature_2m ?? 0,

            humidity:
              data.current
                ?.relative_humidity_2m ?? 0,

            precipitation:
              data.current
                ?.precipitation ?? 0,

            wind:
              data.current
                ?.wind_speed_10m ?? 0,

            weatherCode:
              data.current
                ?.weather_code ?? 0,
          },

          hourly,
          daily,
        });

        setSelectedDay(0);
      } catch (error) {
        console.error(
          "Weather error:",
          error
        );

        if (!cancelled) {
          setWeatherError(
            "Unable to load live weather data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingWeather(false);
        }
      }
    }

    fetchWeather();

    return () => {
      cancelled = true;
    };
  }, [
    weatherLocation.latitude,
    weatherLocation.longitude,
  ]);

  /* =======================================================
     CLOCK
     ======================================================= */

  useEffect(() => {
    function updateClock() {
      const date = new Date();

      const weekday =
        date.toLocaleDateString(
          "en-US",
          {
            weekday: "long",
          }
        );

      const time =
        date.toLocaleTimeString(
          "en-US",
          {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }
        );

      setNow(
        `${weekday} ${time}`
      );
    }

    updateClock();

    const interval =
      window.setInterval(
        updateClock,
        60000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, []);

  /* =======================================================
     SCROLL
     ======================================================= */

  useEffect(() => {
    function handleScroll() {
      setScrolled(
        window.scrollY > 40
      );
    }

    handleScroll();

    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );

    return () =>
      window.removeEventListener(
        "scroll",
        handleScroll
      );
  }, []);

  /* =======================================================
     VIDEO
     ======================================================= */

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    video.playbackRate = 1.35;

    video
      .play()
      .catch(() => {});
  }, []);

  /* =======================================================
     LOCATION
     ======================================================= */

  function useMyLocation() {
    if (!navigator.geolocation) {
      setWeatherError(
        "Location is not supported by this browser."
      );

      return;
    }

    setUsingMyLocation(true);
    setWeatherError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setWeatherLocation({
          name: "My Location",
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
        });

        setUsingMyLocation(false);
      },
      () => {
        setUsingMyLocation(false);

        setWeatherError(
          "Location permission was not granted. Showing Chennai weather."
        );

        setWeatherLocation({
          name: "Chennai, Tamil Nadu",
          latitude: 13.0827,
          longitude: 80.2707,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }

  /* =======================================================
     DERIVED WEATHER DATA
     ======================================================= */

  const daily =
    weather?.daily ?? [];

  const dayHourly =
    useMemo(() => {
      if (!weather) {
        return [];
      }

      const start =
        selectedDay * 24;

      return weather.hourly.slice(
        start,
        start + 24
      );
    }, [
      weather,
      selectedDay,
    ]);

  const chartHourly =
    useMemo(() => {
      const picked =
        pickHourly(
          dayHourly
        );

      return picked.length > 0
        ? picked
        : dayHourly.slice(0, 8);
    }, [dayHourly]);

  const chartValues =
    chartHourly.map((item) => {
      if (
        activeWeatherTab ===
        "temperature"
      ) {
        return item.temperature;
      }

      if (
        activeWeatherTab ===
        "precipitation"
      ) {
        return item.precipitation;
      }

      return item.wind;
    });

  const chartPaths =
    buildPaths(chartValues);

  const currentTemperature =
    weather
      ? Math.round(
          weather.current
            .temperature
        )
      : "--";

  const currentHumidity =
    weather
      ? Math.round(
          weather.current
            .humidity
        )
      : "--";

  const currentPrecipitation =
    weather
      ? weather.current
          .precipitation
      : "--";

  const currentWind =
    weather
      ? Math.round(
          weather.current.wind
        )
      : "--";

  const currentWeatherCode =
    weather
      ? weather.current
          .weatherCode
      : 1;

  const currentIcon =
    getWeatherIcon(
      currentWeatherCode
    );

  const currentWeatherText =
    getWeatherText(
      currentWeatherCode
    );

  const activeDay =
    daily[selectedDay];

  const selectedNowcast =
    NOWCAST_STEPS[
      selectedForecast
    ];

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f7f8] text-slate-900">

     {/* ===================================================
    NAVBAR
    =================================================== */}

<nav
  className={`fixed left-0 right-0 top-0 z-[100] h-[76px] border-b transition-all duration-300 ${
    scrolled
      ? "border-slate-200 bg-white/95 shadow-sm backdrop-blur-md"
      : "border-white/10 bg-black/10"
  }`}
>
  <div className="mx-auto flex h-full w-[90%] max-w-[1380px] items-center justify-between">

    {/* LOGO */}
    <Link
      href="/"
      className="flex items-center gap-3"
    >
      <img
        src="/jalsetu-logo.jpeg"
        alt="JALSETU Logo"
        className="h-10 w-10 rounded-md object-cover"
      />

      <div>
        <div
          className={`text-[15px] font-bold tracking-wide ${
            scrolled
              ? "text-slate-900"
              : "text-white"
          }`}
        >
          JALSETU
        </div>

        <div
          className={`mt-0.5 text-[8px] uppercase tracking-[0.18em] ${
            scrolled
              ? "text-slate-500"
              : "text-white/60"
          }`}
        >
          Urban Flood Intelligence
        </div>
      </div>
    </Link>

    {/* NAV LINKS */}
    <div className="hidden items-center gap-8 md:flex">

      <Link
        href="#home"
        className={`text-sm transition ${
          scrolled
            ? "text-slate-600 hover:text-emerald-700"
            : "text-white/85 hover:text-white"
        }`}
      >
        Home
      </Link>

      <Link
        href="#weather"
        className={`text-sm transition ${
          scrolled
            ? "text-slate-600 hover:text-emerald-700"
            : "text-white/85 hover:text-white"
        }`}
      >
        Weather
      </Link>

      <Link
        href="#alerts"
        className={`text-sm transition ${
          scrolled
            ? "text-slate-600 hover:text-emerald-700"
            : "text-white/85 hover:text-white"
        }`}
      >
        Alerts
      </Link>

      <Link
        href="#about"
        className={`text-sm transition ${
          scrolled
            ? "text-slate-600 hover:text-emerald-700"
            : "text-white/85 hover:text-white"
        }`}
      >
        About
      </Link>

    </div>

    {/* RIGHT ACTIONS */}
    <div className="flex items-center gap-5">

      <Link
        href="/login"
        className={`hidden text-sm sm:block ${
          scrolled
            ? "text-slate-600 hover:text-slate-900"
            : "text-white/85 hover:text-white"
        }`}
      >
        Login
      </Link>

      <Link
        href="/signup"
        className="border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
      >
        Sign Up
      </Link>

    </div>

  </div>
</nav>
      {/* ===================================================
          HERO
          =================================================== */}

      <section
        id="home"
        className="relative min-h-screen overflow-hidden bg-slate-950"
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source
            src="/videos/chennai-flood.mp4"
            type="video/mp4"
          />
        </video>

        <div className="absolute inset-0 bg-black/45" />

        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/15" />

        <div className="relative z-10 mx-auto flex min-h-screen w-[90%] max-w-[1380px] items-end pb-20 pt-32">

          <div className="max-w-[760px]">

            <div className="mb-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Chennai Flood Intelligence
            </div>

            <h1 className="max-w-[820px] text-[clamp(48px,7vw,88px)] font-semibold leading-[0.96] tracking-[-4px] text-white">
              Understand the city
              <br />
              before the water does.
            </h1>

            <p className="mt-7 max-w-[610px] text-[15px] leading-7 text-white/75 md:text-base">
              An urban flood intelligence platform
              combining rainfall, terrain, drainage and
              infrastructure data into one interactive
              digital twin of Chennai.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-5 bg-emerald-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Enter Digital Twin
                <span className="text-lg transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>

              <Link
                href="#weather"
                className="inline-flex items-center gap-4 border border-white/30 bg-white/10 px-6 py-4 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Check Conditions
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/15 pt-6">

              <div>
                <div className="text-xl font-semibold text-white">
                  0–3h
                </div>

                <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-white/50">
                  Nowcast window
                </div>
              </div>

              <div className="hidden h-8 w-px bg-white/20 sm:block" />

              <div>
                <div className="text-xl font-semibold text-white">
                  3D
                </div>

                <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-white/50">
                  Digital twin
                </div>
              </div>

              <div className="hidden h-8 w-px bg-white/20 sm:block" />

              <div>
                <div className="text-xl font-semibold text-white">
                  GIS
                </div>

                <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-white/50">
                  Spatial intelligence
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-7 right-7 hidden text-right font-mono text-[9px] text-white/45 md:block">
          <div>13.0827° N</div>
          <div>80.2707° E</div>
          <div className="mt-2 uppercase tracking-widest">
            Chennai
          </div>
        </div>
      </section>

      {/* ===================================================
          WEATHER
          =================================================== */}

      <section
        id="weather"
        className="border-b border-slate-200 bg-[#f5f7f8] py-24"
      >
        <div className="mx-auto w-[90%] max-w-[1200px]">

          <div className="flex flex-col justify-between gap-8 border-b border-slate-200 pb-10 md:flex-row md:items-end">

            <div>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                Environmental conditions
              </div>

              <h2 className="text-5xl font-medium tracking-[-3px] text-slate-900 md:text-6xl">
                Chennai weather
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-500">
                Current weather and short-term forecast
                provide environmental context for the
                flood intelligence system.
              </p>
            </div>

            <div className="font-mono text-xs text-slate-400">
              {now || "Loading local time"}
            </div>
          </div>

          {/* LOCATION */}

          <div className="flex flex-col justify-between gap-5 border-b border-slate-200 py-7 sm:flex-row sm:items-center">

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-white text-lg text-slate-500">
                +
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {weatherLocation.name}
                </div>

                <div className="mt-1 font-mono text-[10px] text-slate-400">
                  {weatherLocation.latitude.toFixed(4)}
                  ° N&nbsp;&nbsp;
                  {weatherLocation.longitude.toFixed(4)}
                  ° E
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              disabled={usingMyLocation}
              className="w-fit border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-50"
            >
              {usingMyLocation
                ? "Getting location..."
                : "Use my location"}
            </button>
          </div>

          {weatherError && (
            <div className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {weatherError}
            </div>
          )}

          {/* CURRENT WEATHER */}

          <div className="grid gap-12 py-12 md:grid-cols-[1.5fr_1fr_1fr]">

            <div className="flex items-start gap-6">
              <div className="flex h-16 w-16 items-center justify-center border border-slate-200 bg-white text-3xl text-slate-700">
                {currentIcon}
              </div>

              <div>
                <div className="flex items-start">
                  <span className="text-6xl font-light tracking-[-3px] text-slate-900">
                    {loadingWeather
                      ? "--"
                      : currentTemperature}
                  </span>

                  <span className="ml-2 pt-2 text-lg text-slate-400">
                    °C
                  </span>
                </div>

                <div className="mt-4 text-sm text-slate-500">
                  {loadingWeather
                    ? "Loading"
                    : currentWeatherText}
                </div>
              </div>
            </div>

            <div className="border-l border-slate-200 pl-6">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Precipitation
              </div>

              <div className="mt-3 text-2xl font-medium text-slate-900">
                {loadingWeather
                  ? "--"
                  : `${currentPrecipitation} mm`}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                Current reading
              </div>
            </div>

            <div className="border-l border-slate-200 pl-6">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Humidity / Wind
              </div>

              <div className="mt-3 text-2xl font-medium text-slate-900">
                {loadingWeather
                  ? "--"
                  : `${currentHumidity}%`}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                Wind{" "}
                {loadingWeather
                  ? "--"
                  : `${currentWind} km/h`}
              </div>
            </div>
          </div>

          {/* WEATHER TABS */}

          <div className="flex gap-8 border-b border-slate-200">
            {(
              [
                "temperature",
                "precipitation",
                "wind",
              ] as WeatherTab[]
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() =>
                  setActiveWeatherTab(tab)
                }
                className={`relative pb-4 text-sm capitalize ${
                  activeWeatherTab === tab
                    ? "font-medium text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab}

                {activeWeatherTab === tab && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-emerald-600" />
                )}
              </button>
            ))}
          </div>

          {/* CHART */}

          <div className="pt-8">
            {chartHourly.length > 0 ? (
              <>
                <div className="mb-4 flex justify-between text-[10px] font-mono text-slate-400">
                  {chartHourly.map(
                    (item) => (
                      <span key={item.time}>
                        {formatHour(
                          item.time
                        )}
                      </span>
                    )
                  )}
                </div>

                <div className="h-[260px] w-full">
                  <svg
                    viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                    preserveAspectRatio="none"
                    className="h-full w-full"
                  >
                    {[25, 80, 135, 190, 235].map(
                      (y) => (
                        <line
                          key={y}
                          x1="0"
                          x2={CHART_W}
                          y1={y}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />
                      )
                    )}

                    {chartPaths.area && (
                      <path
                        d={
                          chartPaths.area
                        }
                        fill="#10b981"
                        fillOpacity="0.07"
                      />
                    )}

                    {chartPaths.line && (
                      <path
                        d={
                          chartPaths.line
                        }
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>
                </div>

                <div className="mt-3 flex justify-between text-[10px] text-slate-400">
                  {chartHourly.map(
                    (item) => {
                      const value =
                        activeWeatherTab ===
                        "temperature"
                          ? `${Math.round(
                              item.temperature
                            )}°`
                          : activeWeatherTab ===
                            "precipitation"
                          ? `${item.precipitation} mm`
                          : `${Math.round(
                              item.wind
                            )} km/h`;

                      return (
                        <span
                          key={`${item.time}-value`}
                        >
                          {value}
                        </span>
                      );
                    }
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                Weather chart loading...
              </div>
            )}
          </div>

          {/* DAILY FORECAST */}

          <div className="mt-14 grid grid-cols-2 border-l border-t border-slate-200 sm:grid-cols-4 md:grid-cols-7">

            {daily.map(
              (day, index) => {
                const selected =
                  selectedDay === index;

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() =>
                      setSelectedDay(
                        index
                      )
                    }
                    className={`border-b border-r border-slate-200 p-5 text-left transition ${
                      selected
                        ? "bg-white"
                        : "bg-transparent hover:bg-white/70"
                    }`}
                  >
                    <div className="text-xs font-medium text-slate-700">
                      {formatDay(
                        day.date
                      )}
                    </div>

                    <div className="my-5 text-2xl text-slate-700">
                      {getWeatherIcon(
                        day.weatherCode
                      )}
                    </div>

                    <div className="flex gap-3 text-sm">
                      <span className="font-medium text-slate-900">
                        {Math.round(
                          day.high
                        )}°
                      </span>

                      <span className="text-slate-400">
                        {Math.round(
                          day.low
                        )}°
                      </span>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          {activeDay && (
            <div className="mt-6 text-center text-[10px] uppercase tracking-widest text-slate-400">
              Hourly data:{" "}
              {formatDay(
                activeDay.date
              )}
            </div>
          )}

          <div className="mt-10 text-center text-[10px] text-slate-400">
            Live weather data · Open-Meteo
          </div>
        </div>
      </section>

      {/* ===================================================
          DIGITAL TWIN
          =================================================== */}

      <section
        id="about"
        className="bg-white py-28"
      >
        <div className="mx-auto w-[90%] max-w-[1250px]">

          <div className="grid gap-10 border-b border-slate-200 pb-12 md:grid-cols-2 md:items-end">

            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                Digital twin
              </div>

              <h2 className="mt-4 text-5xl font-medium leading-[0.98] tracking-[-3px] text-slate-900 md:text-6xl">
                Chennai as
                <br />
                a living map.
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-7 text-slate-500 md:justify-self-end">
              Terrain, flood forecast, drainage and
              infrastructure can be examined together
              inside a spatial model of the city.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1.65fr_0.8fr]">

            {/* =================================================
                GIS MAP
                ================================================= */}

            <div className="relative min-h-[560px] overflow-hidden border border-slate-300 bg-[#e9edf0]">

              <svg
                viewBox="0 0 1000 600"
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
              >
                {/* BASE */}

                <rect
                  width="1000"
                  height="600"
                  fill="#e9edf0"
                />

                {/* TERRAIN CONTOURS */}

                <path
                  d="M-20 150 C160 90 280 190 420 130 S760 70 1020 150"
                  fill="none"
                  stroke="#cbd5d1"
                  strokeWidth="2"
                />

                <path
                  d="M-20 190 C170 130 300 225 440 165 S760 110 1020 185"
                  fill="none"
                  stroke="#d1d8d5"
                  strokeWidth="2"
                />

                <path
                  d="M-20 235 C150 175 300 270 450 210 S760 160 1020 235"
                  fill="none"
                  stroke="#d1d8d5"
                  strokeWidth="2"
                />

                <path
                  d="M-20 285 C170 225 310 320 465 255 S770 210 1020 280"
                  fill="none"
                  stroke="#d1d8d5"
                  strokeWidth="2"
                />

                <path
                  d="M-20 340 C160 280 300 370 450 320 S760 260 1020 335"
                  fill="none"
                  stroke="#d1d8d5"
                  strokeWidth="2"
                />

                {/* URBAN BLOCKS */}

                {[
                  [90, 120, 120, 55],
                  [245, 105, 90, 70],
                  [390, 135, 125, 55],
                  [570, 95, 110, 80],
                  [735, 135, 130, 60],

                  [130, 300, 115, 70],
                  [290, 285, 125, 85],
                  [470, 315, 100, 65],
                  [625, 285, 145, 80],
                  [805, 315, 95, 60],

                  [95, 430, 145, 65],
                  [300, 420, 100, 75],
                  [455, 445, 135, 60],
                  [660, 425, 110, 75],
                  [820, 440, 100, 55],
                ].map(
                  (
                    [x, y, w, h],
                    index
                  ) => (
                    <rect
                      key={index}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={
                        activeLayer ===
                        "infrastructure"
                          ? "#d9e8e1"
                          : "#eef1f2"
                      }
                      stroke="#c4cdca"
                    />
                  )
                )}

                {/* PRIMARY ROADS */}

                <path
                  d="M30 370 C220 330 310 360 455 300 S760 265 970 315"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="18"
                />

                <path
                  d="M30 370 C220 330 310 360 455 300 S760 265 970 315"
                  fill="none"
                  stroke="#aab5b3"
                  strokeWidth="2"
                />

                <path
                  d="M250 40 C260 170 300 250 430 330 S600 450 690 600"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="15"
                />

                <path
                  d="M250 40 C260 170 300 250 430 330 S600 450 690 600"
                  fill="none"
                  stroke="#aab5b3"
                  strokeWidth="2"
                />

                {/* SECONDARY ROADS */}

                <path
                  d="M80 230 L920 500"
                  fill="none"
                  stroke="#d0d6d5"
                  strokeWidth="7"
                />

                <path
                  d="M80 500 L880 100"
                  fill="none"
                  stroke="#d0d6d5"
                  strokeWidth="7"
                />

                {/* DRAINAGE */}

                {activeLayer ===
                  "drainage" && (
                  <>
                    <path
                      d="M80 455 C230 390 300 430 410 395 S690 350 930 405"
                      fill="none"
                      stroke="#238b72"
                      strokeWidth="3"
                    />

                    <path
                      d="M190 120 C250 220 290 290 400 350"
                      fill="none"
                      stroke="#238b72"
                      strokeWidth="3"
                    />

                    <path
                      d="M520 70 C500 190 560 250 650 330"
                      fill="none"
                      stroke="#238b72"
                      strokeWidth="3"
                    />
                  </>
                )}

                {/* FLOOD FORECAST */}

                {activeLayer ===
                  "forecast" && (
                  <>
                    <path
                      d={`M120 ${
                        380 -
                        selectedForecast * 7
                      }
                      C210 ${
                        315 -
                        selectedForecast * 5
                      }
                      310 ${
                        345 -
                        selectedForecast * 8
                      }
                      400 ${
                        355 -
                        selectedForecast * 4
                      }
                      C500 ${
                        370 -
                        selectedForecast * 7
                      }
                      600 ${
                        345 -
                        selectedForecast * 5
                      }
                      730 ${
                        375 -
                        selectedForecast * 8
                      }
                      L770 455
                      C600 470 420 455 270 475
                      Z`}
                      fill="#3b82f6"
                      fillOpacity={
                        0.08 +
                        selectedForecast *
                          0.012
                      }
                      stroke="#2563eb"
                      strokeWidth="1.5"
                      strokeDasharray="6 5"
                    />

                    <path
                      d={`M610 ${
                        210 +
                        selectedForecast * 4
                      }
                      C690 ${
                        185 +
                        selectedForecast * 5
                      }
                      800 ${
                        200 +
                        selectedForecast * 4
                      }
                      885 ${
                        250 +
                        selectedForecast * 6
                      }
                      L850 335
                      C760 310 690 330 625 300
                      Z`}
                      fill="#60a5fa"
                      fillOpacity={
                        0.07 +
                        selectedForecast *
                          0.01
                      }
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeDasharray="6 5"
                    />
                  </>
                )}

                {/* TERRAIN ACTIVE */}

                {activeLayer ===
                  "terrain" && (
                  <>
                    <ellipse
                      cx="490"
                      cy="310"
                      rx="350"
                      ry="190"
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="2"
                      strokeDasharray="9 7"
                    />

                    <ellipse
                      cx="490"
                      cy="310"
                      rx="280"
                      ry="145"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="9 7"
                    />

                    <ellipse
                      cx="490"
                      cy="310"
                      rx="210"
                      ry="105"
                      fill="none"
                      stroke="#aeb8c2"
                      strokeWidth="2"
                      strokeDasharray="9 7"
                    />
                  </>
                )}
              </svg>

              {/* MAP HEADER */}

              <div className="absolute left-6 top-6 border border-slate-300 bg-white px-4 py-3 shadow-sm">
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Chennai
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  Urban Digital Twin
                </div>
              </div>

              {/* ACTIVE LAYER */}

              <div className="absolute right-6 top-6 border border-slate-300 bg-white px-4 py-3 text-right shadow-sm">

                <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                  Active layer
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {
                    TWIN_LAYERS.find(
                      (item) =>
                        item.id ===
                        activeLayer
                    )?.title
                  }
                </div>
              </div>

              {/* SCALE */}

              <div className="absolute bottom-6 left-6">
                <div className="h-2 w-24 border-x border-b border-slate-600" />

                <div className="mt-1 flex justify-between font-mono text-[8px] text-slate-500">
                  <span>0</span>
                  <span>1 km</span>
                </div>
              </div>

              {/* NORTH */}

              <div className="absolute bottom-6 right-6 text-center">
                <div className="text-xs font-semibold text-slate-600">
                  N
                </div>

                <div className="mx-auto mt-1 h-8 w-px bg-slate-500" />
              </div>

              {/* FORECAST TIME */}

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 border border-slate-300 bg-white px-4 py-2 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-600 shadow-sm">
                Forecast:{" "}
                {selectedNowcast.minutes ===
                0
                  ? "Current"
                  : `+${selectedNowcast.minutes} min`}
              </div>
            </div>

            {/* =================================================
                LAYER PANEL
                ================================================= */}

            <div className="border border-slate-200 bg-white">

              {TWIN_LAYERS.map(
                (layer) => {
                  const active =
                    activeLayer ===
                    layer.id;

                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() =>
                        setActiveLayer(
                          layer.id
                        )
                      }
                      className={`group flex w-full border-b border-slate-200 p-6 text-left transition ${
                        active
                          ? "bg-emerald-50/60"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="mr-5 font-mono text-[10px] font-semibold text-emerald-700">
                        {layer.number}
                      </div>

                      <div className="flex-1">

                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-slate-900">
                            {layer.title}
                          </h3>

                          <span
                            className={`text-sm ${
                              active
                                ? "text-emerald-700"
                                : "text-slate-300 group-hover:text-slate-500"
                            }`}
                          >
                            →
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-6 text-slate-500">
                          {layer.description}
                        </p>

                        {active && (
                          <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                            Selected
                          </div>
                        )}
                      </div>
                    </button>
                  );
                }
              )}

              {/* FIXED CONTRAST CTA */}

              <Link
                href="/dashboard"
                className="group flex w-full items-center justify-between bg-emerald-600 px-6 py-5 text-sm font-semibold !text-white transition hover:bg-emerald-700"
              >
                <span className="!text-white">
                  Open full command center
                </span>

                <span className="text-lg !text-white transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          FLOOD FORECAST
          =================================================== */}

      <section
        id="forecast"
        className="border-b border-slate-800 bg-[#111827] py-28 text-white"
      >
        <div className="mx-auto w-[90%] max-w-[1250px]">

          <div className="flex flex-col justify-between gap-8 border-b border-white/10 pb-10 md:flex-row md:items-end">

            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                Flood forecast
              </div>

              <h2 className="mt-4 text-5xl font-medium tracking-[-3px] md:text-6xl">
                Watch the next
                <br />
                three hours.
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
                Select a forecast step to inspect the
                landing-page preview. Backend forecast
                results can replace these values later.
              </p>
            </div>

            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              0 → 180 minutes
            </div>
          </div>

          {/* WORKSPACE */}

          <div className="mt-10 grid overflow-hidden border border-white/10 lg:grid-cols-[1fr_330px]">

            {/* MAP */}

            <div className="relative min-h-[570px] bg-[#dfe5e4]">

              <svg
                viewBox="0 0 1000 570"
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
              >
                <rect
                  width="1000"
                  height="570"
                  fill="#dfe5e4"
                />

                {/* ROADS */}

                <g
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="14"
                >
                  <path d="M30 150 L970 470" />
                  <path d="M80 470 L880 80" />
                  <path d="M270 20 L650 550" />
                  <path d="M20 330 L980 250" />
                  <path d="M500 0 L430 570" />
                </g>

                <g
                  fill="none"
                  stroke="#aeb9b7"
                  strokeWidth="2"
                >
                  <path d="M30 150 L970 470" />
                  <path d="M80 470 L880 80" />
                  <path d="M270 20 L650 550" />
                  <path d="M20 330 L980 250" />
                  <path d="M500 0 L430 570" />
                </g>

                {/* CITY BLOCKS */}

                {Array.from({
                  length: 42,
                }).map((_, index) => {
                  const col =
                    index % 7;

                  const row =
                    Math.floor(
                      index / 7
                    );

                  const x =
                    70 + col * 125;

                  const y =
                    65 + row * 82;

                  return (
                    <rect
                      key={index}
                      x={x}
                      y={y}
                      width="78"
                      height="46"
                      fill="#edf0ef"
                      stroke="#c4cdca"
                    />
                  );
                })}

                {/* FLOOD EXTENT */}

                <path
                  d={`M120 ${
                    350 -
                    selectedForecast * 5
                  }
                  C210 ${
                    290 -
                    selectedForecast * 4
                  }
                  320 ${
                    320 -
                    selectedForecast * 6
                  }
                  420 ${
                    330 -
                    selectedForecast * 4
                  }
                  C550 ${
                    350 -
                    selectedForecast * 5
                  }
                  660 ${
                    310 -
                    selectedForecast * 6
                  }
                  810 ${
                    350 -
                    selectedForecast * 4
                  }
                  L860 450
                  C690 480 500 450 330 480
                  C240 470 180 455 120 430 Z`}
                  fill="#3b82f6"
                  fillOpacity={
                    0.08 +
                    selectedForecast *
                      0.012
                  }
                  stroke="#2563eb"
                  strokeWidth="1.5"
                  strokeDasharray="7 6"
                />

                {/* SECONDARY FLOOD */}

                <path
                  d={`M600 ${
                    155 +
                    selectedForecast * 4
                  }
                  C700 ${
                    130 +
                    selectedForecast * 5
                  }
                  815 ${
                    160 +
                    selectedForecast * 5
                  }
                  900 ${
                    210 +
                    selectedForecast * 6
                  }
                  L875 290
                  C780 270 690 295 620 260
                  Z`}
                  fill="#60a5fa"
                  fillOpacity="0.10"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="7 6"
                />

                {/* DRAINAGE */}

                <g
                  fill="none"
                  stroke="#16866e"
                  strokeWidth="3"
                  opacity={
                    activeLayer ===
                    "drainage"
                      ? 1
                      : 0.3
                  }
                >
                  <path d="M60 420 C230 350 350 430 500 380 S780 350 950 420" />

                  <path d="M210 50 C250 170 300 250 430 360" />

                  <path d="M610 40 C580 170 640 260 730 340" />
                </g>

                {/* REFERENCE POINT */}

                <circle
                  cx="535"
                  cy="350"
                  r="8"
                  fill="#dc2626"
                />

                <circle
                  cx="535"
                  cy="350"
                  r="16"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  opacity="0.5"
                />
              </svg>

              {/* MAP HEADER */}

              <div className="absolute left-6 top-6 border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm">

                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Chennai
                </div>

                <div className="mt-1 text-sm font-semibold">
                  Flood forecast
                </div>
              </div>

              {/* FORECAST TIME */}

              <div className="absolute right-6 top-6 border border-slate-300 bg-white px-4 py-3 text-right text-slate-900 shadow-sm">

                <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                  Forecast horizon
                </div>

                <div className="mt-1 text-sm font-semibold">
                  {selectedNowcast.minutes ===
                  0
                    ? "NOW"
                    : `+${selectedNowcast.minutes} MIN`}
                </div>
              </div>

              {/* LEGEND */}

              <div className="absolute bottom-6 left-6 border border-slate-300 bg-white p-4 text-[9px] text-slate-600 shadow-sm">

                <div className="mb-3 font-bold uppercase tracking-[0.16em] text-slate-500">
                  Map legend
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-5 bg-blue-500/50" />
                  Forecast extent
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="h-[2px] w-5 bg-emerald-700" />
                  Drainage
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  Reference point
                </div>
              </div>

              {/* ACTIVE LAYER */}

              <div className="absolute bottom-6 right-6 border border-slate-300 bg-white px-4 py-3 text-right text-slate-900 shadow-sm">

                <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
                  Layer
                </div>

                <div className="mt-1 text-xs font-semibold">
                  {
                    TWIN_LAYERS.find(
                      (item) =>
                        item.id ===
                        activeLayer
                    )?.title
                  }
                </div>
              </div>
            </div>

            {/* SIDE PANEL */}

            <div className="bg-[#17212b]">

              <div className="border-b border-white/10 p-6">

                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                  Forecast timeline
                </div>

                <div className="mt-5 grid grid-cols-4 gap-1">
                  {NOWCAST_STEPS.map(
                    (
                      step,
                      index
                    ) => (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() =>
                          setSelectedForecast(
                            index
                          )
                        }
                        className={`border px-2 py-2 text-[10px] font-semibold transition ${
                          selectedForecast ===
                          index
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {step.label}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="p-6">

                {/* DEPTH */}

                <div className="border-b border-white/10 pb-6">

                  <div className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
                    Estimated depth
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-4xl font-medium text-white">
                      {selectedNowcast.depth.toFixed(
                        2
                      )}
                    </span>

                    <span className="pb-1 text-sm text-slate-500">
                      m
                    </span>
                  </div>
                </div>

                {/* METRICS */}

                <div className="grid grid-cols-2 border-b border-white/10">

                  <div className="border-r border-white/10 py-6 pr-4">

                    <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                      Rainfall
                    </div>

                    <div className="mt-2 text-lg font-medium text-white">
                      {
                        selectedNowcast.rainfall
                      }{" "}
                      <span className="text-xs text-slate-500">
                        mm
                      </span>
                    </div>
                  </div>

                  <div className="py-6 pl-4">

                    <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                      Drain stress
                    </div>

                    <div className="mt-2 text-lg font-medium text-white">
                      {selectedNowcast.drainageStress.toFixed(
                        2
                      )}
                    </div>
                  </div>
                </div>

                {/* NEAREST DRAIN */}

                <div className="border-b border-white/10 py-6">

                  <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                    Nearest drain
                  </div>

                  <div className="mt-2 text-lg font-medium text-white">
                    {
                      selectedNowcast.nearestDrain
                    }{" "}
                    <span className="text-xs text-slate-500">
                      metres
                    </span>
                  </div>
                </div>

                {/* RISK */}

                <div className="pt-6">

                  <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                    Risk status
                  </div>

                  <div
                    className={`mt-3 inline-flex border px-3 py-2 text-xs font-bold tracking-wide ${
                      selectedNowcast.risk ===
                      "LOW"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : selectedNowcast.risk ===
                          "MODERATE"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : selectedNowcast.risk ===
                          "HIGH"
                        ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                        : "border-red-500/30 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {
                      selectedNowcast.risk
                    }
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  className="mt-8 flex items-center justify-between border border-white/15 px-4 py-4 text-xs font-semibold !text-white transition hover:border-emerald-500 hover:bg-white/[0.03]"
                >
                  <span className="!text-white">
                    Open command center
                  </span>

                  <span className="!text-white">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* TIMELINE */}

          <div className="mt-5 border border-white/10 bg-[#17212b] p-4">

            <div className="mb-3 flex justify-between text-[9px] uppercase tracking-[0.14em] text-slate-500">
              <span>Current</span>
              <span>Forecast horizon</span>
            </div>

            <div className="relative h-1 bg-white/10">

              <div
                className="absolute left-0 top-0 h-1 bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${
                    (selectedForecast /
                      (NOWCAST_STEPS.length -
                        1)) *
                    100
                  }%`,
                }}
              />

              {NOWCAST_STEPS.map(
                (
                  step,
                  index
                ) => (
                  <button
                    key={step.key}
                    type="button"
                    aria-label={`Select ${step.label}`}
                    onClick={() =>
                      setSelectedForecast(
                        index
                      )
                    }
                    className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 transition ${
                      selectedForecast ===
                      index
                        ? "border-emerald-400 bg-emerald-500"
                        : "border-slate-500 bg-[#17212b] hover:border-white"
                    }`}
                    style={{
                      left: `${
                        (index /
                          (NOWCAST_STEPS.length -
                            1)) *
                        100
                      }%`,
                      transform:
                        "translate(-50%, -50%)",
                    }}
                  />
                )
              )}
            </div>

            <div className="mt-5 grid grid-cols-7">
              {NOWCAST_STEPS.map(
                (
                  step,
                  index
                ) => (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() =>
                      setSelectedForecast(
                        index
                      )
                    }
                    className={`text-center text-[10px] ${
                      selectedForecast ===
                      index
                        ? "font-bold text-emerald-400"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {step.label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          HOW IT WORKS
          =================================================== */}

      <section className="bg-white py-28">
        <div className="mx-auto w-[90%] max-w-[1200px]">

          <div className="grid gap-16 md:grid-cols-[0.8fr_1.2fr]">

            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                System approach
              </div>

              <h2 className="mt-5 text-5xl font-medium leading-[1] tracking-[-3px] text-slate-900">
                From rainfall
                <br />
                to street risk.
              </h2>
            </div>

            <div>

              {[
                {
                  number: "01",
                  title: "Observe",
                  text:
                    "Current weather and rainfall conditions establish the environmental state.",
                },
                {
                  number: "02",
                  title: "Model",
                  text:
                    "Terrain, drainage and urban infrastructure provide spatial context.",
                },
                {
                  number: "03",
                  title: "Forecast",
                  text:
                    "The system exposes flood conditions through a short-term nowcast window.",
                },
                {
                  number: "04",
                  title: "Act",
                  text:
                    "The command center provides a common spatial view for interpreting flood conditions.",
                },
              ].map(
                (item) => (
                  <div
                    key={item.number}
                    className="grid grid-cols-[50px_1fr] border-t border-slate-200 py-7"
                  >
                    <div className="font-mono text-[10px] font-bold text-emerald-700">
                      {item.number}
                    </div>

                    <div>
                      <h3 className="text-xl font-medium text-slate-900">
                        {item.title}
                      </h3>

                      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          FINAL CTA
          =================================================== */}

      <section className="bg-[#111827] py-28 text-white">
        <div className="mx-auto w-[90%] max-w-[1200px]">

          <div className="border-t border-white/10 pt-10 text-center">

            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Chennai Flood Twin
            </div>

            <h2 className="mx-auto mt-6 max-w-4xl text-5xl font-medium leading-[0.98] tracking-[-3px] md:text-7xl">
              See the city.
              <br />
              Understand the flood.
            </h2>

            <p className="mx-auto mt-7 max-w-2xl text-sm leading-7 text-slate-400">
              Explore the interactive digital twin and
              flood intelligence command center.
            </p>

            <div className="mt-10 flex justify-center">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-6 bg-emerald-500 px-7 py-4 text-sm font-semibold !text-white transition hover:bg-emerald-600"
              >
                <span className="!text-white">
                  Enter Digital Twin
                </span>

                <span className="text-lg !text-white transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          FOOTER
          =================================================== */}

      <footer className="border-t border-white/10 bg-[#111827] px-[5%] py-7 text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-3 text-[10px] text-slate-500 sm:flex-row">

          <span>
            © 2026 Chennai Flood Twin
          </span>

          <span>
            Urban Flood Intelligence
          </span>

          <span>
            Chennai, Tamil Nadu
          </span>
        </div>
      </footer>
    </main>
  );
}