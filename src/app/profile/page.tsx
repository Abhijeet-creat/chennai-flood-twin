"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type User = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  locationType?: "current" | "manual";
  alertEnabled?: boolean;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const currentUser = localStorage.getItem("currentUser");
      const signupUser = localStorage.getItem("floodTwinUser");

      if (currentUser) {
        setUser(JSON.parse(currentUser));
      } else if (signupUser) {
        setUser(JSON.parse(signupUser));
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");

    window.location.href = "/";
  };

  const firstLetter =
    user?.name?.charAt(0).toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-[#f7faf8] text-slate-800">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <nav className="fixed left-0 right-0 top-0 z-50 h-[84px] border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">

        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">

          {/* LOGO */}

          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <img
              src="/jalsetu-logo.jpeg"
              alt="JALSETU"
              className="h-14 w-14 rounded-lg object-cover"
            />

            <div>
              <div className="text-[23px] font-extrabold tracking-wide text-green-600">
                JALSETU
              </div>

              <div className="text-[8px] font-bold tracking-[0.2em] text-green-600">
                URBAN FLOOD INTELLIGENCE
              </div>
            </div>
          </Link>

          {/* NAVIGATION */}

          <div className="hidden items-center gap-10 md:flex">

            <Link
              href="/"
              className="text-sm font-medium text-slate-600 transition hover:text-green-600"
            >
              Home
            </Link>

            <Link
              href="/#weather"
              className="text-sm font-medium text-slate-600 transition hover:text-green-600"
            >
              Weather
            </Link>

            <Link
              href="/#alerts"
              className="text-sm font-medium text-slate-600 transition hover:text-green-600"
            >
              Alerts
            </Link>

            <Link
              href="/#about"
              className="text-sm font-medium text-slate-600 transition hover:text-green-600"
            >
              About
            </Link>

          </div>

          {/* PROFILE */}

          <Link
            href="/profile"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-600 transition hover:bg-green-100"
            aria-label="Profile"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="8" r="3.5" />
              <path
                d="M5 21c.6-4 3-6 7-6s6.4 2 7 6"
                strokeLinecap="round"
              />
            </svg>
          </Link>

        </div>
      </nav>

      {/* =====================================================
          PROFILE PAGE
      ===================================================== */}

      <section className="min-h-screen bg-gradient-to-b from-white via-[#f7faf8] to-[#eef7f1] pt-[84px]">

        <div className="mx-auto max-w-6xl px-5 py-12">

          {/* BACK BUTTON */}

          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-green-600"
          >
            <span className="text-lg">←</span>
            Back to Home
          </Link>

          {/* PAGE TITLE */}

          <div className="mb-8">

            <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-green-600">
              JALSETU ACCOUNT
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              My Profile
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage your personal information and flood-alert preferences.
            </p>

          </div>

          {loading ? (

            /* LOADING */

            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">

              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-green-100 border-t-green-600" />

              <p className="text-sm text-slate-500">
                Loading profile...
              </p>

            </div>

          ) : (

            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">

              {/* =================================================
                  PROFILE CARD
              ================================================= */}

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

                {/* GREEN HEADER */}

                <div className="relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-500 px-7 py-8">

                  <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />

                  <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />

                  <div className="relative flex items-center gap-5">

                    {/* AVATAR */}

                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white/80 bg-white text-3xl font-bold text-green-600 shadow-lg">
                      {firstLetter}
                    </div>

                    <div className="min-w-0 text-white">

                      <h2 className="truncate text-2xl font-bold">
                        {user?.name || "User"}
                      </h2>

                      <p className="mt-1 truncate text-sm text-white/80">
                        {user?.email || "Email not available"}
                      </p>

                      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                        <span className="h-2 w-2 rounded-full bg-white" />
                        Account Active
                      </div>

                    </div>

                  </div>

                </div>

                {/* INFORMATION */}

                <div className="p-7">

                  <div className="mb-5">

                    <h3 className="text-lg font-semibold text-slate-900">
                      Account Information
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      Your registered JALSETU account details.
                    </p>

                  </div>

                  <div className="grid gap-4 md:grid-cols-2">

                    {/* NAME */}

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Full Name
                      </div>

                      <div className="text-sm font-semibold text-slate-800">
                        {user?.name || "Not provided"}
                      </div>

                    </div>

                    {/* EMAIL */}

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Email Address
                      </div>

                      <div className="break-all text-sm font-semibold text-slate-800">
                        {user?.email || "Not provided"}
                      </div>

                    </div>

                    {/* PHONE */}

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Phone Number
                      </div>

                      <div className="text-sm font-semibold text-slate-800">
                        {user?.phone || "Not provided"}
                      </div>

                    </div>

                    {/* LOCATION */}

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">

                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Location
                      </div>

                      <div className="text-sm font-semibold text-slate-800">
                        {user?.location || "Not provided"}
                      </div>

                    </div>

                  </div>

                </div>

              </div>

              {/* =================================================
                  RIGHT SIDE
              ================================================= */}

              <div className="space-y-6">

                {/* FLOOD ALERT */}

                <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm">

                  <div className="flex items-start justify-between">

                    <div>

                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-600">
                        Safety System
                      </div>

                      <h2 className="mt-2 text-xl font-bold text-slate-900">
                        Flood Alerts
                      </h2>

                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
                      ⚠️
                    </div>

                  </div>

                  {/* ALERT STATUS */}

                  <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">

                        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />

                      </div>

                      <div>

                        <div className="text-sm font-bold text-green-700">
                          Alerts Enabled
                        </div>

                        <div className="mt-1 text-[11px] text-green-600/70">
                          Your location is monitored for flood risk.
                        </div>

                      </div>

                    </div>

                  </div>

                  {/* NOTIFICATIONS */}

                  <div className="mt-5">

                    <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Notification Channels
                    </div>

                    <div className="space-y-2">

                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">

                        <div className="flex items-center gap-3">

                          <span>📱</span>

                          <span className="text-xs font-medium text-slate-600">
                            SMS / Phone
                          </span>

                        </div>

                        <span className="text-[10px] font-bold text-green-600">
                          ACTIVE
                        </span>

                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">

                        <div className="flex items-center gap-3">

                          <span>✉️</span>

                          <span className="text-xs font-medium text-slate-600">
                            Email
                          </span>

                        </div>

                        <span className="text-[10px] font-bold text-green-600">
                          ACTIVE
                        </span>

                      </div>

                    </div>

                  </div>

                </div>

                {/* LOCATION CARD */}

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-600">
                    Monitored Location
                  </div>

                  <div className="mt-4 flex items-start gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-xl">
                      📍
                    </div>

                    <div>

                      <div className="text-sm font-bold text-slate-800">
                        {user?.location || "Location not provided"}
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        JALSETU can compare this location with
                        simulated flood zones to identify potential
                        risk.
                      </p>

                    </div>

                  </div>

                  <div className="mt-5 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">

                    <span className="text-green-600">✓</span>

                    <span className="text-xs font-medium text-green-700">
                      Location monitoring enabled
                    </span>

                  </div>

                </div>

                {/* LOGOUT */}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-2xl border border-red-100 bg-white px-5 py-3 text-sm font-semibold text-red-500 transition hover:border-red-200 hover:bg-red-50"
                >
                  Sign Out
                </button>

              </div>

            </div>

          )}

          {/* FOOTER */}

          <div className="mt-10 border-t border-slate-200 pt-6 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
            JALSETU • Urban Flood Intelligence • Chennai
          </div>

        </div>

      </section>

    </main>
  );
}