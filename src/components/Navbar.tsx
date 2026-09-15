"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    setIsLoggedIn(
      localStorage.getItem("isLoggedIn") === "true"
    );
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");

    setIsLoggedIn(false);
    setShowProfile(false);

    window.location.href = "/";
  };

  return (
    <nav className="main-navbar">

      {/* ================================
          JALSETU BRAND
      ================================= */}

      <Link href="/" className="navbar-brand">

        <img
          src="/jalsetu-logo.jpeg"
          alt="JALSETU Logo"
          className="navbar-logo"
        />

        <div className="navbar-brand-text">

          <span className="navbar-name">
            JALSETU
          </span>

          <span className="navbar-tagline">
            URBAN FLOOD INTELLIGENCE
          </span>

        </div>

      </Link>


      {/* ================================
          NAVIGATION
      ================================= */}

      <div className="navbar-menu">

        <Link href="/">
          Home
        </Link>

        <Link href="/weather">
          Weather
        </Link>

        <Link href="/alerts">
          Alerts
        </Link>

        <Link href="/about">
          About
        </Link>

      </div>


      {/* ================================
          RIGHT SIDE
      ================================= */}

      <div className="navbar-right">

        {!isLoggedIn ? (

          <>
            <Link
              href="/login"
              className="navbar-login"
            >
              Login
            </Link>

            <Link
              href="/signup"
              className="navbar-signup"
            >
              Sign Up
            </Link>
          </>

        ) : (

          <div className="profile-wrapper">

            {/* PROFILE BUTTON */}

            <button
              className="profile-icon"
              onClick={() =>
                setShowProfile(!showProfile)
              }
              aria-label="Profile"
            >

              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >

                <circle
                  cx="12"
                  cy="8"
                  r="4"
                />

                <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />

              </svg>

            </button>


            {/* PROFILE DROPDOWN */}

            {showProfile && (

              <div className="profile-menu">

                <Link href="/profile">
                  👤 Profile
                </Link>

                <Link href="/alerts">
                  🔔 Flood Alerts
                </Link>

                <button onClick={handleLogout}>
                  ↪ Logout
                </button>

              </div>

            )}

          </div>

        )}

      </div>

    </nav>
  );
}