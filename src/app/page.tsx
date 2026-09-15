"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// =========================================================
// TYPES
// =========================================================

type Tab = "temperature" | "precipitation" | "wind";

interface HourlyItem {
  time: string;
  temperature: number;
  precipitation: number;
  precipitationProbability: number;
  wind: number;
  windDirection: number;
  weatherCode: number;
}

interface DailyItem {
  date: string;
  high: number;
  low: number;
  weatherCode: number;
}

interface WeatherState {
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    wind: number;
    weatherCode: number;
  };
  hourly: HourlyItem[];
  daily: DailyItem[];
}

// =========================================================
// HELPERS
// =========================================================

const CHART_W = 1000;
const CHART_H = 250;
const PAD_TOP = 40;
const PAD_BOTTOM = 30;

// Format ISO hour → "10 AM"
function formatHour(iso: string) {
  const d = new Date(iso);
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    })
    .replace(":00", "");
}

// Format ISO date → "Tue"
function formatDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// Weather code → emoji
function getWeatherIcon(code: number) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67].includes(code)) return "🌧️";
  if ([71, 73, 75, 77].includes(code)) return "❄️";
  if ([80, 81, 82].includes(code)) return "🌧️";
  if ([85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}

// Weather code → text
function getWeatherText(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Partly sunny";
}

// Wind degrees → arrow
function directionArrow(deg: number) {
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return arrows[idx];
}

// Build smooth SVG path from values
function buildPaths(values: number[]) {
  if (values.length === 0) {
    return { line: "", area: "" };
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = CHART_W / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y =
      PAD_TOP + (1 - (v - min) / range) * (CHART_H - PAD_TOP - PAD_BOTTOM);
    return { x, y };
  });

  const line = points
    .map((p, i) => {
      if (i === 0) return `M${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cx1 = prev.x + (p.x - prev.x) / 2;
      const cx2 = prev.x + (p.x - prev.x) / 2;
      return `C${cx1} ${prev.y} ${cx2} ${p.y} ${p.x} ${p.y}`;
    })
    .join(" ");

  const area = `${line} L${CHART_W} ${CHART_H} L0 ${CHART_H} Z`;
  return { line, area };
}

// Extract 8 hourly slices starting at 2pm today (or from index)
function pick8Hourly(hourly: HourlyItem[], startHour = 14): HourlyItem[] {
  if (hourly.length === 0) return [];

  // Find index of start hour
  let startIdx = hourly.findIndex((h) => {
    const hour = new Date(h.time).getHours();
    return hour === startHour;
  });

  if (startIdx === -1) startIdx = 0;

  // Take every 3rd hour → 8 points covering 24 hours
  const picked: HourlyItem[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = (startIdx + i * 3) % hourly.length;
    picked.push(hourly[idx]);
  }
  return picked;
}

// =========================================================
// HOME
// =========================================================

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [now, setNow] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("temperature");
  const [selectedDay, setSelectedDay] = useState(0);

  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);

  // ---- Fetch Open-Meteo ----
  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast" +
          "?latitude=13.0827&longitude=80.2707" +
          "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code" +
          "&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code" +
          "&daily=temperature_2m_max,temperature_2m_min,weather_code" +
          "&timezone=Asia%2FKolkata&forecast_days=7";

        const res = await fetch(url);
        const data = await res.json();

        if (cancelled) return;

        const hourly: HourlyItem[] = (data.hourly?.time || []).map(
          (time: string, i: number) => ({
            time,
            temperature: data.hourly.temperature_2m?.[i] ?? 0,
            precipitation: data.hourly.precipitation?.[i] ?? 0,
            precipitationProbability:
              data.hourly.precipitation_probability?.[i] ?? 0,
            wind: data.hourly.wind_speed_10m?.[i] ?? 0,
            windDirection: data.hourly.wind_direction_10m?.[i] ?? 0,
            weatherCode: data.hourly.weather_code?.[i] ?? 0,
          })
        );

        const daily: DailyItem[] = (data.daily?.time || []).map(
          (date: string, i: number) => ({
            date,
            high: data.daily.temperature_2m_max?.[i] ?? 0,
            low: data.daily.temperature_2m_min?.[i] ?? 0,
            weatherCode: data.daily.weather_code?.[i] ?? 0,
          })
        );

        setWeather({
          current: {
            temperature: data.current?.temperature_2m ?? 0,
            humidity: data.current?.relative_humidity_2m ?? 0,
            precipitation: data.current?.precipitation ?? 0,
            wind: data.current?.wind_speed_10m ?? 0,
            weatherCode: data.current?.weather_code ?? 0,
          },
          hourly,
          daily,
        });
      } catch (err) {
        console.error("Failed to fetch weather", err);
      } finally {
        if (!cancelled) setLoadingWeather(false);
      }
    }

    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Video speed ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 2.0;
    v.play().catch(() => {});
  }, []);

  // ---- Live clock ----
  useEffect(() => {
    const update = () => {
      const d = new Date();
      const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
      const time = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setNow(`${weekday} ${time}`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  // ---- Scroll detection ----
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ---- Derived hourly data for selected day ----
  const dayHourly: HourlyItem[] = (() => {
    if (!weather) return [];
    const start = selectedDay * 24;
    const end = start + 24;
    return weather.hourly.slice(start, end);
  })();

  const pickedHourly = pick8Hourly(dayHourly, 14);
  const chartHourly = pickedHourly.length > 0 ? pickedHourly : dayHourly.slice(0, 8);

  const chartValues = chartHourly.map((h) => {
    if (activeTab === "temperature") return Math.round(h.temperature);
    if (activeTab === "precipitation") return h.precipitation;
    return Math.round(h.wind);
  });

  const { line: CHART_LINE, area: CHART_AREA } = buildPaths(chartValues);

  // ---- Derived daily forecast ----
  const forecast = weather?.daily ?? [];
  const activeDay = forecast[selectedDay];

  // ---- Current display values ----
  const currentTemp = weather ? Math.round(weather.current.temperature) : 33;
  const currentHumidity = weather ? weather.current.humidity : 54;
  const currentPrecip = weather ? weather.current.precipitation : 0;
  const currentWind = weather ? Math.round(weather.current.wind) : 3;
  const currentIcon = weather ? getWeatherIcon(weather.current.weatherCode) : "⛅";
  const currentText = weather
    ? getWeatherText(weather.current.weatherCode)
    : "Partly sunny";

  return (
    <main className="home-page">

      {/* NAVBAR */}
      <nav
        className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}
        aria-label="Main navigation"
      >
        <Link href="/" className="logo">
  <img
    src="/jalsetu-logo.jpeg"
    alt="JALSETU Logo"
    className="logo-image"
  />

  <div>
    <div className="logo-title">JALSETU</div>
    <div className="logo-subtitle">
      Urban Flood Intelligence
    </div>
  </div>
</Link>

        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="#weather">Weather</Link>
          <Link href="#alerts">Alerts</Link>
          <Link href="#about">About</Link>
        </div>

        <div className="nav-actions">
          <Link href="/login" className="login-button">Login</Link>
          <Link href="/signup" className="signup-button">Sign Up</Link>
        </div>
      </nav>

      {/* HERO */}
      <section id="home" className="hero">
        <video
          ref={videoRef}
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src="/videos/chennai-flood.mp4" type="video/mp4" />
        </video>

        <div className="hero-overlay"></div>

        <div className="hero-content">
          <div className="live-badge">
            <span className="live-dot"></span>
            LIVE URBAN FLOOD INTELLIGENCE
          </div>

          <h1>
            Chennai.
            <br />
            One City.
            <br />
            <span>One Digital Twin.</span>
          </h1>

          <p>
            Predict urban flooding before it reaches the streets using
            real-time rainfall, terrain intelligence and 3D flood simulation.
          </p>

          <div className="hero-buttons">
            <Link href="/dashboard" className="explore-button">
              Explore 3D Twin <span>→</span>
            </Link>
            <Link href="#weather" className="weather-button">
              View Live Weather
            </Link>
          </div>

          <div className="hero-stats">
            <div><strong>0–3H</strong><span>Flood Nowcast</span></div>
            <div className="stat-line"></div>
            <div><strong>3D</strong><span>Digital Twin</span></div>
            <div className="stat-line"></div>
            <div><strong>LIVE</strong><span>Rainfall Data</span></div>
          </div>
        </div>

        <div className="video-indicator">
          <span></span>
          CHENNAI DIGITAL TWIN
        </div>
      </section>

      {/* WEATHER DASHBOARD */}
      <section id="weather" className="weather-section">
        <div className="weather-container">

          {/* LOCATION */}
          <div className="weather-location">
            <div className="location-left">
              <span className="location-icon">◎</span>
              <strong>Chennai, Tamil Nadu</strong>
            </div>
            <button className="location-button">Use my location</button>
          </div>

          {/* CURRENT WEATHER */}
          <div className="weather-current">
            <div className="current-left">
              <div className="weather-big-icon">{currentIcon}</div>
              <div className="current-left-text">
                <div className="temperature-row">
                  <span className="temperature-big">
                    {loadingWeather ? "--" : currentTemp}
                  </span>
                  <span className="temp-units">
                    °C <span className="unit-sep">|</span> °F
                  </span>
                </div>
                <div className="weather-condition">
                  <div>
                    Precipitation:{" "}
                    {loadingWeather ? "--" : currentPrecip}%
                  </div>
                  <div>
                    Humidity: {loadingWeather ? "--" : currentHumidity}%
                  </div>
                  <div>
                    Wind: {loadingWeather ? "--" : currentWind} km/h
                  </div>
                </div>
              </div>
            </div>

            <div className="weather-spacer" />

            <div className="weather-time">
              <strong>Weather</strong>
              <span suppressHydrationWarning>{now || "—"}</span>
              <span>{loadingWeather ? "Loading…" : currentText}</span>
            </div>
          </div>

          {/* TABS */}
          <div className="weather-tabs">
            <button
              className={`weather-tab ${activeTab === "temperature" ? "active" : ""}`}
              onClick={() => setActiveTab("temperature")}
            >
              Temperature
            </button>
            <button
              className={`weather-tab ${activeTab === "precipitation" ? "active" : ""}`}
              onClick={() => setActiveTab("precipitation")}
            >
              Precipitation
            </button>
            <button
              className={`weather-tab ${activeTab === "wind" ? "active" : ""}`}
              onClick={() => setActiveTab("wind")}
            >
              Wind
            </button>
          </div>

          {/* CHART */}
          <div className="weather-chart">

            {/* VALUES ROW */}
            <div className="chart-values">
              {loadingWeather
                ? Array.from({ length: 8 }).map((_, i) => (
                    <span key={i}>--</span>
                  ))
                : chartValues.map((v, i) => (
                    <span key={i}>
                      {v}
                      {activeTab === "temperature"
                        ? "°"
                        : activeTab === "precipitation"
                        ? " mm"
                        : " km/h"}
                    </span>
                  ))}
            </div>

            {/* WIND */}
            {activeTab === "wind" && (
              <div className="wind-data">
                {chartHourly.map((h, index) => (
                  <div className="wind-column" key={index}>
                    <span className="wind-speed">
                      {Math.round(h.wind)} km/h
                    </span>
                    <span className="wind-arrow">
                      {directionArrow(h.windDirection)}
                    </span>
                    <span className="wind-time">
                      {formatHour(h.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* PRECIPITATION */}
            {activeTab === "precipitation" && (
              <div className="precipitation-chart">
                {chartValues.map((value, index) => (
                  <div className="precip-column" key={index}>
                    <div className="precip-bar-area">
                      <div
                        className="precip-bar"
                        style={{
                          height: `${Math.max(
                            value * 22,
                            value > 0 ? 8 : 2
                          )}px`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TEMPERATURE */}
            {activeTab === "temperature" && (
              <div className="chart-wrapper">
                <svg
                  className="weather-graph"
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="temperatureGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#16a34a"
                        stopOpacity="0.22"
                      />
                      <stop
                        offset="100%"
                        stopColor="#16a34a"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>

                  <path
                    d={CHART_AREA}
                    fill="url(#temperatureGradient)"
                  />

                  <path
                    d={CHART_LINE}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}

            {/* HOUR LABELS */}
            {activeTab !== "wind" && (
              <div className="hour-labels">
                {chartHourly.map((h, i) => (
                  <span key={i}>{formatHour(h.time)}</span>
                ))}
              </div>
            )}
          </div>

          {/* FORECAST */}
          <div className="forecast">
            {(forecast.length > 0
              ? forecast
              : Array.from({ length: 7 }).map((_, i) => ({
                  date: "",
                  high: 0,
                  low: 0,
                  weatherCode: 0,
                }))
            ).map((d, i) => (
              <button
                key={i}
                className={`forecast-day ${
                  selectedDay === i ? "forecast-active" : ""
                }`}
                onClick={() => setSelectedDay(i)}
              >
                <span className="forecast-day-name">
                  {d.date ? formatDay(d.date) : "--"}
                </span>
                <span className="forecast-icon">
                  {d.date ? getWeatherIcon(d.weatherCode) : "⛅"}
                </span>
                <span className="forecast-temperature">
                  <strong>
                    {d.date ? Math.round(d.high) : "--"}°
                  </strong>
                  <span>
                    {d.date ? Math.round(d.low) : "--"}°
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="weather-source">
            Live weather data • Open-Meteo • Chennai Flood Twin
          </div>

        </div>
      </section>

      {/* DIGITAL TWIN */}
      <section id="alerts" className="twin-section">
        <div className="twin-container">
          <div className="section-label">DIGITAL TWIN</div>

          <h2>
            See Chennai
            <br />
            <span>before the flood.</span>
          </h2>

          <p>
            Explore terrain, buildings, roads and simulated flood water
            through an interactive 3D digital twin.
          </p>

          <Link href="/dashboard" className="explore-button">
            Launch Digital Twin <span>→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="about" className="footer">
        <span>© 2026 Chennai Flood Twin</span>
        <span>Urban Flood Intelligence</span>
      </footer>

    </main>
  );
}