"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    const form = new FormData(e.currentTarget);

    const email = form.get("email")?.toString().trim();
    const password = form.get("password")?.toString();

    if (!email || !password) {
      alert("Please enter your email and password.");
      setLoading(false);
      return;
    }

    // Get the account created during signup
    const savedUser = localStorage.getItem("floodTwinUser");

    if (!savedUser) {
      alert("No account found. Please create an account first.");
      setLoading(false);
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      // Check email
      if (user.email !== email) {
        alert("Incorrect email.");
        setLoading(false);
        return;
      }

      /*
       * TEMPORARY FRONTEND LOGIN
       *
       * Later this will be replaced with:
       * Login → FastAPI → MongoDB → JWT
       */

      localStorage.setItem("isLoggedIn", "true");

      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone,
          location: user.location,
        })
      );

      // Go to home/dashboard
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="login-page">

      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          FLOOD<span>TWIN</span>
        </div>

        {/* Header */}
        <div className="login-header">
          <h1>Welcome Back</h1>

          <p>
            Sign in to your Chennai Flood Twin account
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="login-form"
        >

          {/* Email */}
          <div className="login-field">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </div>

          {/* Password */}
          <div className="login-field">

            <div className="password-label">
              <label htmlFor="password">
                Password
              </label>

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                className="show-password"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <input
              id="password"
              name="password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

          </div>

          {/* Forgot password */}
          <div className="forgot-password">
            <button type="button">
              Forgot password?
            </button>
          </div>

          {/* Login */}
          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

        </form>

        {/* Signup */}
        <div className="login-signup">
          <span>
            Don't have an account?
          </span>

          <Link href="/signup">
            Create Account
          </Link>
        </div>

      </div>

    </main>
  );
}