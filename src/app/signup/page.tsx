"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [locationType, setLocationType] = useState<
    "current" | "manual"
  >("current");

  const [currentLocation, setCurrentLocation] = useState("");
  const [manualLocation, setManualLocation] = useState("");

  const [gettingLocation, setGettingLocation] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location services."
      );

      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setCurrentLocation(
          `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        );

        setGettingLocation(false);
      },
      () => {
        setLocationError(
          "Unable to access your location. Please allow location permission."
        );

        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  const form = new FormData(e.currentTarget);

  const name = form.get("name")?.toString().trim();
  const phone = form.get("phone")?.toString().trim();
  const email = form.get("email")?.toString().trim();
  const password = form.get("password")?.toString();
  const confirmPassword =
    form.get("confirmPassword")?.toString();

  const location =
    locationType === "current"
      ? currentLocation
      : manualLocation.trim();

  // Check location
  if (!location) {
    alert("Please select or enter your location.");
    return;
  }

  // Check password
  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  // Check password length
  if (!password || password.length < 8) {
    alert("Password must contain at least 8 characters.");
    return;
  }

  // Temporary account object
  const accountData = {
    name,
    phone,
    email,
    locationType,
    location,
    alertEnabled: true,
  };

  console.log("Account created:", accountData);

  // Save temporarily in browser
  localStorage.setItem(
    "floodTwinUser",
    JSON.stringify(accountData)
  );

  alert("Account created successfully!");

  // Go to login page
  window.location.href = "/login";
};

  return (
    <main className="auth-page">

      {/* Background */}

      <div className="auth-background">
        <div className="auth-grid"></div>
        <div className="auth-glow auth-glow-one"></div>
        <div className="auth-glow auth-glow-two"></div>
      </div>


      {/* Navbar */}

      <nav className="auth-navbar">

        <Link href="/" className="auth-logo">

          <div className="auth-logo-mark">
            ≈
          </div>

          <div>
            <strong>
              Chennai Flood Twin
            </strong>

            <span>
              Urban Flood Intelligence
            </span>
          </div>

        </Link>

        <Link
          href="/"
          className="back-home"
        >
          ← Back to Home
        </Link>

      </nav>


      {/* Signup */}

      <section className="auth-container">

        <div className="auth-card signup-card">

          <div className="auth-card-header">

            <div className="auth-icon">
              +
            </div>

            <span className="auth-label">
              CREATE ACCOUNT
            </span>

            <h1>
              Join the Flood Twin
            </h1>

            <p>
              Create an account to receive
              location-based flood alerts.
            </p>

          </div>


          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            {/* NAME */}

            <div className="form-group">

              <label htmlFor="name">
                Full name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                placeholder="Enter your full name"
                required
              />

            </div>


            {/* PHONE */}

            <div className="form-group">

              <label htmlFor="phone">
                Phone number
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 98765 43210"
                pattern="[+]?[0-9 ]{10,15}"
                required
              />

              <small className="input-help">
                Used for critical flood alerts.
              </small>

            </div>


            {/* EMAIL */}

            <div className="form-group">

              <label htmlFor="email">
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />

              <small className="input-help">
                Used for flood warnings and emergency updates.
              </small>

            </div>


            {/* LOCATION */}

            <div className="form-group">

              <label>
                Your location
              </label>

              <div className="location-options">

                {/* CURRENT LOCATION */}

                <button
                  type="button"
                  className={`location-option ${
                    locationType === "current"
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setLocationType("current");
                    getCurrentLocation();
                  }}
                >

                  <span className="location-option-icon">
                    ◎
                  </span>

                  <span>
                    <strong>
                      Use current location
                    </strong>

                    <small>
                      Automatically detect your location
                    </small>
                  </span>

                </button>


                {/* MANUAL LOCATION */}

                <button
                  type="button"
                  className={`location-option ${
                    locationType === "manual"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setLocationType("manual")
                  }
                >

                  <span className="location-option-icon">
                    ⌖
                  </span>

                  <span>
                    <strong>
                      Enter location
                    </strong>

                    <small>
                      Enter your area manually
                    </small>
                  </span>

                </button>

              </div>


              {/* CURRENT LOCATION */}

              {locationType === "current" && (
                <div className="location-result">

                  {gettingLocation ? (
                    <span>
                      Detecting your location...
                    </span>
                  ) : currentLocation ? (
                    <>
                      <span className="location-success">
                        ✓ Location detected
                      </span>

                      <span>
                        {currentLocation}
                      </span>
                    </>
                  ) : (
                    <span>
                      Click above to detect your current
                      location.
                    </span>
                  )}

                </div>
              )}


              {/* MANUAL LOCATION */}

              {locationType === "manual" && (
                <input
                  name="manualLocation"
                  type="text"
                  placeholder="Example: Velachery, Chennai"
                  value={manualLocation}
                  onChange={(e) =>
                    setManualLocation(e.target.value)
                  }
                  required
                />
              )}


              {locationError && (
                <small className="location-error">
                  {locationError}
                </small>
              )}

            </div>


            {/* PASSWORD */}

            <div className="form-group">

              <label htmlFor="password">
                Password
              </label>

              <div className="password-wrapper">

                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Create a password"
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>

              </div>

            </div>


            {/* CONFIRM PASSWORD */}

            <div className="form-group">

              <label htmlFor="confirmPassword">
                Confirm password
              </label>

              <div className="password-wrapper">

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Confirm your password"
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  {showConfirmPassword
                    ? "Hide"
                    : "Show"}
                </button>

              </div>

            </div>


            {/* ALERT CONSENT */}

            <label className="alert-consent">

              <input
                type="checkbox"
                required
              />

              <span>
                I agree to receive critical flood
                alerts by phone and email when my
                registered location is in a dangerous
                flood zone.
              </span>

            </label>


            {/* TERMS */}

            <label className="remember-me terms">

              <input
                type="checkbox"
                required
              />

              <span>
                I agree to the terms and privacy policy.
              </span>

            </label>


            {/* SUBMIT */}

            <button
              type="submit"
              className="auth-submit"
            >
              Create account
              <span>→</span>
            </button>

          </form>


          {/* DIVIDER */}

          <div className="auth-divider">

            <span></span>

            <p>OR</p>

            <span></span>

          </div>


          {/* GOOGLE */}

          <button
            type="button"
            className="google-button"
          >

            <span className="google-icon">
              G
            </span>

            Sign up with Google

          </button>


          {/* LOGIN */}

          <p className="auth-switch">

            Already have an account?

            <Link href="/login">
              Sign in
            </Link>

          </p>

        </div>


        <p className="auth-footer-text">
          Chennai Flood Twin • Protecting communities
          through flood intelligence
        </p>

      </section>

    </main>
  );
}